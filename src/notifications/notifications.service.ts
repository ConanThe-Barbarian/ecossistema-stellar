import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class NotificationsService {
  
async enviarWhatsAppConfirmacao(telefone: string, nome: string, valor: string) {
  const telefoneLimpo = telefone.replace(/\D/g, '');
  const payload = {
    number: telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`,
    text: `✅ *Pagamento Confirmado!*\n\nOlá, *${nome}*! Recebemos seu pagamento de *R$ ${valor}*.\n\nSua fatura já foi liquidada em nosso sistema. Em instantes, enviaremos o seu *comprovante oficial* por aqui! ⏳🚀`,
    delay: 1000
  };
  await this.dispararEvolution(payload);
}


async enviarWhatsAppRecibo(telefone: string, nome: string, linkRecibo: string) {
    try {
      const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
      const instance = encodeURIComponent(process.env.EVOLUTION_INSTANCE || '');
      
      const telefoneLimpo = telefone.replace(/\D/g, '');
      const numeroFinal = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;

      const payload = {
        number: numeroFinal,
        // 📄 Texto da Opção 2 (Executive)
        text: `📄 *Recibo de Pagamento - Stellar Syntec*\n\nPrezado(a) *${nome}*, informamos que o seu pagamento foi confirmado e liquidado com sucesso.\n\n*Acesse seu comprovante oficial aqui:* \n${linkRecibo}\n\nAgradecemos a preferência. Se precisar de suporte, nossa equipe está à disposição.`,
        delay: 1200,
        linkPreview: true 
      };

      await axios.post(`${baseUrl}/message/sendText/${instance}`, payload, {
        headers: { 'apikey': process.env.EVOLUTION_API_KEY }
      });

      console.log(`📱 [Stellar Notifications] Recibo enviado: ${nome}`);
    } catch (error) {
      console.error('❌ [Stellar Notifications] Erro ao enviar recibo:', error);
    }
  }

// Método auxiliar para evitar repetição de código
private async dispararEvolution(payload: any) {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
  const instance = encodeURIComponent(process.env.EVOLUTION_INSTANCE || '');
  await axios.post(`${baseUrl}/message/sendText/${instance}`, payload, {
    headers: { 'apikey': process.env.EVOLUTION_API_KEY }
  });
}
}