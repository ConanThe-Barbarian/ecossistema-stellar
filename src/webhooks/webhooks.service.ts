import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class WebhooksService {
  private readonly N8N_URL = 'https://webhook.stellarsyntec.com.br/webhook/notificachamado'; // Coloque sua URL de Webhook do n8n

async dispararEvento(evento: string, dados: any) {
    try {
      await axios.post(this.N8N_URL, {
        timestamp: new Date().toISOString(),
        evento,
        payload: dados
      });
    } catch (error) {
      // ✨ O PULO DO GATO: Verifica se o erro é uma instância de Error
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`[Stellar Webhook] Erro ao disparar para n8n:`, mensagem);
    }
  }
}