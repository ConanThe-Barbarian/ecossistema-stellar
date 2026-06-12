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
import { DreService } from './dre.service';
import { CustosFixosService } from './custos-fixos.service';
import { CreateCustoFixoDto, UpdateCustoFixoDto } from './dto/custo-fixo.dto';
import { RegistrarConsumoDto } from './dto/registrar-consumo.dto';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermission } from '../../auth/decorators/permissions.decorator';

@Controller('financeiro')
@UseGuards(PermissionsGuard)
export class DreController {
  constructor(
    private readonly dreService: DreService,
    private readonly custosFixosService: CustosFixosService,
  ) {}

  // ─── DRE (Torre de Controle — só os fundadores) ───

  @Get('dre')
  @RequirePermission('can_manage_users')
  async dreConsolidado(@Query('mes') mes: string) {
    return this.dreService.gerarDre(mes);
  }

  @Get('dre/:empresaId')
  @RequirePermission('can_manage_users')
  async dreCliente(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('mes') mes: string,
  ) {
    return this.dreService.gerarDreCliente(empresaId, mes);
  }

  // ─── Custos Fixos ───

  @Post('custos-fixos')
  @RequirePermission('gestao:contratos')
  async criarCusto(@Body() dto: CreateCustoFixoDto) {
    console.log(`[Stellar Finance] Cadastrando custo fixo: ${dto.descricao}`);
    return this.custosFixosService.criar(dto);
  }

  @Get('custos-fixos')
  @RequirePermission('gestao:contratos')
  async listarCustos(@Query('empresa') empresaId?: string) {
    return this.custosFixosService.listar(empresaId);
  }

  @Patch('custos-fixos/:id')
  @RequirePermission('gestao:contratos')
  async atualizarCusto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustoFixoDto,
  ) {
    return this.custosFixosService.atualizar(id, dto);
  }

  @Delete('custos-fixos/:id')
  @RequirePermission('can_manage_users')
  async removerCusto(@Param('id', ParseUUIDPipe) id: string) {
    return this.custosFixosService.remover(id);
  }

  // ─── Consumo Variável (tokens GalaxIA / APIs) ───

  @Post('consumo')
  @RequirePermission('gestao:contratos')
  async registrarConsumo(@Body() dto: RegistrarConsumoDto) {
    return this.dreService.registrarConsumo(dto);
  }

  @Get('consumo')
  @RequirePermission('gestao:contratos')
  async listarConsumo(
    @Query('empresa') empresaId?: string,
    @Query('mes') mes?: string,
  ) {
    return this.dreService.listarConsumo(empresaId, mes);
  }
}
