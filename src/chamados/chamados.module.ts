import { Module } from '@nestjs/common';
import { ChamadosService } from './chamados.service';
import { ChamadosController } from './chamados.controller';
import { PrismaModule } from '../prisma/prisma.module'; // 1. Importe o PrismaModule

@Module({
  imports: [PrismaModule], // 2. Coloque o PrismaModule dentro do array de imports
  providers: [ChamadosService],
  controllers: [ChamadosController],
})
export class ChamadosModule {}