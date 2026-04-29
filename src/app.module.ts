import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service'; 
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ChamadosModule } from './chamados/chamados.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { FinanceiroModule } from './financeiro/financeiro.module';

@Module({
  imports: [AuthModule, PrismaModule, ChamadosModule, RelatoriosModule, FinanceiroModule],
  controllers: [AppController],
  providers: [AppService, PrismaService], 
})
export class AppModule {}