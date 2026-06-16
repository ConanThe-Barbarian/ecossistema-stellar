import { Controller, Post, Body, Headers, HttpCode, HttpStatus, UnauthorizedException, Logger } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { EmailService } from '../../notifications/email.service';
import { AsaasService } from '../asaas/asaas.service';
import { AcessoService } from '../acesso/acesso.service';
import { Public } from '../../auth/decorators/public.decorator';
import * as crypto from 'crypto';

@Controller('financeiro/webhooks/asaas')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly asaasService: AsaasService,
    private readonly acessoService: AcessoService
  ) {}

  @Public()
  @SkipThrottle()
  @Post()
  @HttpCode(HttpStatus.OK)
  async receberEventoAsaas(
    @Body() payload: any,
    @Headers('asaas-access-token') ASAAS_WEBHOOK_TOKEN: string,
  ) {
    // 1. Validação do token (síncrona, antes de responder)
    const tokenCorreto = Buffer.from(process.env.ASAAS_WEBHOOK_TOKEN || 'token_nao_configurado');
    const tokenEnviado = Buffer.from(ASAAS_WEBHOOK_TOKEN || 'token_vazio');

    if (
      tokenCorreto.length !== tokenEnviado.length ||
      !crypto.timingSafeEqual(tokenCorreto, tokenEnviado)
    ) {
      this.logger.warn('Tentativa de invasão bloqueada no Webhook. Token ausente ou inválido.');
      throw new UnauthorizedException('Token de webhook inválido. Acesso negado.');
    }

    // 2. Responde 200 IMEDIATAMENTE e processa em segundo plano.
    //    Evita timeout no Asaas (o processamento busca recibo com esperas de até ~32s),
    //    o que penalizava e pausava a fila de webhooks.
    void this.processarEvento(payload);
    return { received: true };
  }

  // Processamento em segundo plano (fire-and-forget). Nunca lança para fora.
  private async processarEvento(payload: any) {
    const paymentId = payload?.payment?.id;
    const eventType = payload?.event;

    try {
      await this.prisma.webhook_logs_asaas.create({
        data: {
          evento_asaas: eventType || 'UNKNOWN_EVENT',
          asaas_payment_id: paymentId || 'NO_ID',
          payload_completo: JSON.stringify(payload),
          status_processamento: 'PROCESSADO',
        }
      });
    } catch (error) {
      this.logger.error('Falha ao registrar o log do webhook no SQL Server:', error);
    }

    if (paymentId && (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED')) {
      try {
        const faturaAtual = await this.prisma.faturas.findUnique({
          where: { asaas_payment_id: paymentId }
        });

        if (faturaAtual?.status === 'PAGO') {
          this.logger.debug(`Fatura Asaas ID [${paymentId}] já processada anteriormente.`);
          return;
        }

        const fatura = await this.prisma.faturas.update({
          where: { asaas_payment_id: paymentId },
          include: { empresas: true },
          data: { status: 'PAGO', data_pagamento: new Date() }
        });

        const { razao_social, telefone_principal, email_financeiro } = fatura.empresas;
        const tel = telefone_principal ?? '';
        const valorFmt = Number(fatura.valor).toFixed(2).replace('.', ',');

        // 🔓 AUTOMACAO: pagamento confirmado -> libera as ferramentas do cliente
        const liberadas = await this.acessoService.liberarAcessoEmpresa(fatura.empresa_id);
        if (liberadas > 0) {
          this.logger.log(`${liberadas} ferramenta(s) liberada(s) automaticamente para ${razao_social}.`);
        }

        let linkRecibo: string | null = null;
        let tentativas = 0;

        while (!linkRecibo && tentativas < 4) {
          tentativas++;
          this.logger.debug(`Buscando recibo oficial no Asaas (Tentativa ${tentativas}/4)...`);
          await new Promise(res => setTimeout(res, 8000));
          linkRecibo = await this.asaasService.obterLinkComprovante(paymentId);
        }

        if (linkRecibo) {
          await this.notifications.enviarWhatsAppRecibo(tel, razao_social, linkRecibo);
          this.logger.log(`Fluxo de pagamento finalizado com sucesso. Fatura quitada.`);
        }

        // 📧 E-mail transacional de confirmação (só envia se houver e-mail + SMTP configurado)
        if (email_financeiro) {
          await this.email.enviarConfirmacaoPagamento(
            email_financeiro,
            razao_social,
            valorFmt,
            linkRecibo,
          );
        }

      } catch (error) {
        this.logger.error('Erro no fluxo de confirmação de pagamento:', error);
      }
    }

    if (paymentId && eventType === 'PAYMENT_OVERDUE') {
      try {
        const faturaPendente = await this.prisma.faturas.findUnique({
          where: { asaas_payment_id: paymentId },
          include: { empresas: true }
        });

        if (faturaPendente && faturaPendente.status !== 'PAGO') {
          const { razao_social, telefone_principal } = faturaPendente.empresas;
          const tel = telefone_principal ?? '';

          await this.notifications.enviarWhatsAppAlertaAtraso(
            tel,
            razao_social,
            faturaPendente.url_fatura ?? 'https://www.asaas.com'
          );

          // 🔒 AUTOMACAO: fatura vencida -> bloqueia as ferramentas do cliente
          await this.acessoService.bloquearAcessoEmpresa(
            faturaPendente.empresa_id,
            `Fatura ${paymentId} vencida (PAYMENT_OVERDUE)`
          );

          this.logger.log(`Alerta de atraso enviado e acesso bloqueado. Fatura pendente.`);
        }
      } catch (error) {
        this.logger.error('Erro ao processar evento de atraso:', error);
      }
    }
  }
}
