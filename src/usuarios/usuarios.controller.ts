import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/types/auth.types';

@Controller('usuarios')
@UseGuards(RolesGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @Permissions('can_manage_users')
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.usuariosService.listarUsuarios(req.user.empresa_id, req.userScope);
  }
}