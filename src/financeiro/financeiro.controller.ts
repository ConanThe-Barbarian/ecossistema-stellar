import { Controller, Post, UseGuards, Req } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/types/auth.types';

@Controller('financeiro')
@UseGuards(RolesGuard)
export class FinanceiroController {
  
  @Post('gerar-fatura')
  @Permissions('can_generate_invoices')
  async gerarFatura(@Req() req: AuthenticatedRequest) {
    const { userScope, user } = req;

    if (userScope === 'global') {
      return { status: 'success', message: 'Geração de faturas liberada para todo o ecossistema (Modo Super Admin).' };
    }

    return { status: 'success', message: `Fatura gerada para a empresa ${user.empresa_id} (Modo Local).` };
  }
}