import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { join, basename } from 'path';
import { existsSync } from 'fs';
import { ContratosService } from './contratos.service';
import { CreateContratoDto } from './dto/create-contrato.dto';
import { UpdateContratoDto } from './dto/update-contrato.dto';
import { AddFerramentaDto } from './dto/add-ferramenta.dto';
import { multerContratoConfig } from './upload-contrato.config';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermission } from '../../auth/decorators/permissions.decorator';

@Controller('financeiro/contratos')
@UseGuards(PermissionsGuard) // 🛡️ Contratos são o coração financeiro: acesso restrito
export class ContratosController {
  constructor(private readonly contratosService: ContratosService) {}

  @Post()
  @RequirePermission('gestao:contratos')
  async criar(@Body() dto: CreateContratoDto) {
    console.log(`[Stellar Finance] Criando contrato para empresa ${dto.empresa_id}`);
    return this.contratosService.criar(dto);
  }

  @Get()
  @RequirePermission('gestao:contratos')
  async listar(
    @Query('status') status?: string,
    @Query('empresa') empresaId?: string,
  ) {
    return this.contratosService.listarTodos({ status, empresa_id: empresaId });
  }

  @Get(':id')
  @RequirePermission('gestao:contratos')
  async buscarUm(@Param('id', ParseUUIDPipe) id: string) {
    return this.contratosService.buscarPorId(id);
  }

  @Patch(':id')
  @RequirePermission('gestao:contratos')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContratoDto,
  ) {
    return this.contratosService.atualizar(id, dto);
  }

  @Delete(':id')
  @RequirePermission('can_manage_users') // Cancelar contrato exige permissão master
  async cancelar(@Param('id', ParseUUIDPipe) id: string) {
    console.log(`[Stellar Finance] Cancelando contrato ID: ${id}`);
    return this.contratosService.cancelar(id);
  }

  // ─── Arquivo do contrato assinado (upload/visualização) ───

  @Post(':id/arquivo')
  @RequirePermission('gestao:contratos')
  @UseInterceptors(FileInterceptor('arquivo', multerContratoConfig))
  async uploadArquivo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
    return this.contratosService.salvarArquivoContrato(id, file.filename, file.originalname);
  }

  @Get(':id/arquivo')
  @RequirePermission('gestao:contratos')
  async baixarArquivo(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const contrato = await this.contratosService.buscarPorId(id);
    if (!contrato.arquivo_contrato) {
      throw new NotFoundException('Este contrato ainda não tem arquivo anexado.');
    }
    const filePath = join(process.cwd(), 'uploads', 'contratos', basename(contrato.arquivo_contrato));
    if (!existsSync(filePath)) throw new NotFoundException('Arquivo não encontrado no servidor.');
    return res.sendFile(filePath);
  }

  // ─── Ferramentas Contratadas (SSO do Portal do Cliente) ───

  @Post(':id/ferramentas')
  @RequirePermission('gestao:contratos')
  async adicionarFerramenta(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddFerramentaDto,
  ) {
    return this.contratosService.adicionarFerramenta(id, dto);
  }

  @Patch(':id/ferramentas/:servicoId/liberar')
  @RequirePermission('gestao:contratos')
  async liberarAcesso(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('servicoId', ParseUUIDPipe) servicoId: string,
  ) {
    return this.contratosService.alterarAcessoFerramenta(id, servicoId, 'LIBERADO');
  }

  @Patch(':id/ferramentas/:servicoId/bloquear')
  @RequirePermission('gestao:contratos')
  async bloquearAcesso(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('servicoId', ParseUUIDPipe) servicoId: string,
  ) {
    return this.contratosService.alterarAcessoFerramenta(id, servicoId, 'BLOQUEADO');
  }

  @Delete(':id/ferramentas/:servicoId')
  @RequirePermission('gestao:contratos')
  async removerFerramenta(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('servicoId', ParseUUIDPipe) servicoId: string,
  ) {
    return this.contratosService.removerFerramenta(id, servicoId);
  }
}
