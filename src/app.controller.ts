import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { RequirePermission } from './auth/decorators/permissions.decorator';
import { CurrentUser } from './auth/decorators/current-user.decorator';

@Controller()
export class AppController {
  // Injeta o AppService aqui!
  constructor(private readonly appService: AppService) {}
  
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('can_manage_users')
  @Get()
  getHello(@CurrentUser() usuarioDaSessao) { 
    return {
      message: `Acesso Confirmado, ${usuarioDaSessao.nome}!`,
      dados_da_sessao: usuarioDaSessao 
    };
  }

  // Rota para dar o "Start" no Motor de SLAs
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('can_manage_users') // Apenas super admins como você podem rodar isso!
  @Post('setup-slas')
  async configurarSlabase() {
    return this.appService.setupPlanosESlas();
  }
}