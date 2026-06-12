import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';

/**
 * 🔐 Controle de Acesso às Ferramentas (a automação central do negócio)
 *
 * "Cliente pagou → Asaas avisa → sistema libera o acesso no automático."
 * "Cliente inadimplente → sistema bloqueia o acesso no automático."
 *
 * O bloqueio em ferramentas_contratadas já corta o SSO do Portal do Cliente
 * (o token só é exposto quando status_acesso = LIBERADO).
 *
 * Suspensão direta no Chatwoot (GalaxIA): opcional, ativada quando as
 * variáveis CHATWOOT_PLATFORM_URL e CHATWOOT_PLATFORM_TOKEN existirem no .env
 * e a ferramenta tiver o chatwoot_account_id no campo url_acesso (query ?cw_account=ID).
 */
@Injectable()
export class AcessoService {
  private readonly logger = new Logger(AcessoService.name);

  constructor(private prisma: PrismaService) {}

  // Bloqueia todas as ferramentas dos contratos ativos da empresa
  async bloquearAcessoEmpresa(empresaId: string, motivo: string) {
    const resultado = await this.prisma.ferramentas_contratadas.updateMany({
      where: {
        contratos: { empresa_id: empresaId, status: 'ATIVO' },
        status_acesso: 'LIBERADO',
      },
      data: { status_acesso: 'BLOQUEADO' },
    });

    if (resultado.count > 0) {
      this.logger.warn(
        `Acesso BLOQUEADO: ${resultado.count} ferramenta(s) da empresa ${empresaId}. Motivo: ${motivo}`,
      );
      await this.sincronizarChatwoot(empresaId, 'suspender');
    }

    return resultado.count;
  }

  // Libera as ferramentas — somente se a empresa não tiver NENHUMA fatura vencida
  async liberarAcessoEmpresa(empresaId: string) {
    const faturasVencidas = await this.prisma.faturas.count({
      where: {
        empresa_id: empresaId,
        status: 'PENDENTE',
        data_vencimento: { lt: new Date() },
      },
    });

    if (faturasVencidas > 0) {
      this.logger.warn(
        `Liberação adiada: empresa ${empresaId} ainda tem ${faturasVencidas} fatura(s) vencida(s).`,
      );
      return 0;
    }

    const resultado = await this.prisma.ferramentas_contratadas.updateMany({
      where: {
        contratos: { empresa_id: empresaId, status: 'ATIVO' },
        status_acesso: 'BLOQUEADO',
      },
      data: { status_acesso: 'LIBERADO' },
    });

    if (resultado.count > 0) {
      this.logger.log(
        `Acesso LIBERADO: ${resultado.count} ferramenta(s) da empresa ${empresaId}.`,
      );
      await this.sincronizarChatwoot(empresaId, 'reativar');
    }

    return resultado.count;
  }

  /**
   * Suspende/reativa a conta do cliente no Chatwoot (GalaxIA) via Platform API.
   * Não-bloqueante: falha aqui não interrompe o fluxo de pagamento.
   */
  private async sincronizarChatwoot(empresaId: string, acao: 'suspender' | 'reativar') {
    const baseUrl = process.env.CHATWOOT_PLATFORM_URL;
    const token = process.env.CHATWOOT_PLATFORM_TOKEN;
    if (!baseUrl || !token) return; // Integração não configurada — só o portal é afetado

    try {
      const ferramentas = await this.prisma.ferramentas_contratadas.findMany({
        where: { contratos: { empresa_id: empresaId, status: 'ATIVO' } },
        select: { url_acesso: true, servicos: { select: { nome: true } } },
      });

      for (const f of ferramentas) {
        // Convenção: url_acesso carrega ?cw_account=<id> para ferramentas Chatwoot
        const match = f.url_acesso?.match(/[?&]cw_account=(\d+)/);
        if (!match) continue;

        const accountId = match[1];
        await axios.patch(
          `${baseUrl}/platform/api/v1/accounts/${accountId}`,
          { status: acao === 'suspender' ? 'suspended' : 'active' },
          { headers: { api_access_token: token } },
        );
        this.logger.log(
          `Chatwoot account ${accountId} (${f.servicos.nome}): ${acao === 'suspender' ? 'suspensa' : 'reativada'}.`,
        );
      }
    } catch (error: any) {
      this.logger.error(`Falha ao ${acao} conta no Chatwoot: ${error.message}`);
    }
  }
}
