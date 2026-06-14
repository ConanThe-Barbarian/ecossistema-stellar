import { Module } from '@nestjs/common';
import { ChamadosService } from './chamados.service';
import { ChamadosController } from './chamados.controller';
import { WhatsappWebhookController } from './whatsapp.controller';
import { PrismaModule } from '../prisma/prisma.module'; // 1. Importe o PrismaModule
import { IaModule } from '../ia/ia.module';
import { WebhooksService } from '../webhooks/webhooks.service';

@Module({
  imports: [PrismaModule, IaModule],
  providers: [ChamadosService, WebhooksService],
  controllers: [ChamadosController, WhatsappWebhookController],
})
export class ChamadosModule {}
