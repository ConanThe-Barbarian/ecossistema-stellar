import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// 🌌 Portal do Cliente: visão da PRÓPRIA empresa (empresa_id vem do token JWT)
@Injectable()
export class PortalService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  // Catálogo de soluções da Stellar (semeado na 1ª subida se faltar).
  // tipo: ACESSO = tem login/SSO; SERVICO = recorrente/projeto, sem login.
  private catalogoStellar = [
    { nome: 'Automações', descricao: 'Soluções para Automação de Workflows', tipo: 'SERVICO' },
    { nome: 'Desenvolvimento', descricao: 'Soluções de Desenvolvimento de Aplicações e Software', tipo: 'SERVICO' },
    { nome: 'GalaxIA', descricao: 'Plataforma de Atendimento Multicanais', tipo: 'ACESSO' },
    { nome: 'Infraestrutura', descricao: 'Soluções de Equipamentos de TI', tipo: 'SERVICO' },
    { nome: 'Suporte Técnico', descricao: 'Soluções com Equipe Especializada', tipo: 'SERVICO' },
  ];

  async onModuleInit() {
    try {
      for (const s of this.catalogoStellar) {
        const existe = await this.prisma.servicos.findFirst({ where: { nome: s.nome } });
        if (!existe) {
          await this.prisma.servicos.create({
            data: { nome: s.nome, descricao: s.descricao, tipo: s.tipo, status: 'ATIVO' },
          });
        } else if (!existe.tipo || existe.tipo === 'ACESSO') {
          // mantém o tipo do catálogo padrão em sincronia (sem sobrescrever ajustes manuais p/ SERVICO)
          await this.prisma.servicos.update({ where: { id: existe.id }, data: { tipo: s.tipo } });
        }
      }
    } catch {
      // não derruba o boot se o banco estiver dormindo
    }
  }

  // Resumo: plano atual, situação financeira e próxima fatura
  async resumo(empresaId: string) {
    const empresa = await this.prisma.empresas.findFirst({
      where: { id: empresaId, deleted_at: null },
      select: { id: true, razao_social: true, nome_fantasia: true, ui_customizacao: true },
    });
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada na base estelar.');
    }

    const contrato = await this.prisma.contratos.findFirst({
      where: { empresa_id: empresaId, status: 'ATIVO' },
      include: { planos: { select: { nome: true } } },
      orderBy: { created_at: 'desc' },
    });

    const hoje = new Date();
    const [proximaFatura, faturasVencidas] = await Promise.all([
      this.prisma.faturas.findFirst({
        where: { empresa_id: empresaId, status: 'PENDENTE' },
        orderBy: { data_vencimento: 'asc' },
        select: {
          id: true,
          valor: true,
          data_vencimento: true,
          url_fatura: true,
          linha_digitavel: true,
        },
      }),
      this.prisma.faturas.count({
        where: { empresa_id: empresaId, status: 'PENDENTE', data_vencimento: { lt: hoje } },
      }),
    ]);

    // Empresa responsável pelos chamados (Stellar Syntec) — o frontend precisa
    // desse ID para abrir chamados
    const stellar = await this.prisma.empresas.findFirst({
      where: { razao_social: { contains: 'STELLAR' }, deleted_at: null },
      select: { id: true },
    });

    return {
      empresa: {
        id: empresa.id,
        nome: empresa.nome_fantasia || empresa.razao_social,
        ui_customizacao: empresa.ui_customizacao,
      },
      plano: contrato
        ? {
            nome: contrato.planos.nome,
            valor_mensalidade: Number(contrato.valor_mensalidade),
            dia_vencimento: contrato.dia_vencimento,
          }
        : null,
      situacao_pagamento: faturasVencidas > 0 ? 'EM_DEBITO' : 'EM_DIA',
      proxima_fatura: proximaFatura
        ? { ...proximaFatura, valor: Number(proximaFatura.valor) }
        : null,
      empresa_responsavel_id: stellar?.id ?? null,
    };
  }

  // Minhas Ferramentas: catálogo COMPLETO de soluções. As contratadas têm acesso
  // (SSO); as não contratadas mostram "Contratar".
  async ferramentas(empresaId: string) {
    const [servicos, vinculos] = await Promise.all([
      this.prisma.servicos.findMany({ where: { status: 'ATIVO' }, orderBy: { nome: 'asc' } }),
      this.prisma.ferramentas_contratadas.findMany({
        where: { contratos: { empresa_id: empresaId, status: 'ATIVO' } },
      }),
    ]);

    const porServico = new Map(vinculos.map((v) => [v.servico_id, v]));
    return servicos.map((s) => {
      const v = porServico.get(s.id);
      const liberado = v?.status_acesso === 'LIBERADO';
      return {
        servico_id: s.id,
        nome: s.nome,
        descricao: s.descricao,
        icone_url: s.icone_url,
        tipo: s.tipo ?? 'ACESSO',
        contratado: !!v,
        status_acesso: v?.status_acesso ?? null,
        // SSO: token e URL só quando contratado E liberado
        url_acesso: liberado ? v?.url_acesso ?? null : null,
        token_sso: liberado ? v?.token_sso_cliente ?? null : null,
      };
    });
  }

  // "Contratar": abre uma solicitação interna (chamado) para a Stellar tratar,
  // com as respostas do formulário específico da solução.
  async contratar(usuario: any, servicoId: string, respostas?: { label: string; valor: string }[]) {
    const empresaId = usuario.empresa_id;
    const servico = await this.prisma.servicos.findFirst({
      where: { id: servicoId, status: 'ATIVO' },
    });
    if (!servico) throw new NotFoundException('Solução não encontrada no catálogo.');

    const stellar = await this.prisma.empresas.findFirst({
      where: { razao_social: { contains: 'STELLAR' }, deleted_at: null },
      select: { id: true },
    });
    if (!stellar) throw new BadRequestException('Empresa Stellar não configurada.');

    const titulo = `Contratação: ${servico.nome}`;
    // Evita duplicar pedidos abertos da mesma solução.
    const existente = await this.prisma.chamados.findFirst({
      where: {
        empresa_origem_id: empresaId,
        empresa_responsavel_id: stellar.id,
        titulo,
        status: { notIn: ['RESOLVIDO', 'FECHADO'] },
      },
      select: { id: true },
    });
    if (existente) return { ok: true, ja_solicitado: true, chamado_id: existente.id };

    const detalhes = (respostas ?? [])
      .filter((r) => r && r.valor && String(r.valor).trim())
      .map((r) => `- ${r.label}: ${r.valor}`)
      .join('\n');
    const descricao =
      `O cliente solicitou a contratação da solução "${servico.nome}".\n\n` +
      (detalhes ? `Informações enviadas:\n${detalhes}` : 'Sem detalhes adicionais.') +
      `\n\nA equipe Stellar deve analisar e montar a proposta.`;

    const chamado = await this.prisma.chamados.create({
      data: {
        titulo,
        descricao,
        categoria: 'CONTRATACAO',
        prioridade: 'MEDIA',
        status: 'NOVO',
        requerente_id: usuario.userId ?? usuario.id,
        empresa_origem_id: empresaId,
        empresa_responsavel_id: stellar.id,
      },
    });
    return { ok: true, chamado_id: chamado.id };
  }

  // Histórico de faturas (Transparência Financeira)
  async faturas(empresaId: string) {
    const faturas = await this.prisma.faturas.findMany({
      where: { empresa_id: empresaId },
      orderBy: { data_vencimento: 'desc' },
      take: 24,
      select: {
        id: true,
        valor: true,
        data_vencimento: true,
        data_pagamento: true,
        status: true,
        url_fatura: true,
        linha_digitavel: true,
      },
    });

    return faturas.map((f) => ({ ...f, valor: Number(f.valor) }));
  }

  // Notificações derivadas (sem tabela própria): faturas em aberto + chamados
  // aguardando a resposta do cliente. Itens "acionáveis" para o sino do portal.
  async notificacoes(usuario: any) {
    const empresaId = usuario?.empresa_id ?? usuario;
    const ehGestor = !!usuario?.permissoes?.can_manage_users;
    const hoje = new Date();
    const [faturasPendentes, chamadosPendentes] = await Promise.all([
      this.prisma.faturas.findMany({
        where: { empresa_id: empresaId, status: 'PENDENTE' },
        orderBy: { data_vencimento: 'asc' },
        select: { id: true, valor: true, data_vencimento: true },
      }),
      this.prisma.chamados.findMany({
        where: { empresa_origem_id: empresaId, status: 'PENDENTE_CLIENTE' },
        orderBy: { updated_at: 'desc' },
        select: { id: true, titulo: true, updated_at: true },
      }),
    ]);

    // Aviso de consumo de IA vs teto (só para Gestor/Admin da empresa).
    let avisoIa: any = null;
    if (ehGestor) {
      const contrato = await this.prisma.contratos.findFirst({
        where: { empresa_id: empresaId, status: 'ATIVO', teto_ia_reais: { not: null } },
        select: { teto_ia_reais: true },
      });
      const teto = Number(contrato?.teto_ia_reais ?? 0);
      if (teto > 0) {
        const ref = new Date().toISOString().slice(0, 7);
        const ini = new Date(`${ref}-01T00:00:00.000Z`);
        const fim = new Date(ini);
        fim.setUTCMonth(fim.getUTCMonth() + 1);
        fim.setUTCMilliseconds(-1);
        const agg = await this.prisma.consumo_ia.aggregate({
          where: { empresa_id: empresaId, ocorrido_em: { gte: ini, lte: fim } },
          _sum: { custo_reais: true },
        });
        const custo = Number(agg._sum.custo_reais ?? 0);
        const pct = Math.round((custo / teto) * 100);
        const fmt = (v: number) => v.toFixed(2).replace('.', ',');
        if (pct >= 100) {
          avisoIa = {
            tipo: 'CONSUMO_IA',
            nivel: 'danger',
            titulo: 'Limite de IA excedido',
            descricao: `Consumo de IA em ${pct}% do teto (R$ ${fmt(custo)} de R$ ${fmt(teto)}). O excedente entra na próxima fatura.`,
            link: '/faturas',
            data: hoje,
          };
        } else if (pct >= 80) {
          avisoIa = {
            tipo: 'CONSUMO_IA',
            nivel: 'warn',
            titulo: 'Consumo de IA próximo do limite',
            descricao: `Você já usou ${pct}% do teto de IA deste mês (R$ ${fmt(custo)} de R$ ${fmt(teto)}).`,
            link: '/faturas',
            data: hoje,
          };
        }
      }
    }

    const itens = [
      ...(avisoIa ? [avisoIa] : []),
      ...faturasPendentes.map((f) => {
        const vencida = new Date(f.data_vencimento) < hoje;
        const valor = Number(f.valor).toFixed(2).replace('.', ',');
        return {
          tipo: 'FATURA',
          nivel: vencida ? 'danger' : 'info',
          titulo: vencida ? 'Fatura vencida' : 'Fatura em aberto',
          descricao: `R$ ${valor} • vence ${new Date(f.data_vencimento).toLocaleDateString('pt-BR')}`,
          link: '/faturas',
          data: f.data_vencimento,
        };
      }),
      ...chamadosPendentes.map((c) => ({
        tipo: 'CHAMADO',
        nivel: 'warn',
        titulo: 'Chamado aguardando sua resposta',
        descricao: c.titulo,
        link: `/chamados/${c.id}`,
        data: c.updated_at,
      })),
    ];

    itens.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    return { total: itens.length, itens };
  }
}
