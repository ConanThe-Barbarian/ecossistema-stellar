import { Controller, Get, Req } from '@nestjs/common';
import { PortalService } from './portal.service';
import type { AuthenticatedRequest } from '../auth/types/auth.types';

// 🌌 Portal do Cliente — todas as rotas usam a empresa do PRÓPRIO token (JWT),
// então um cliente jamais enxerga dados de outro. Sem permissão especial:
// qualquer usuário autenticado da empresa pode ver.
@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('resumo')
  async resumo(@Req() req: AuthenticatedRequest) {
    return this.portalService.resumo(req.user.empresa_id);
  }

  @Get('ferramentas')
  async ferramentas(@Req() req: AuthenticatedRequest) {
    return this.portalService.ferramentas(req.user.empresa_id);
  }

  @Get('faturas')
  async faturas(@Req() req: AuthenticatedRequest) {
    return this.portalService.faturas(req.user.empresa_id);
  }

  @Get('notificacoes')
  async notificacoes(@Req() req: AuthenticatedRequest) {
    return this.portalService.notificacoes(req.user.empresa_id);
  }
}
