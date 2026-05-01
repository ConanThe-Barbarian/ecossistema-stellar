import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class WebhooksService {
  // Lê diretamente do ambiente, eliminando a URL hardcoded
  private readonly N8N_URL = process.env.N8N_WEBHOOK_URL;
  private readonly logger = new Logger(WebhooksService.name);

  constructor() {
    if (!this.N8N_URL) {
      this.logger.warn('Aviso: N8N_WEBHOOK_URL não está configurada no arquivo .env');
    }
  }

  async dispararEvento(evento: string, dados: any) {
    if (!this.N8N_URL) {
      this.logger.error('[Stellar Webhook] URL do webhook não definida. Abortando disparo.');
      return;
    }

    try {
      await axios.post(this.N8N_URL, {
        timestamp: new Date().toISOString(),
        evento,
        payload: dados
      });
    } catch (error) {
      // O PULO DO GATO: Verifica se o erro é uma instância de Error
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`[Stellar Webhook] Erro ao disparar para n8n:`, mensagem);
    }
  }
}