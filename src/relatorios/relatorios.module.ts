import { Module } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';
import { RelatoriosController } from './relatorios.controller';

@Module({
  providers: [RelatoriosService],
  controllers: [RelatoriosController]
})
export class RelatoriosModule {}
