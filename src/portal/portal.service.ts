import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// 🌌 Portal do Cliente: visão da PRÓPRIA empresa (empresa_id vem do token JWT)
@Injectable()
export class PortalService {
  constructor(private prisma: PrismaService) {}

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

  // Ferramentas contratadas (Minhas Ferramentas, com SSO)
  async ferramentas(empresaId: string) {
    const vinculos = await this.prisma.ferramentas_contratadas.findMany({
      where: { contratos: { empresa_id: empresaId, status: 'ATIVO' } },
      include: {
        servicos: { select: { nome: true, descricao: true, icone_url: true } },
      },
    });

    return vinculos.map((v) => ({
      servico_id: v.servico_id,
      nome: v.servicos.nome,
      descricao: v.servicos.descricao,
      icone_url: v.servicos.icone_url,
      status_acesso: v.status_acesso,
      // SSO: token e URL só são expostos quando o acesso está liberado
      url_acesso: v.status_acesso === 'LIBERADO' ? v.url_acesso : null,
      token_sso: v.status_acesso === 'LIBERADO' ? v.token_sso_cliente : null,
    }));
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
}
