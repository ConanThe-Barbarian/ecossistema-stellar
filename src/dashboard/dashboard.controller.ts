import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

// 🗼 Torre de Controle: visão macro exclusiva dos fundadores
@Controller('dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('executivo')
  @Permissions('can_manage_users')
  async executivo(@Query('mes') mes?: string) {
    return this.dashboardService.executivo(mes);
  }

  @Get('evolucao-mrr')
  @Permissions('can_manage_users')
  async evolucaoMrr(@Query('meses') meses?: string) {
    const qtd = Math.min(Math.max(parseInt(meses ?? '6', 10) || 6, 1), 24);
    return this.dashboardService.evolucaoMrr(qtd);
  }
}
