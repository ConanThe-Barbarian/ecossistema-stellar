import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto, ResetarSenhaDto } from './dto/update-usuario.dto';
import { CreatePerfilAcessoDto } from './dto/perfil-acesso.dto';

@Controller('usuarios')
@UseGuards(RolesGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @Permissions('can_manage_users')
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.usuariosService.listarUsuarios(req.user.empresa_id, req.userScope);
  }

  // ─── Perfis de Acesso (declarar ANTES de :id para não conflitar) ───

  @Get('perfis')
  @Permissions('can_manage_users')
  async listarPerfis() {
    return this.usuariosService.listarPerfis();
  }

  @Post('perfis')
  @Permissions('can_manage_users')
  async criarPerfil(
    @Body() dto: CreatePerfilAcessoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    console.log(`[Stellar Usuários] Criando perfil de acesso: ${dto.nome}`);
    return this.usuariosService.criarPerfil(dto, req.userScope);
  }

  // ─── CRUD de Usuários ───

  @Post()
  @Permissions('can_manage_users')
  async criar(
    @Body() dto: CreateUsuarioDto,
    @Req() req: AuthenticatedRequest,
  ) {
    console.log(`[Stellar Usuários] Criando usuário: ${dto.email}`);
    return this.usuariosService.criar(dto, req.user.empresa_id, req.userScope);
  }

  @Get(':id')
  @Permissions('can_manage_users')
  async buscarUm(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usuariosService.buscarPorId(id, req.user.empresa_id, req.userScope);
  }

  @Patch(':id')
  @Permissions('can_manage_users')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUsuarioDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usuariosService.atualizar(id, dto, req.user.empresa_id, req.userScope);
  }

  @Patch(':id/senha')
  @Permissions('can_manage_users')
  async resetarSenha(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetarSenhaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    console.log(`[Stellar Usuários] Reset de senha para usuário ID: ${id}`);
    return this.usuariosService.resetarSenha(id, dto, req.user.empresa_id, req.userScope);
  }

  @Delete(':id')
  @Permissions('can_manage_users')
  async remover(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    console.log(`[Stellar Usuários] Removendo (soft-delete) usuário ID: ${id}`);
    return this.usuariosService.remover(id, req.user.id, req.user.empresa_id, req.userScope);
  }
}
