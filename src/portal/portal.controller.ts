import { Controller, Get, Post, Param, Body, Req } from '@nestjs/common';
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
    return this.portalService.notificacoes(req.user);
  }

  // "Contratar" uma solução do catálogo: abre solicitação interna pra Stellar.
  @Post('contratar/:servicoId')
  async contratar(
    @Req() req: AuthenticatedRequest,
    @Param('servicoId') servicoId: string,
    @Body() body: { respostas?: { label: string; valor: string }[] },
  ) {
    return this.portalService.contratar(req.user, servicoId, body?.respostas);
  }
}
