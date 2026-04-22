import { Module } from '@nestjs/common';
import { ChamadosService } from './chamados.service';
import { ChamadosController } from './chamados.controller';
import { PrismaModule } from '../prisma/prisma.module'; // 1. Importe o PrismaModule
import { WebhooksService } from '../webhooks/webhooks.service';

@Module({
  imports: [PrismaModule], // 2. Coloque o PrismaModule dentro do array de imports
  providers: [ChamadosService, WebhooksService],
  controllers: [ChamadosController],
})
export class ChamadosModule {}