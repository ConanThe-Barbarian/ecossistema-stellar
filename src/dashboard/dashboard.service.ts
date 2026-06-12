import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Dashboard Executivo (Torre de Controle): MRR, novos clientes, churn,
// chamados abertos e tempo de resolução — visão macro para os 3 fundadores.
@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private validarMes(mes: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
      throw new BadRequestException('Parâmetro "mes" deve estar no formato YYYY-MM (ex: 2026-06).');
    }
  }

  private intervaloDoMes(mes: string): { inicio: Date; fim: Date } {
    const [ano, mesNum] = mes.split('-').map(Number);
    const inicio = new Date(Date.UTC(ano, mesNum - 1, 1));
    const fim = new Date(Date.UTC(ano, mesNum, 1)); // exclusivo
    return { inicio, fim };
  }

  async executivo(mes?: string) {
    const mesRef = mes || new Date().toISOString().slice(0, 7);
    this.validarMes(mesRef);
    const { inicio, fim } = this.intervaloDoMes(mesRef);

    const [
      contratosAtivos,
      contratosNovosNoMes,
      contratosCanceladosNoMes,
      empresasClientesAtivas,
      chamadosAbertos,
      chamadosNovosNoMes,
      chamadosResolvidosNoMes,
      chamadosSlaEstourado,
      faturasPendentes,
      faturasVencidas,
    ] = await Promise.all([
      this.prisma.contratos.findMany({
        where: { status: 'ATIVO', empresas: { deleted_at: null } },
        select: { valor_mensalidade: true, empresa_id: true },
      }),
      this.prisma.contratos.count({
        where: { created_at: { gte: inicio, lt: fim } },
      }),
      this.prisma.contratos.count({
        where: { status: 'CANCELADO', updated_at: { gte: inicio, lt: fim } },
      }),
      this.prisma.empresas.count({
        where: { deleted_at: null, status: 'ATIVO', contratos: { some: { status: 'ATIVO' } } },
      }),
      this.prisma.chamados.count({
        where: { status: { notIn: ['RESOLVIDO', 'FECHADO'] } },
      }),
      this.prisma.chamados.count({
        where: { created_at: { gte: inicio, lt: fim } },
      }),
      this.prisma.chamados.findMany({
        where: {
          status: { in: ['RESOLVIDO', 'FECHADO'] },
          updated_at: { gte: inicio, lt: fim },
        },
        select: { created_at: true, updated_at: true },
      }),
      this.prisma.chamados.count({
        where: {
          status: { notIn: ['RESOLVIDO', 'FECHADO'] },
          data_limite_solucao: { lt: new Date() },
        },
      }),
      this.prisma.faturas.aggregate({
        where: { status: 'PENDENTE' },
        _sum: { valor: true },
        _count: true,
      }),
      this.prisma.faturas.aggregate({
        where: { status: 'PENDENTE', data_vencimento: { lt: new Date() } },
        _sum: { valor: true },
        _count: true,
      }),
    ]);

    // ─── Financeiro ───
    const mrr = contratosAtivos.reduce((soma, c) => soma + Number(c.valor_mensalidade), 0);

    // Churn do mês: contratos cancelados / (ativos no fim do mês + cancelados no mês)
    const baseChurn = contratosAtivos.length + contratosCanceladosNoMes;
    const churnPercentual = baseChurn > 0 ? (contratosCanceladosNoMes / baseChurn) * 100 : 0;

    // ─── Operacional ───
    // Tempo médio de resolução dos chamados fechados no mês (em horas)
    const tempoMedioHoras =
      chamadosResolvidosNoMes.length > 0
        ? chamadosResolvidosNoMes.reduce(
            (soma, c) => soma + (c.updated_at.getTime() - c.created_at.getTime()),
            0,
          ) /
          chamadosResolvidosNoMes.length /
          (1000 * 60 * 60)
        : 0;

    return {
      mes_referencia: mesRef,
      financeiro: {
        mrr: this.arredondar(mrr),
        arr_projetado: this.arredondar(mrr * 12),
        clientes_ativos: empresasClientesAtivas,
        contratos_ativos: contratosAtivos.length,
        novos_contratos_no_mes: contratosNovosNoMes,
        contratos_cancelados_no_mes: contratosCanceladosNoMes,
        churn_percentual: this.arredondar(churnPercentual),
        faturas_pendentes: {
          quantidade: faturasPendentes._count,
          valor_total: this.arredondar(Number(faturasPendentes._sum.valor ?? 0)),
        },
        faturas_vencidas: {
          quantidade: faturasVencidas._count,
          valor_total: this.arredondar(Number(faturasVencidas._sum.valor ?? 0)),
        },
      },
      operacional: {
        chamados_abertos_agora: chamadosAbertos,
        chamados_novos_no_mes: chamadosNovosNoMes,
        chamados_resolvidos_no_mes: chamadosResolvidosNoMes.length,
        tempo_medio_resolucao_horas: this.arredondar(tempoMedioHoras),
        chamados_com_sla_estourado: chamadosSlaEstourado,
      },
    };
  }

  // Evolução do MRR nos últimos N meses (para o gráfico estilo Power BI)
  async evolucaoMrr(meses = 6) {
    const resultado: { mes: string; mrr: number; novos_contratos: number }[] = [];
    const hoje = new Date();

    for (let i = meses - 1; i >= 0; i--) {
      const data = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1));
      const mes = data.toISOString().slice(0, 7);
      const { fim } = this.intervaloDoMes(mes);
      const { inicio } = this.intervaloDoMes(mes);

      // Contratos que já existiam até o fim do mês e não foram cancelados antes dele
      const contratos = await this.prisma.contratos.findMany({
        where: {
          created_at: { lt: fim },
          OR: [
            { status: 'ATIVO' },
            { status: { not: 'ATIVO' }, updated_at: { gte: fim } },
          ],
        },
        select: { valor_mensalidade: true },
      });

      const novos = await this.prisma.contratos.count({
        where: { created_at: { gte: inicio, lt: fim } },
      });

      resultado.push({
        mes,
        mrr: this.arredondar(
          contratos.reduce((s, c) => s + Number(c.valor_mensalidade), 0),
        ),
        novos_contratos: novos,
      });
    }

    return resultado;
  }

  private arredondar(valor: number): number {
    return Math.round(valor * 100) / 100;
  }
}
