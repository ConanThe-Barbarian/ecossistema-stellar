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
import { ContratosService } from './contratos/contratos.service';
import { ContratosController } from './contratos/contratos.controller';
import { DreService } from './dre/dre.service';
import { CustosFixosService } from './dre/custos-fixos.service';
import { DreController } from './dre/dre.controller';
import { AcessoService } from './acesso/acesso.service';

@Module({
  imports: [
    PrismaModule, // Essencial para o RolesGuard e os Services acessarem o SQL Server
    NotificationsModule
  ],
  providers: [
    AsaasService,
    FaturasService,
    PlanosService,
    ContratosService,
    DreService,
    CustosFixosService,
    AcessoService
  ],
  controllers: [
    FaturasController,
    WebhooksController,
    PlanosController,
    ContratosController,
    DreController,
    FinanceiroController
  ],
})
export class FinanceiroModule {}
