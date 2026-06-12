import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EmpresasService } from './empresas.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

@Controller('empresas')
@UseGuards(PermissionsGuard) // 🛡️ Gestão de clientes é restrita (Torre de Controle)
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @Post()
  @RequirePermission('gestao:empresas')
  async criar(@Body() dto: CreateEmpresaDto) {
    console.log(`[Stellar Gestão] Cadastrando empresa: ${dto.razao_social}`);
    return this.empresasService.criar(dto);
  }

  @Get()
  @RequirePermission('gestao:empresas')
  async listar(
    @Query('status') status?: string,
    @Query('tipo') tipo?: string,
  ) {
    return this.empresasService.listarTodas({ status, tipo_empresa: tipo });
  }

  @Get(':id')
  @RequirePermission('gestao:empresas')
  async buscarUma(@Param('id', ParseUUIDPipe) id: string) {
    return this.empresasService.buscarPorId(id);
  }

  @Patch(':id')
  @RequirePermission('gestao:empresas')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmpresaDto,
  ) {
    return this.empresasService.atualizar(id, dto);
  }

  @Delete(':id')
  @RequirePermission('can_manage_users') // Remoção exige permissão master
  async remover(@Param('id', ParseUUIDPipe) id: string) {
    console.log(`[Stellar Gestão] Removendo (soft-delete) empresa ID: ${id}`);
    return this.empresasService.remover(id);
  }
}
