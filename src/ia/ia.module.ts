import { Module } from '@nestjs/common';
import { IaService } from './ia.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [IaService],
  exports: [IaService],
})
export class IaModule {}
