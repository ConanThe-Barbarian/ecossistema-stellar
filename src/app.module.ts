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

@Module({
  imports: [
    AuthModule, 
    PrismaModule, 
    ChamadosModule, 
    RelatoriosModule, 
    ScheduleModule.forRoot(), 
    UsuariosModule,
    FinanceiroModule,
    // Configuração: Limita a 100 requisições por minuto por IP
    ThrottlerModule.forRoot([{
      ttl: 60000, // Tempo em milissegundos (60 segundos)
      limit: 100, // Número máximo de chamadas
    }]),
    UsuariosModule,
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