import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { IngestConsumoIaDto } from './dto/ingest-consumo-ia.dto';

type Granularidade = 'dia' | 'semana' | 'mes' | 'detalhado';

interface ConsultaParams {
  granularidade?: string;
  de?: string;
  ate?: string;
  empresa_id?: string;
  agente?: string;
}

@Injectable()
export class ConsumoIaService implements OnModuleInit {
  private readonly logger = new Logger(ConsumoIaService.name);

  constructor(private prisma: PrismaService) {}

  // Preço por 1.000 tokens (R$). Fallback quando o modelo não está na tabela.
  private get precoPor1k(): number {
    const v = Number((process.env.IA_PRECO_POR_1K_TOKENS || '0').replace(',', '.'));
    return Number.isFinite(v) ? v : 0;
  }

  // Câmbio USD->BRL (configurável). Os preços abaixo são oficiais em USD.
  private get cambioUsdBrl(): number {
    const v = Number((process.env.USD_BRL || '5.40').replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? v : 5.4;
  }

  // Modelos padrão (USD por 1M tokens) usados para semear o catálogo na 1ª vez.
  private modelosPadrao = [
    { nome: 'Gemini 2.5 Flash', slug: 'gemini-2.5-flash', entrada: 0.3, saida: 2.5, padrao: true },
    { nome: 'Gemini 2.5 Pro', slug: 'gemini-2.5-pro', entrada: 1.25, saida: 10.0 },
    { nome: 'Gemini 1.5 Flash', slug: 'gemini-1.5-flash', entrada: 0.075, saida: 0.3 },
    { nome: 'GPT-4o', slug: 'gpt-4o', entrada: 2.5, saida: 10.0 },
    { nome: 'GPT-4o mini', slug: 'gpt-4o-mini', entrada: 0.15, saida: 0.6 },
    { nome: 'GPT-4.1 mini', slug: 'gpt-4.1-mini', entrada: 0.4, saida: 1.6 },
    { nome: 'Claude Haiku 3.5', slug: 'claude-haiku-3.5', entrada: 0.8, saida: 4.0 },
    { nome: 'Claude Sonnet 4', slug: 'claude-sonnet-4', entrada: 3.0, saida: 15.0 },
    { nome: 'DeepSeek V3', slug: 'deepseek-v3', entrada: 0.27, saida: 1.1 },
  ];

  // Semeia o catálogo de modelos na primeira execução (se vazio).
  async onModuleInit() {
    try {
      const n = await this.prisma.modelos_ia.count();
      if (n === 0) {
        await this.prisma.modelos_ia.createMany({
          data: this.modelosPadrao.map((m) => ({
            nome: m.nome,
            slug: m.slug,
            preco_entrada_usd: m.entrada,
            preco_saida_usd: m.saida,
            padrao: !!m.padrao,
            ativo: true,
          })),
        });
        this.logger.log('Catálogo de modelos de IA semeado.');
      }
    } catch (e) {
      this.logger.error('Falha ao semear modelos de IA', e as any);
    }
  }

  // Custo em R$ a partir dos preços (USD por 1M) do modelo.
  private custoPorPrecos(
    prompt: number,
    resposta: number,
    total: number,
    entradaUsd: number,
    saidaUsd: number,
  ): number {
    let entradaTk = prompt;
    let saidaTk = resposta;
    if (!entradaTk && !saidaTk && total > 0) {
      entradaTk = Math.round(total * 0.9);
      saidaTk = total - entradaTk;
    }
    const usd = (entradaTk / 1_000_000) * entradaUsd + (saidaTk / 1_000_000) * saidaUsd;
    return Number((usd * this.cambioUsdBrl).toFixed(4));
  }

  private async modeloPadrao() {
    return (
      (await this.prisma.modelos_ia.findFirst({ where: { padrao: true, ativo: true } })) ||
      (await this.prisma.modelos_ia.findFirst({ where: { ativo: true }, orderBy: { created_at: 'asc' } }))
    );
  }

  // Garante o vínculo agente->modelo; cria com o modelo padrão se for novo.
  private async upsertAgente(empresaId: string, agente: string) {
    const existente = await this.prisma.agentes_ia.findFirst({
      where: { empresa_id: empresaId, agente },
      include: { modelos_ia: true },
    });
    if (existente) return existente;
    const padrao = await this.modeloPadrao();
    return this.prisma.agentes_ia.create({
      data: { empresa_id: empresaId, agente, modelo_id: padrao?.id ?? null },
      include: { modelos_ia: true },
    });
  }

  // ─── Ingestão (chamada pelo n8n) ───
  async registrar(dto: IngestConsumoIaDto) {
    const empresa = await this.resolverEmpresa(dto);

    const prompt = dto.tokens_prompt ?? 0;
    const resposta = dto.tokens_resposta ?? 0;
    const total = dto.tokens_total ?? prompt + resposta;
    if (total <= 0) {
      throw new BadRequestException('Informe tokens_total (ou tokens_prompt + tokens_resposta).');
    }

    // Resolve o modelo a partir do AGENTE (cadastrado no nosso sistema).
    const agenteNome = dto.agente ?? 'Agente IA';
    const agente = await this.upsertAgente(empresa.id, agenteNome);
    const modelo = agente.modelos_ia ?? (await this.modeloPadrao());
    const entradaUsd = modelo ? Number(modelo.preco_entrada_usd) : 0.3;
    const saidaUsd = modelo ? Number(modelo.preco_saida_usd) : 2.5;
    const modeloSlug = modelo?.slug ?? dto.modelo ?? null;

    const custo =
      dto.custo_reais != null
        ? dto.custo_reais
        : this.custoPorPrecos(prompt, resposta, total, entradaUsd, saidaUsd);

    const ocorrido = dto.ocorrido_em ? new Date(dto.ocorrido_em) : new Date();

    // Dedupe por referência (ex.: ID da execução do n8n).
    if (dto.referencia) {
      const existe = await this.prisma.consumo_ia.findFirst({
        where: { empresa_id: empresa.id, referencia: dto.referencia },
        select: { id: true },
      });
      if (existe) {
        return { registrado: false, duplicado: true, id: existe.id, empresa: empresa.razao_social };
      }
    }

    const registro = await this.prisma.consumo_ia.create({
      data: {
        empresa_id: empresa.id,
        agente: agenteNome,
        modelo: modeloSlug,
        origem: dto.origem ?? 'n8n',
        tokens_prompt: prompt,
        tokens_resposta: resposta,
        tokens_total: total,
        custo_reais: custo,
        referencia: dto.referencia ?? null,
        ocorrido_em: ocorrido,
      },
    });

    return {
      registrado: true,
      id: registro.id,
      empresa: empresa.razao_social,
      tokens_total: total,
      custo_reais: custo,
    };
  }

  // ─── Catálogo de modelos ───
  async listarModelos(usuarioLogado: any) {
    await this.garantirStellar(usuarioLogado);
    const modelos = await this.prisma.modelos_ia.findMany({ orderBy: { nome: 'asc' } });
    return modelos.map((m) => ({
      id: m.id,
      nome: m.nome,
      slug: m.slug,
      preco_entrada_usd: Number(m.preco_entrada_usd),
      preco_saida_usd: Number(m.preco_saida_usd),
      ativo: m.ativo,
      padrao: m.padrao,
    }));
  }

  async criarModelo(usuarioLogado: any, dto: any) {
    await this.garantirStellar(usuarioLogado);
    const slug =
      (dto.slug || dto.nome || '').toString().toLowerCase().trim().replace(/[^a-z0-9.]+/g, '-');
    if (!dto.nome || !slug) throw new BadRequestException('Informe nome do modelo.');
    return this.prisma.modelos_ia.create({
      data: {
        nome: dto.nome,
        slug,
        preco_entrada_usd: Number(dto.preco_entrada_usd ?? 0),
        preco_saida_usd: Number(dto.preco_saida_usd ?? 0),
        ativo: dto.ativo ?? true,
        padrao: dto.padrao ?? false,
      },
    });
  }

  async atualizarModelo(usuarioLogado: any, id: string, dto: any) {
    await this.garantirStellar(usuarioLogado);
    const data: any = {};
    if (dto.nome != null) data.nome = dto.nome;
    if (dto.preco_entrada_usd != null) data.preco_entrada_usd = Number(dto.preco_entrada_usd);
    if (dto.preco_saida_usd != null) data.preco_saida_usd = Number(dto.preco_saida_usd);
    if (dto.ativo != null) data.ativo = dto.ativo;
    if (dto.padrao != null) data.padrao = dto.padrao;
    return this.prisma.modelos_ia.update({ where: { id }, data });
  }

  async removerModelo(usuarioLogado: any, id: string) {
    await this.garantirStellar(usuarioLogado);
    // não apaga se estiver em uso; apenas desativa
    const emUso = await this.prisma.agentes_ia.count({ where: { modelo_id: id } });
    if (emUso > 0) {
      await this.prisma.modelos_ia.update({ where: { id }, data: { ativo: false } });
      return { desativado: true, em_uso: emUso };
    }
    await this.prisma.modelos_ia.delete({ where: { id } });
    return { removido: true };
  }

  // ─── Agentes do cliente x modelo ───
  async listarAgentes(usuarioLogado: any, empresaId: string, mes?: string) {
    await this.garantirStellar(usuarioLogado);
    if (!empresaId) throw new BadRequestException('Informe empresa_id.');
    const { de, ate } = this.limitesMes(mes);

    // Backfill: garante vínculo agente->modelo para agentes que já têm consumo.
    const distintos = await this.prisma.consumo_ia.groupBy({
      by: ['agente'],
      where: { empresa_id: empresaId, agente: { not: null } },
    });
    const existentes = await this.prisma.agentes_ia.findMany({
      where: { empresa_id: empresaId },
      select: { agente: true },
    });
    const jaTem = new Set(existentes.map((e) => e.agente));
    const faltam = distintos.map((d) => d.agente!).filter((a) => a && !jaTem.has(a));
    if (faltam.length) {
      const padrao = await this.modeloPadrao();
      for (const a of faltam) {
        await this.prisma.agentes_ia.create({
          data: { empresa_id: empresaId, agente: a, modelo_id: padrao?.id ?? null },
        });
      }
    }

    const agentes = await this.prisma.agentes_ia.findMany({
      where: { empresa_id: empresaId },
      include: { modelos_ia: true },
      orderBy: { agente: 'asc' },
    });

    const linhas: any[] = [];
    for (const a of agentes) {
      const agg = await this.prisma.consumo_ia.aggregate({
        where: { empresa_id: empresaId, agente: a.agente, ocorrido_em: { gte: de, lte: ate } },
        _sum: { tokens_total: true, custo_reais: true },
        _count: { id: true },
      });
      linhas.push({
        id: a.id,
        agente: a.agente,
        modelo_id: a.modelo_id,
        modelo_nome: a.modelos_ia?.nome ?? null,
        tokens: Number(agg._sum.tokens_total ?? 0),
        custo: Number(agg._sum.custo_reais ?? 0),
        execucoes: agg._count.id,
      });
    }
    const totais = linhas.reduce(
      (s, l) => ({ tokens: s.tokens + l.tokens, custo: s.custo + l.custo, execucoes: s.execucoes + l.execucoes }),
      { tokens: 0, custo: 0, execucoes: 0 },
    );
    totais.custo = Math.round(totais.custo * 100) / 100;
    return { agentes: linhas, totais };
  }

  async atualizarAgenteModelo(usuarioLogado: any, id: string, modeloId: string | null) {
    await this.garantirStellar(usuarioLogado);
    return this.prisma.agentes_ia.update({
      where: { id },
      data: { modelo_id: modeloId || null, updated_at: new Date() },
      include: { modelos_ia: true },
    });
  }

  // Clientes que já têm consumo de IA (para o filtro do painel).
  async listarClientes(usuarioLogado: any) {
    await this.garantirStellar(usuarioLogado);
    const grupos = await this.prisma.consumo_ia.groupBy({ by: ['empresa_id'] });
    const ids = grupos.map((g) => g.empresa_id);
    if (ids.length === 0) return [];
    const empresas = await this.prisma.empresas.findMany({
      where: { id: { in: ids } },
      select: { id: true, razao_social: true },
      orderBy: { razao_social: 'asc' },
    });
    return empresas;
  }

  private async resolverEmpresa(dto: IngestConsumoIaDto) {
    if (dto.empresa_id) {
      const e = await this.prisma.empresas.findFirst({
        where: { id: dto.empresa_id, deleted_at: null },
        select: { id: true, razao_social: true },
      });
      if (e) return e;
    }
    if (dto.cnpj) {
      const cnpj = dto.cnpj.replace(/\D/g, '');
      const e = await this.prisma.empresas.findFirst({
        where: { cnpj_cpf: cnpj, deleted_at: null },
        select: { id: true, razao_social: true },
      });
      if (e) return e;
    }
    if (dto.telefone) {
      const tel = dto.telefone.replace(/\D/g, '');
      // compara só os dígitos finais para tolerar +55 / DDI
      const candidatos = await this.prisma.empresas.findMany({
        where: { deleted_at: null, telefone_principal: { not: null } },
        select: { id: true, razao_social: true, telefone_principal: true },
      });
      const e = candidatos.find((c) => {
        const t = (c.telefone_principal ?? '').replace(/\D/g, '');
        return t && (t.endsWith(tel.slice(-8)) || tel.endsWith(t.slice(-8)));
      });
      if (e) return { id: e.id, razao_social: e.razao_social };
    }
    throw new BadRequestException(
      'Empresa não identificada. Envie empresa_id, cnpj ou telefone válido.',
    );
  }

  // ─── Consulta / agregação (só Stellar) ───
  async consultar(usuarioLogado: any, params: ConsultaParams) {
    await this.garantirStellar(usuarioLogado);

    const gran = (params.granularidade as Granularidade) || 'dia';
    // "Até" deve incluir o dia inteiro (senão registros da tarde ficam de fora).
    const ate = params.ate ? new Date(params.ate) : new Date();
    if (params.ate) ate.setUTCHours(23, 59, 59, 999);
    const de = params.de
      ? new Date(params.de)
      : new Date(ate.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (params.de) de.setUTCHours(0, 0, 0, 0);

    const where: any = {
      ocorrido_em: { gte: de, lte: ate },
    };
    if (params.empresa_id) where.empresa_id = params.empresa_id;
    if (params.agente) where.agente = params.agente;

    const rows = await this.prisma.consumo_ia.findMany({
      where,
      orderBy: { ocorrido_em: 'desc' },
      take: 20000,
      include: { empresas: { select: { razao_social: true } } },
    });

    const totais = { tokens: 0, custo: 0, chamadas: 0 };
    const series = new Map<string, { tokens: number; custo: number; chamadas: number }>();
    const porEmpresa = new Map<string, { empresa: string; tokens: number; custo: number; chamadas: number }>();
    const porAgente = new Map<string, { tokens: number; custo: number; chamadas: number }>();

    for (const r of rows) {
      const tokens = r.tokens_total;
      const custo = Number(r.custo_reais);
      totais.tokens += tokens;
      totais.custo += custo;
      totais.chamadas += 1;

      const chave = this.chaveBucket(r.ocorrido_em, gran);
      const s = series.get(chave) ?? { tokens: 0, custo: 0, chamadas: 0 };
      s.tokens += tokens; s.custo += custo; s.chamadas += 1;
      series.set(chave, s);

      const ekey = r.empresa_id;
      const e = porEmpresa.get(ekey) ?? { empresa: r.empresas?.razao_social ?? ekey, tokens: 0, custo: 0, chamadas: 0 };
      e.tokens += tokens; e.custo += custo; e.chamadas += 1;
      porEmpresa.set(ekey, e);

      const akey = r.agente ?? '(sem agente)';
      const a = porAgente.get(akey) ?? { tokens: 0, custo: 0, chamadas: 0 };
      a.tokens += tokens; a.custo += custo; a.chamadas += 1;
      porAgente.set(akey, a);
    }

    const arredondar = (n: number) => Math.round(n * 10000) / 10000;

    const resposta: any = {
      granularidade: gran,
      de: de.toISOString(),
      ate: ate.toISOString(),
      totais: { tokens: totais.tokens, custo: arredondar(totais.custo), chamadas: totais.chamadas },
      series: [...series.entries()]
        .map(([periodo, v]) => ({ periodo, tokens: v.tokens, custo: arredondar(v.custo), chamadas: v.chamadas }))
        .sort((a, b) => a.periodo.localeCompare(b.periodo)),
      por_empresa: [...porEmpresa.entries()]
        .map(([empresa_id, v]) => ({ empresa_id, empresa: v.empresa, tokens: v.tokens, custo: arredondar(v.custo), chamadas: v.chamadas }))
        .sort((a, b) => b.tokens - a.tokens),
      por_agente: [...porAgente.entries()]
        .map(([agente, v]) => ({ agente, tokens: v.tokens, custo: arredondar(v.custo), chamadas: v.chamadas }))
        .sort((a, b) => b.tokens - a.tokens),
    };

    if (gran === 'detalhado') {
      resposta.detalhe = rows.slice(0, 1000).map((r) => ({
        id: r.id,
        empresa: r.empresas?.razao_social ?? r.empresa_id,
        agente: r.agente,
        modelo: r.modelo,
        origem: r.origem,
        tokens_prompt: r.tokens_prompt,
        tokens_resposta: r.tokens_resposta,
        tokens_total: r.tokens_total,
        custo_reais: arredondar(Number(r.custo_reais)),
        referencia: r.referencia,
        ocorrido_em: r.ocorrido_em,
      }));
    }

    return resposta;
  }

  private chaveBucket(data: Date, gran: Granularidade): string {
    const iso = data.toISOString();
    if (gran === 'mes') return iso.slice(0, 7); // YYYY-MM
    if (gran === 'semana') return this.chaveSemanaIso(data);
    return iso.slice(0, 10); // YYYY-MM-DD (dia e detalhado)
  }

  // Semana ISO-8601: 'YYYY-Www'
  private chaveSemanaIso(data: Date): string {
    const d = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
    const dia = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dia);
    const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const semana = Math.ceil(((d.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
  }

  // ─── Teto de IA por contrato e excedente ───

  private limitesMes(mes?: string) {
    const ref = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : new Date().toISOString().slice(0, 7);
    const de = new Date(`${ref}-01T00:00:00.000Z`);
    const ate = new Date(de);
    ate.setUTCMonth(ate.getUTCMonth() + 1);
    ate.setUTCMilliseconds(-1); // último instante do mês
    return { ref, de, ate };
  }

  /** Painel: por cliente, gasto de IA do mês x teto do contrato + status. */
  async resumoTetos(usuarioLogado: any, mes?: string) {
    await this.garantirStellar(usuarioLogado);
    const { ref, de, ate } = this.limitesMes(mes);

    const contratos = await this.prisma.contratos.findMany({
      where: { status: 'ATIVO', teto_ia_reais: { not: null } },
      select: {
        empresa_id: true,
        teto_ia_reais: true,
        valor_mensalidade: true,
        empresas: { select: { razao_social: true } },
      },
    });

    const linhas: any[] = [];
    for (const c of contratos) {
      const agg = await this.prisma.consumo_ia.aggregate({
        where: { empresa_id: c.empresa_id, ocorrido_em: { gte: de, lte: ate } },
        _sum: { custo_reais: true, tokens_total: true },
      });
      const custo = Number(agg._sum.custo_reais ?? 0);
      const tokens = Number(agg._sum.tokens_total ?? 0);
      const teto = Number(c.teto_ia_reais ?? 0);
      const pct = teto > 0 ? custo / teto : 0;
      const excedente = Math.max(0, custo - teto);
      let situacao: 'NORMAL' | 'ATENCAO' | 'EXCEDIDO' = 'NORMAL';
      if (pct >= 1) situacao = 'EXCEDIDO';
      else if (pct >= 0.8) situacao = 'ATENCAO';

      linhas.push({
        empresa_id: c.empresa_id,
        empresa: c.empresas?.razao_social ?? c.empresa_id,
        plano_reais: Number(c.valor_mensalidade),
        teto_reais: teto,
        custo_ia_reais: Math.round(custo * 100) / 100,
        tokens,
        percentual: Math.round(pct * 100),
        excedente_reais: Math.round(excedente * 100) / 100,
        situacao,
      });
    }
    linhas.sort((a, b) => b.percentual - a.percentual);
    return {
      mes_referencia: ref,
      regua: { atencao_percentual: 80 },
      total_excedente_reais:
        Math.round(linhas.reduce((s, l) => s + l.excedente_reais, 0) * 100) / 100,
      clientes: linhas,
    };
  }

  /** Lança/atualiza o excedente do mês no consumo_variavel (idempotente). */
  async sincronizarExcedentes(mes?: string) {
    const { ref, de, ate } = this.limitesMes(mes);
    const contratos = await this.prisma.contratos.findMany({
      where: { status: 'ATIVO', teto_ia_reais: { not: null } },
      select: { empresa_id: true, teto_ia_reais: true },
    });

    let lancados = 0;
    for (const c of contratos) {
      const agg = await this.prisma.consumo_ia.aggregate({
        where: { empresa_id: c.empresa_id, ocorrido_em: { gte: de, lte: ate } },
        _sum: { custo_reais: true, tokens_total: true },
      });
      const custo = Number(agg._sum.custo_reais ?? 0);
      const tokens = Number(agg._sum.tokens_total ?? 0);
      const excedente = Math.max(0, custo - Number(c.teto_ia_reais ?? 0));

      const existente = await this.prisma.consumo_variavel.findFirst({
        where: { empresa_id: c.empresa_id, mes_referencia: ref, origem: 'IA_EXCEDENTE' },
        select: { id: true },
      });

      if (excedente > 0) {
        if (existente) {
          await this.prisma.consumo_variavel.update({
            where: { id: existente.id },
            data: { custo_gerado_reais: excedente, qtd_tokens: tokens },
          });
        } else {
          await this.prisma.consumo_variavel.create({
            data: {
              empresa_id: c.empresa_id,
              mes_referencia: ref,
              qtd_tokens: tokens,
              custo_gerado_reais: excedente,
              origem: 'IA_EXCEDENTE',
            },
          });
        }
        lancados++;
      } else if (existente) {
        // não há mais excedente: zera o lançamento automático
        await this.prisma.consumo_variavel.update({
          where: { id: existente.id },
          data: { custo_gerado_reais: 0, qtd_tokens: tokens },
        });
      }
    }
    return { mes_referencia: ref, contratos: contratos.length, excedentes_lancados: lancados };
  }

  // Roda todo dia às 6h: mantém o excedente do mês corrente atualizado no consumo_variavel.
  @Cron('0 6 * * *')
  async cronExcedentes() {
    try {
      const r = await this.sincronizarExcedentes();
      this.logger.log(`Excedentes de IA sincronizados: ${JSON.stringify(r)}`);
    } catch (e) {
      this.logger.error('Falha ao sincronizar excedentes de IA', e as any);
    }
  }

  async garantirStellarPublico(usuarioLogado: any) {
    return this.garantirStellar(usuarioLogado);
  }

  /** Recalcula o custo_reais de todos os registros já gravados (retroativo). */
  async recalcularCustos(usuarioLogado: any) {
    await this.garantirStellar(usuarioLogado);
    const modelos = await this.prisma.modelos_ia.findMany();
    const porSlug = new Map(modelos.map((m) => [m.slug, m]));
    const padrao = modelos.find((m) => m.padrao) ?? modelos[0];

    const rows = await this.prisma.consumo_ia.findMany({
      select: {
        id: true,
        modelo: true,
        tokens_prompt: true,
        tokens_resposta: true,
        tokens_total: true,
      },
    });
    let atualizados = 0;
    for (const r of rows) {
      const m = (r.modelo && porSlug.get(r.modelo)) || padrao;
      const eUsd = m ? Number(m.preco_entrada_usd) : 0.3;
      const sUsd = m ? Number(m.preco_saida_usd) : 2.5;
      const custo = this.custoPorPrecos(r.tokens_prompt, r.tokens_resposta, r.tokens_total, eUsd, sUsd);
      await this.prisma.consumo_ia.update({ where: { id: r.id }, data: { custo_reais: custo } });
      atualizados++;
    }
    return { atualizados };
  }

  private async garantirStellar(usuarioLogado: any) {
    if (usuarioLogado?.perfil === 'Super Admin') return;
    const stellar = await this.prisma.empresas.findFirst({
      where: { razao_social: { contains: 'STELLAR' }, deleted_at: null },
      select: { id: true },
    });
    if (!stellar || usuarioLogado?.empresa_id !== stellar.id) {
      throw new ForbiddenException('Acesso restrito à equipe Stellar.');
    }
  }
}
