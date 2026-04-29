import { Module } from '@nestjs/common';
import { AsaasService } from './asaas/asaas.service';
import { WebhooksController } from './webhooks/webhooks.controller';
import { FaturasService } from './faturas/faturas.service';
import { FaturasController } from './faturas/faturas.controller';
import { NotificationsModule } from '../notifications/notifications.module'; // 🚀 Importação do novo módulo

@Module({
  imports: [NotificationsModule],
  providers: [AsaasService, FaturasService],
  controllers: [WebhooksController, FaturasController]
})
export class FinanceiroModule {}