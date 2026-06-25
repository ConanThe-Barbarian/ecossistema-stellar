import { Module } from '@nestjs/common';
import { ConsumoIaService } from './consumo-ia.service';
import { ConsumoIaController } from './consumo-ia.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConsumoIaController],
  providers: [ConsumoIaService],
  exports: [ConsumoIaService],
})
export class ConsumoIaModule {}
