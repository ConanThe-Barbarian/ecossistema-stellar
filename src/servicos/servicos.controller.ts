import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ServicosService } from './servicos.service';
import { CreateServicoDto, UpdateServicoDto } from './dto/servico.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

@Controller('servicos')
@UseGuards(PermissionsGuard)
export class ServicosController {
  constructor(private readonly servicosService: ServicosService) {}

  @Post()
  @RequirePermission('gestao:contratos')
  async criar(@Body() dto: CreateServicoDto) {
    console.log(`[Stellar Catálogo] Cadastrando serviço: ${dto.nome}`);
    return this.servicosService.criar(dto);
  }

  // Listagem liberada para qualquer usuário autenticado (Portal do Cliente usa)
  @Get()
  async listar(@Query('status') status?: string) {
    return this.servicosService.listarTodos(status);
  }

  @Get(':id')
  async buscarUm(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicosService.buscarPorId(id);
  }

  @Patch(':id')
  @RequirePermission('gestao:contratos')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServicoDto,
  ) {
    return this.servicosService.atualizar(id, dto);
  }
}
