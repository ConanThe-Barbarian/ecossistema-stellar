import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ChamadosService } from './chamados.service';
import { Public } from '../auth/decorators/public.decorator';
import * as crypto from 'crypto';

/**
 * Webhook de entrada do omnichannel (WhatsApp via n8n + EvolutionAPI).
 * O n8n deve chamar POST /chamados/webhooks/whatsapp com o header
 * `x-webhook-token: <WHATSAPP_WEBHOOK_TOKEN>` e um corpo contendo o telefone
 * do remetente e o texto da mensagem (aceita telefone|phone|number|from e
 * mensagem|message|text). A resposta traz um campo `reply` para o n8n devolver
 * ao usuário no WhatsApp.
 */
@Controller('chamados/webhooks')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(private readonly chamadosService: ChamadosService) {}

  @Public()
  @Post('whatsapp')
  @HttpCode(HttpStatus.OK)
  async receber(@Body() payload: any, @Headers('x-webhook-token') token: string) {
    const esperado = Buffer.from(
      process.env.WHATSAPP_WEBHOOK_TOKEN || 'token_nao_configurado',
    );
    const recebido = Buffer.from(token || 'vazio');

    if (
      esperado.length !== recebido.length ||
      !crypto.timingSafeEqual(esperado, recebido)
    ) {
      this.logger.warn('Webhook WhatsApp: token ausente ou inválido. Acesso negado.');
      throw new UnauthorizedException('Token de webhook inválido.');
    }

    return this.chamadosService.processarMensagemWhatsApp(payload);
  }
}
