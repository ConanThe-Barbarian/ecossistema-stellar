import { Controller, Post, Get, Param, Delete, Body, UseGuards } from '@nestjs/common';
import { PlanosService } from './planos.service';
import { CreatePlanoDto } from './dto/create-plano.dto';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermission } from '../../auth/decorators/permissions.decorator';

@Controller('financeiro/planos')
@UseGuards(PermissionsGuard) // 🛡️ Protege as rotas com níveis de permissão
export class PlanosController {
  constructor(private readonly planosService: PlanosService) {}

  @Post()
  @RequirePermission('financeiro:planos') // Apenas gestores financeiros podem criar
  async criar(@Body() createPlanoDto: CreatePlanoDto) {
    console.log(`[Stellar Finance] Cadastrando novo plano: ${createPlanoDto.nome}`);
    return this.planosService.criar(createPlanoDto);
  }

  @Get()
  @RequirePermission('financeiro:planos') 
  async listar() {
    return this.planosService.listarTodos();
  }

  @Get(':id')
  @RequirePermission('financeiro:planos')
  async buscarUm(@Param('id') id: string) {
    return this.planosService.buscarPorId(id);
  }

  @Delete(':id')
  @RequirePermission('can_manage_users') // Deletar é mais critico, exige permissão master
  async remover(@Param('id') id: string) {
    console.log(`[Stellar Finance] Removendo plano ID: ${id}`);
    return this.planosService.remover(id);
  }
}