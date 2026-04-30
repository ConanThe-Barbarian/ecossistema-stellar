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

async enviarWhatsAppLembreteVencimento(telefone: string, nome: string, valor: string, dataVencimento: string, linkFatura: string) {
  const payload = {
    number: this.formatarNumero(telefone),
    text: `🔔 *Lembrete de Pagamento - Stellar Syntec*\n\nPrezado(a) *${nome}*,\n\nPassamos para lembrar que sua fatura no valor de *R$ ${valor}* vence em breve (*${dataVencimento}*).\n\nPara sua comodidade, pode aceder à fatura aqui: \n${linkFatura}\n\nCaso já tenha efetuado o pagamento, por favor ignore esta mensagem.`,
    delay: 1200,
    linkPreview: true
  };
  await this.dispararEvolution(payload);
}

// 2️⃣ Alerta de Atraso (Enviado após o vencimento)
async enviarWhatsAppAlertaAtraso(telefone: string, nome: string, linkFatura: string) {
  const payload = {
    number: this.formatarNumero(telefone),
    text: `⚠️ *Aviso de Pendência - Stellar Syntec*\n\nPrezado(a) *${nome}*,\n\nidentificamos que o pagamento da sua mensalidade consta como pendente em nosso sistema.\n\nPedimos a gentileza de regularizar o acesso através do link abaixo para evitar a suspensão dos serviços:\n${linkFatura}\n\nSe precisar de ajuda ou de uma segunda via, estamos à disposição!`,
    delay: 1200,
    linkPreview: true
  };
  await this.dispararEvolution(payload);
}

// Método auxiliar para garantir o formato do número
private formatarNumero(tel: string) {
  const limpo = tel.replace(/\D/g, '');
  return limpo.startsWith('55') ? limpo : `55${limpo}`;
}

async enviarWhatsAppFaturaGerada(telefone: string, nome: string, valor: string, vencimento: string, linkFatura: string) {
  const payload = {
    number: this.formatarNumero(telefone),
    text: `📄 *Fatura Disponível - Stellar Syntec*\n\nPrezado(a) *${nome}*,\n\ninformamos que a fatura da sua mensalidade já está disponível para pagamento.\n\n*Vencimento:* ${vencimento}\n*Valor:* R$ ${valor}\n\n*Acesse o documento para pagamento aqui:* \n${linkFatura}\n\nAgradecemos a parceria. Se tiver qualquer dúvida, nossa equipe financeira está à disposição.`,
    delay: 1200,
    linkPreview: true 
  };
  await this.dispararEvolution(payload);
}
}