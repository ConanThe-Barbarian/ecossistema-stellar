import { Controller, Get, Param, Query, Res, UseGuards, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { RelatoriosService } from './relatorios.service';
import { ApiKeyGuard } from './api-key.guard';

@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  // ROTA 1: Dashboard JSON dos Gestores
  @Get('gestao')
  async dashboardGestao(
    @Query('mes') mes: string,
    @Query('ano') ano: string,
    @Query('empresaId') empresaId?: string 
  ) {
    const mesNum = mes ? parseInt(mes, 10) : new Date().getMonth() + 1;
    const anoNum = ano ? parseInt(ano, 10) : new Date().getFullYear();
    return this.relatoriosService.gerarRelatorioCompleto(mesNum, anoNum, empresaId);
  }

  // ROTA 2: Exportar PDF dos Gestores (Visão Global)
  @Get('exportar/gestao')
  async exportarPdfGestao(
    @Query('mes') mes: string,
    @Query('ano') ano: string,
  ) {
    const mesNum = mes ? parseInt(mes, 10) : new Date().getMonth() + 1;
    const anoNum = ano ? parseInt(ano, 10) : new Date().getFullYear();
    
    // 1. Gera os dados
    const dados = await this.relatoriosService.gerarRelatorioCompleto(mesNum, anoNum);
    // 2. Manda pra fábrica de PDF
    return this.relatoriosService.exportarPdfSla(dados);
  }

  // ROTA 3: Exportar PDF do Cliente (Filtro por ID obrigatório)
  @Get('exportar/cliente/:empresaId')
  async exportarPdfCliente(
    @Param('empresaId') empresaId: string,
    @Query('mes') mes: string,
    @Query('ano') ano: string
  ) {
    const mesNum = mes ? parseInt(mes, 10) : new Date().getMonth() + 1;
    const anoNum = ano ? parseInt(ano, 10) : new Date().getFullYear();
    
    // 1. Gera os dados isolados do cliente
    const dados = await this.relatoriosService.gerarRelatorioCompleto(mesNum, anoNum, empresaId);
    // 2. Manda pra fábrica de PDF
    return this.relatoriosService.exportarPdfSla(dados);
  }

@Get('download/:nomeArquivo')
  @UseGuards(ApiKeyGuard) // 🔒 Trava ativada!
  async baixarRelatorio(
    @Param('nomeArquivo') nomeArquivo: string,
    @Res() res: Response
  ) {
    const filePath = join(process.cwd(), 'uploads', 'relatorios', nomeArquivo);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Relatório não encontrado no Ecossistema Stellar.');
    }

    const file = createReadStream(filePath);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`, 
    });

    file.pipe(res);
  }
}