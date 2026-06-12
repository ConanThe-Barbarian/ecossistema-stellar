import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegistrarConsumoDto } from './dto/registrar-consumo.dto';

// DRE por cliente (documentação Stellar):
// Valor do Plano - (Custos Fixos + Custo Variável de Tokens) = Lucro Líquido / 3 sócios
const NUMERO_DE_SOCIOS = 3;

@Injectable()
export class DreService {
  constructor(private prisma: PrismaService) {}

  // ⚠️ Cast temporário até rodar `npx prisma generate` no Windows
  private get custosFixos() {
    return (this.prisma as any).custos_fixos;
  }

  private validarMes(mes: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
      throw new BadRequestException('Parâmetro "mes" deve estar no formato YYYY-MM (ex: 2026-06).');
    }
  }

  // ─── Consumo Variável (tokens/APIs) ───

  async registrarConsumo(dto: RegistrarConsumoDto) {
    const empresa = await this.prisma.empresas.findFirst({
      where: { id: dto.empresa_id, deleted_at: null },
    });
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada na base estelar.');
    }
    return this.prisma.consumo_variavel.create({ data: dto });
  }

  async listarConsumo(empresaId?: string, mes?: string) {
    if (mes) this.validarMes(mes);
    return this.prisma.consumo_variavel.findMany({
      where: {
        ...(empresaId ? { empresa_id: empresaId } : {}),
        ...(mes ? { mes_referencia: mes } : {}),
      },
      orderBy: { created_at: 'desc' },
      include: { empresas: { select: { razao_social: true } } },
    });
  }

  // ─── DRE ───

  // Custo fixo vigente no mês: status ATIVO e (mes_inicio <= mes <= mes_fim, nulls liberam)
  private custoVigenteNoMes(custo: any, mes: string): boolean {
    if (custo.status !== 'ATIVO') return false;
    if (custo.mes_inicio && custo.mes_inicio > mes) return false;
    if (custo.mes_fim && custo.mes_fim < mes) return false;
    return true;
  }

  // DRE consolidado de todos os clientes com contrato ATIVO no mês
  async gerarDre(mes: string) {
    this.validarMes(mes);

    const [contratos, todosCustos, consumos] = await Promise.all([
      this.prisma.contratos.findMany({
        where: { status: 'ATIVO', empresas: { deleted_at: null } },
        include: {
          empresas: { select: { id: true, razao_social: true, nome_fantasia: true } },
          planos: { select: { nome: true } },
        },
      }),
      this.custosFixos.findMany({}),
      this.prisma.consumo_variavel.findMany({ where: { mes_referencia: mes } }),
    ]);

    const custosVigentes = todosCustos.filter((c: any) => this.custoVigenteNoMes(c, mes));

    // Agrupa contratos por empresa
    const porEmpresa = new Map<string, any>();
    for (const contrato of contratos) {
      const emp = contrato.empresas;
      if (!porEmpresa.has(emp.id)) {
        porEmpresa.set(emp.id, {
          empresa_id: emp.id,
          empresa: emp.nome_fantasia || emp.razao_social,
          planos: [] as string[],
          receita: 0,
          custo_fixo_direto: 0,
          custo_fixo_rateado: 0,
          custo_variavel: 0,
        });
      }
      const linha = porEmpresa.get(emp.id);
      linha.planos.push(contrato.planos.nome);
      linha.receita += Number(contrato.valor_mensalidade);
    }

    // Custos fixos diretos por empresa
    for (const custo of custosVigentes.filter((c: any) => c.empresa_id)) {
      const linha = porEmpresa.get(custo.empresa_id);
      if (linha) linha.custo_fixo_direto += Number(custo.valor_mensal);
    }

    // Custos gerais (empresa_id NULL): rateio igual entre os clientes ativos
    const custoGeralTotal = custosVigentes
      .filter((c: any) => !c.empresa_id)
      .reduce((soma: number, c: any) => soma + Number(c.valor_mensal), 0);
    const qtdClientes = porEmpresa.size;
    const custoGeralPorCliente = qtdClientes > 0 ? custoGeralTotal / qtdClientes : 0;
    for (const linha of porEmpresa.values()) {
      linha.custo_fixo_rateado = this.arredondar(custoGeralPorCliente);
    }

    // Consumo variável do mês
    for (const consumo of consumos) {
      const linha = porEmpresa.get(consumo.empresa_id);
      if (linha) linha.custo_variavel += Number(consumo.custo_gerado_reais);
    }

    // Fecha as contas por cliente
    const clientes = [...porEmpresa.values()].map((linha) => {
      const custoTotal = linha.custo_fixo_direto + linha.custo_fixo_rateado + linha.custo_variavel;
      const lucroLiquido = linha.receita - custoTotal;
      return {
        ...linha,
        receita: this.arredondar(linha.receita),
        custo_fixo_direto: this.arredondar(linha.custo_fixo_direto),
        custo_variavel: this.arredondar(linha.custo_variavel),
        custo_total: this.arredondar(custoTotal),
        lucro_liquido: this.arredondar(lucroLiquido),
        margem_percentual: linha.receita > 0 ? this.arredondar((lucroLiquido / linha.receita) * 100) : 0,
        rateio_por_socio: this.arredondar(lucroLiquido / NUMERO_DE_SOCIOS),
      };
    }).sort((a, b) => b.lucro_liquido - a.lucro_liquido);

    // Consolidado da operação
    const receitaTotal = clientes.reduce((s, c) => s + c.receita, 0);
    const custoTotal = clientes.reduce((s, c) => s + c.custo_total, 0);
    const lucroTotal = receitaTotal - custoTotal;

    return {
      mes_referencia: mes,
      consolidado: {
        receita_total: this.arredondar(receitaTotal),
        custo_total: this.arredondar(custoTotal),
        lucro_liquido_total: this.arredondar(lucroTotal),
        margem_percentual: receitaTotal > 0 ? this.arredondar((lucroTotal / receitaTotal) * 100) : 0,
        divisao_por_socio: this.arredondar(lucroTotal / NUMERO_DE_SOCIOS),
        numero_de_socios: NUMERO_DE_SOCIOS,
        clientes_ativos: clientes.length,
      },
      clientes,
    };
  }

  // DRE de um único cliente
  async gerarDreCliente(empresaId: string, mes: string) {
    this.validarMes(mes);

    const empresa = await this.prisma.empresas.findFirst({
      where: { id: empresaId, deleted_at: null },
    });
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada na base estelar.');
    }

    const dre = await this.gerarDre(mes);
    const cliente = dre.clientes.find((c) => c.empresa_id === empresaId);
    if (!cliente) {
      return {
        mes_referencia: mes,
        empresa: empresa.razao_social,
        aviso: 'Empresa sem contrato ATIVO neste mês — sem DRE para calcular.',
      };
    }
    return { mes_referencia: mes, ...cliente };
  }


  /**
   * Alerta de Custos Variáveis (régua de renegociação):
   * compara o consumo do mês com a média histórica de cada cliente.
   * Desvio >= 30% = ATENCAO; >= 60% = CRITICO.
   */
  async alertasConsumo(mes: string) {
    this.validarMes(mes);

    const [consumosDoMes, historico] = await Promise.all([
      this.prisma.consumo_variavel.groupBy({
        by: ['empresa_id'],
        where: { mes_referencia: mes },
        _sum: { custo_gerado_reais: true, qtd_tokens: true },
      }),
      this.prisma.consumo_variavel.findMany({
        where: { mes_referencia: { lt: mes } },
        select: { empresa_id: true, mes_referencia: true, custo_gerado_reais: true },
      }),
    ]);

    // Média histórica por empresa (soma por mês, depois média entre meses)
    const porEmpresaMes = new Map<string, Map<string, number>>();
    for (const h of historico) {
      if (!porEmpresaMes.has(h.empresa_id)) porEmpresaMes.set(h.empresa_id, new Map());
      const meses = porEmpresaMes.get(h.empresa_id)!;
      meses.set(h.mes_referencia, (meses.get(h.mes_referencia) ?? 0) + Number(h.custo_gerado_reais));
    }

    const empresaIds = consumosDoMes.map((c) => c.empresa_id);
    const empresas = await this.prisma.empresas.findMany({
      where: { id: { in: empresaIds } },
      select: { id: true, razao_social: true, nome_fantasia: true },
    });
    const nomeDe = new Map(empresas.map((e) => [e.id, e.nome_fantasia || e.razao_social]));

    const alertas = consumosDoMes.map((c) => {
      const consumoAtual = Number(c._sum.custo_gerado_reais ?? 0);
      const meses = porEmpresaMes.get(c.empresa_id);
      const valoresHistoricos = meses ? [...meses.values()] : [];
      const media =
        valoresHistoricos.length > 0
          ? valoresHistoricos.reduce((a, b) => a + b, 0) / valoresHistoricos.length
          : null;

      let desvioPercentual: number | null = null;
      let situacao = 'SEM_HISTORICO';
      if (media !== null && media > 0) {
        desvioPercentual = this.arredondar(((consumoAtual - media) / media) * 100);
        situacao =
          desvioPercentual >= 60 ? 'CRITICO' : desvioPercentual >= 30 ? 'ATENCAO' : 'NORMAL';
      }

      return {
        empresa_id: c.empresa_id,
        empresa: nomeDe.get(c.empresa_id) ?? c.empresa_id,
        consumo_mes_reais: this.arredondar(consumoAtual),
        qtd_tokens_mes: Number(c._sum.qtd_tokens ?? 0),
        media_historica_reais: media !== null ? this.arredondar(media) : null,
        meses_de_historico: valoresHistoricos.length,
        desvio_percentual: desvioPercentual,
        situacao,
      };
    });

    // CRITICO primeiro, depois ATENCAO
    const peso: Record<string, number> = { CRITICO: 0, ATENCAO: 1, NORMAL: 2, SEM_HISTORICO: 3 };
    alertas.sort((a, b) => peso[a.situacao] - peso[b.situacao]);

    return {
      mes_referencia: mes,
      regua: { atencao_percentual: 30, critico_percentual: 60 },
      total_em_alerta: alertas.filter((a) => a.situacao === 'ATENCAO' || a.situacao === 'CRITICO').length,
      alertas,
    };
  }

  private arredondar(valor: number): number {

    return Math.round(valor * 100) / 100;
  }
}
