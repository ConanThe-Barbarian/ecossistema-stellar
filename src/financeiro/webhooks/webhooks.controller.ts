import { Controller, Post, Body, Headers, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; 
import { NotificationsService } from '../../notifications/notifications.service';
import { AsaasService } from '../asaas/asaas.service';


@Controller('financeiro/webhooks/asaas')
export class WebhooksController {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService, private readonly asaasService: AsaasService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async receberEventoAsaas(
    @Body() payload: any,
    @Headers('asaas-access-token') ASAAS_WEBHOOK_TOKEN: string, 
  ) {
    
    
    const secretToken = process.env.ASAAS_WEBHOOK_TOKEN;
    
    if (!secretToken || ASAAS_WEBHOOK_TOKEN !== secretToken) {
      console.warn('🚨 [Stellar Finance] Tentativa de invasão bloqueada no Webhook! Token ausente ou inválido.');
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
      console.error('❌ [Stellar Finance] Falha ao registar o log do webhook no SQL Server:', error);
    }


if (paymentId && (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED')) {
      try {
        
        const faturaAtual = await this.prisma.faturas.findUnique({
          where: { asaas_payment_id: paymentId }
        });

        if (faturaAtual?.status === 'PAGO') {
          console.log(`ℹ️ [Stellar Finance] Fatura ${paymentId} já processada anteriormente. Ignorando duplicata.`);
          return; // ✋ Para aqui e não faz nada
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
          console.log(`⏳ [Stellar Finance] Buscando recibo oficial (Tentativa ${tentativas}/4)...`);
          
          await new Promise(res => setTimeout(res, 8000)); 
          linkRecibo = await this.asaasService.obterLinkComprovante(paymentId);
        }

        
        if (linkRecibo) {
          
          await this.notifications.enviarWhatsAppRecibo(tel, razao_social, linkRecibo);
          console.log(`✅ [Stellar Finance] Fluxo finalizado com sucesso para ${razao_social}.`);
        }

      } catch (error) {
        console.error('❌ [Stellar Finance] Erro no fluxo:', error);
      }
    }

  }

}