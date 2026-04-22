import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service'; // Importa o serviço
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ChamadosModule } from './chamados/chamados.module';
import { RelatoriosModule } from './relatorios/relatorios.module';

@Module({
  imports: [AuthModule, PrismaModule, ChamadosModule, RelatoriosModule],
  controllers: [AppController],
  providers: [AppService, PrismaService], // Adiciona o PrismaService aqui
})
export class AppModule {}