import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { RequirePermission } from './auth/decorators/permissions.decorator';
import { CurrentUser } from './auth/decorators/current-user.decorator'; // Importe aqui!

@Controller()
export class AppController {
  
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('can_manage_users')
  @Get()
  getHello(@CurrentUser() usuarioDaSessao) { // Olha a mágica aqui!
    return {
      message: `Acesso Confirmado, ${usuarioDaSessao.nome}!`,
      dados_da_sessao: usuarioDaSessao // Não precisa mais do req.user
    };
  }
}