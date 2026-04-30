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

@Module({
  imports: [AuthModule, PrismaModule, ChamadosModule, RelatoriosModule, ScheduleModule.forRoot(), FinanceiroModule],
  controllers: [AppController],
  providers: [
    AppService, 
    PrismaService, 
    {
      provide: APP_GUARD, 
      useClass: JwtAuthGuard
    }
  ], 
})
export class AppModule {}