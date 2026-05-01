import { Controller, Post, Body, Headers, HttpCode, HttpStatus, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; 
import { NotificationsService } from '../../notifications/notifications.service';
import { AsaasService } from '../asaas/asaas.service';
import { Public } from '../../auth/decorators/public.decorator';
import * as crypto from 'crypto';

@Controller('financeiro/webhooks/asaas')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly prisma: PrismaService, 
    private readonly notifications: NotificationsService, 
    private readonly asaasService: AsaasService
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async receberEventoAsaas(
    @Body() payload: any,
    @Headers('asaas-access-token') ASAAS_WEBHOOK_TOKEN: string, 
  ) {
    const tokenCorreto = Buffer.from(process.env.ASAAS_WEBHOOK_TOKEN || 'token_nao_configurado');
    const tokenEnviado = Buffer.from(ASAAS_WEBHOOK_TOKEN || 'token_vazio');

    if (
      tokenCorreto.length !== tokenEnviado.length || 
      !crypto.timingSafeEqual(tokenCorreto, tokenEnviado)
    ) {
      this.logger.warn('Tentativa de invasão bloqueada no Webhook. Token ausente ou inválido.');
      throw new UnauthorizedException('Token de webhook inválido. Acesso negado.');
    }

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

        const { razao_social, telefone_principal } = fatura.empresas;
        const tel = telefone_principal ?? '';

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
          
          this.logger.log(`Alerta de atraso enviado para o cliente. Fatura pendente.`);
        }
      } catch (error) {
        this.logger.error('Erro ao processar evento de atraso:', error);
      }
    }
  }
}