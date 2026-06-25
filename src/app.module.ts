import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ChamadosModule } from './chamados/chamados.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { FinanceiroModule } from './financeiro/financeiro.module';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { UsuariosModule } from './usuarios/usuarios.module';
import { EmpresasModule } from './empresas/empresas.module';
import { ServicosModule } from './servicos/servicos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PortalModule } from './portal/portal.module';
import { ConsumoIaModule } from './consumo-ia/consumo-ia.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    ChamadosModule,
    RelatoriosModule,
    ScheduleModule.forRoot(),
    UsuariosModule,
    FinanceiroModule,
    EmpresasModule,
    ServicosModule,
    DashboardModule,
    PortalModule,
    ConsumoIaModule,
    // Configuração: Limita a 100 requisições por minuto por IP
    ThrottlerModule.forRoot([{
      ttl: 60000, // Tempo em milissegundos (60 segundos)
      limit: 100, // Número máximo de chamadas
    }]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    // Ativa o escudo de força bruta no sistema inteiro
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ],
})
export class AppModule {}
