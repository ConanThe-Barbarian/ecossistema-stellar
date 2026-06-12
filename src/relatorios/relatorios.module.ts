import { Module } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';
import { RelatoriosController } from './relatorios.controller';
import { WebhooksService } from '../webhooks/webhooks.service';

@Module({
  providers: [RelatoriosService, WebhooksService],
  controllers: [RelatoriosController]
})
export class RelatoriosModule {}
