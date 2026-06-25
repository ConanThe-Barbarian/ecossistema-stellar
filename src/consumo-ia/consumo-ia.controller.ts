import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import * as crypto from 'crypto';
import { ConsumoIaService } from './consumo-ia.service';
import { IngestConsumoIaDto } from './dto/ingest-consumo-ia.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('consumo-ia')
export class ConsumoIaController {
  constructor(private readonly service: ConsumoIaService) {}

  // Ingestão a partir do n8n. Protegido por token de header (x-consumo-token).
  @Public()
  @SkipThrottle()
  @Post('ingest')
  async ingest(
    @Body() dto: IngestConsumoIaDto,
    @Headers('x-consumo-token') token: string,
  ) {
    const esperado = Buffer.from(process.env.CONSUMO_IA_TOKEN || 'token_nao_configurado');
    const enviado = Buffer.from(token || 'token_vazio');
    if (esperado.length !== enviado.length || !crypto.timingSafeEqual(esperado, enviado)) {
      throw new UnauthorizedException('Token de ingestão inválido.');
    }
    return this.service.registrar(dto);
  }

  // Consulta/agregação. Só Stellar (validado no serviço).
  @UseGuards(AuthGuard('jwt'))
  @Get()
  async consultar(
    @CurrentUser() usuarioLogado: any,
    @Query('granularidade') granularidade?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('empresa_id') empresa_id?: string,
    @Query('agente') agente?: string,
  ) {
    return this.service.consultar(usuarioLogado, { granularidade, de, ate, empresa_id, agente });
  }

  // Consumo de IA x Teto por cliente (mês). Só Stellar.
  @UseGuards(AuthGuard('jwt'))
  @Get('tetos')
  async tetos(@CurrentUser() usuarioLogado: any, @Query('mes') mes?: string) {
    return this.service.resumoTetos(usuarioLogado, mes);
  }

  // Força a sincronização do excedente no Consumo Variável (além do cron diário). Só Stellar.
  @UseGuards(AuthGuard('jwt'))
  @Post('sincronizar-excedentes')
  async sincronizar(@CurrentUser() usuarioLogado: any, @Query('mes') mes?: string) {
    await this.service.garantirStellarPublico(usuarioLogado);
    return this.service.sincronizarExcedentes(mes);
  }

  // Recalcula o custo dos registros já gravados (retroativo). Só Stellar.
  @UseGuards(AuthGuard('jwt'))
  @Post('recalcular-custos')
  async recalcular(@CurrentUser() usuarioLogado: any) {
    return this.service.recalcularCustos(usuarioLogado);
  }

  // ─── Catálogo de modelos ───
  @UseGuards(AuthGuard('jwt'))
  @Get('modelos')
  async listarModelos(@CurrentUser() usuarioLogado: any) {
    return this.service.listarModelos(usuarioLogado);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('modelos')
  async criarModelo(@CurrentUser() usuarioLogado: any, @Body() dto: any) {
    return this.service.criarModelo(usuarioLogado, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('modelos/:id')
  async atualizarModelo(@CurrentUser() usuarioLogado: any, @Param('id') id: string, @Body() dto: any) {
    return this.service.atualizarModelo(usuarioLogado, id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('modelos/:id')
  async removerModelo(@CurrentUser() usuarioLogado: any, @Param('id') id: string) {
    return this.service.removerModelo(usuarioLogado, id);
  }

  // ─── Agentes do cliente x modelo ───
  @UseGuards(AuthGuard('jwt'))
  @Get('clientes')
  async clientes(@CurrentUser() usuarioLogado: any) {
    return this.service.listarClientes(usuarioLogado);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('agentes')
  async agentes(
    @CurrentUser() usuarioLogado: any,
    @Query('empresa_id') empresaId: string,
    @Query('mes') mes?: string,
  ) {
    return this.service.listarAgentes(usuarioLogado, empresaId, mes);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('agentes/:id')
  async atualizarAgente(
    @CurrentUser() usuarioLogado: any,
    @Param('id') id: string,
    @Body() dto: { modelo_id: string | null },
  ) {
    return this.service.atualizarAgenteModelo(usuarioLogado, id, dto?.modelo_id ?? null);
  }
}
