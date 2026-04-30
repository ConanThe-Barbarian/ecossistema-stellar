import { Controller, Post, Body, Headers, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; 
import { NotificationsService } from '../../notifications/notifications.service';
import { AsaasService } from '../asaas/asaas.service';

@Controller('financeiro/webhooks/asaas')
export class WebhooksController {
  constructor(
    private readonly prisma: PrismaService, 
    private readonly notifications: NotificationsService, 
    private readonly asaasService: AsaasService
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async receberEventoAsaas(
    @Body() payload: any,
    @Headers('asaas-access-token') ASAAS_WEBHOOK_TOKEN: string, 
  ) {
    const secretToken = process.env.ASAAS_WEBHOOK_TOKEN;
    
    // Validacao de seguranca do Webhook
    if (!secretToken || ASAAS_WEBHOOK_TOKEN !== secretToken) {
      console.warn('[Stellar Finance] Tentativa de invasao bloqueada no Webhook. Token ausente ou invalido.');
      throw new UnauthorizedException('Token de webhook invalido. Acesso negado.');
    }

    const paymentId = payload?.payment?.id;
    const eventType = payload?.event;

    // Registro do evento no banco de dados para auditoria
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
      console.error('[Stellar Finance] Falha ao registrar o log do webhook no SQL Server:', error);
    }

    // Fluxo 1: Pagamento Recebido ou Confirmado
    if (paymentId && (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED')) {
      try {
        const faturaAtual = await this.prisma.faturas.findUnique({
          where: { asaas_payment_id: paymentId }
        });

        // Verificacao de idempotencia para evitar envios duplicados
        if (faturaAtual?.status === 'PAGO') {
          console.log(`[Stellar Finance] Fatura ${paymentId} ja processada anteriormente. Ignorando duplicata.`);
          return;
        }

        // Atualiza o status da fatura
        const fatura = await this.prisma.faturas.update({
          where: { asaas_payment_id: paymentId },
          include: { empresas: true },
          data: { status: 'PAGO', data_pagamento: new Date() }
        });

        const { razao_social, telefone_principal } = fatura.empresas;
        const tel = telefone_principal ?? '';

        // Busca do link do recibo oficial com polling (tentativas espacadas)
        let linkRecibo: string | null = null;
        let tentativas = 0;

        while (!linkRecibo && tentativas < 4) {
          tentativas++;
          console.log(`[Stellar Finance] Buscando recibo oficial (Tentativa ${tentativas}/4)...`);
          
          await new Promise(res => setTimeout(res, 8000)); 
          linkRecibo = await this.asaasService.obterLinkComprovante(paymentId);
        }

        // Envio do recibo ao cliente
        if (linkRecibo) {
          await this.notifications.enviarWhatsAppRecibo(tel, razao_social, linkRecibo);
          console.log(`[Stellar Finance] Fluxo de pagamento finalizado com sucesso para ${razao_social}.`);
        }

      } catch (error) {
        console.error('[Stellar Finance] Erro no fluxo de confirmacao de pagamento:', error);
      }
    }

    // Fluxo 2: Pagamento em Atraso (Vencido)
    if (paymentId && eventType === 'PAYMENT_OVERDUE') {
      try {
        const faturaPendente = await this.prisma.faturas.findUnique({
          where: { asaas_payment_id: paymentId },
          include: { empresas: true }
        });

        // Dispara a cobranca amigavel automatica caso a fatura exista e esteja pendente
        if (faturaPendente && faturaPendente.status !== 'PAGO') {
          const { razao_social, telefone_principal } = faturaPendente.empresas;
          const tel = telefone_principal ?? '';
          
          await this.notifications.enviarWhatsAppAlertaAtraso(
            tel,
            razao_social,
            faturaPendente.url_fatura ?? 'https://www.asaas.com'
          );
          
          console.log(`[Stellar Finance] Alerta de atraso enviado para: ${razao_social}`);
        }
      } catch (error) {
        console.error('[Stellar Finance] Erro ao processar evento de atraso:', error);
      }
    }

  }
}