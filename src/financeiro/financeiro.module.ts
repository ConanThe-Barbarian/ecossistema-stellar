import { Module } from '@nestjs/common';
import { AsaasService } from './asaas/asaas.service';
import { FaturasService } from './faturas/faturas.service';
import { FaturasController } from './faturas/faturas.controller';
import { WebhooksController } from './webhooks/webhooks.controller';
import { PrismaModule } from '../prisma/prisma.module'; 
import { NotificationsModule } from '../notifications/notifications.module';
import { PlanosService } from './planos/planos.service'; 
import { PlanosController } from './planos/planos.controller'; 
import { FinanceiroController } from './financeiro.controller';

@Module({
  imports: [
    PrismaModule, // Essencial para o RolesGuard e os Services acessarem o SQL Server
    NotificationsModule
  ], 
  providers: [
    AsaasService, 
    FaturasService, 
    PlanosService
  ], 
  controllers: [
    FaturasController, 
    WebhooksController, 
    PlanosController, 
    FinanceiroController // O controller que acabamos de configurar
  ], 
})
export class FinanceiroModule {}