import { Controller, Get, Param, Query, Res, UseGuards, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join, basename } from 'path';
import { RelatoriosService } from './relatorios.service';
import { ApiKeyGuard } from './api-key.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  // ROTA 1: Dashboard JSON
  @Get('gestao')
  async dashboardGestao(
    @CurrentUser() usuario: any, // 💉 Injeta o usuario logado
    @Query('mes') mes: string,
    @Query('ano') ano: string,
    @Query('empresaId') empresaId?: string 
  ) {
    // 🛡️ Bloqueio IDOR: Se não for admin, força a busca apenas para o ID da própria empresa
    const empresaAlvo = this.isAdmin(usuario) ? empresaId : usuario.empresa_id;

    const mesNum = mes ? parseInt(mes, 10) : new Date().getMonth() + 1;
    const anoNum = ano ? parseInt(ano, 10) : new Date().getFullYear();
    return this.relatoriosService.gerarRelatorioCompleto(mesNum, anoNum, empresaAlvo);
  }

  // ROTA 2: Exportar PDF (Visão Global - APENAS ADMINS)
  @Get('exportar/gestao')
  async exportarPdfGestao(
    @CurrentUser() usuario: any,
    @Query('mes') mes: string,
    @Query('ano') ano: string,
  ) {
    // 🛡️ Bloqueio de Acesso: Clientes normais param aqui
    if (!this.isAdmin(usuario)) {
      throw new UnauthorizedException('Apenas gestores podem exportar o relatório global.');
    }

    const mesNum = mes ? parseInt(mes, 10) : new Date().getMonth() + 1;
    const anoNum = ano ? parseInt(ano, 10) : new Date().getFullYear();
    const dados = await this.relatoriosService.gerarRelatorioCompleto(mesNum, anoNum);
    return this.relatoriosService.exportarPdfSla(dados);
  }

  // ROTA 3: Exportar PDF do Cliente
  @Get('exportar/cliente/:empresaId')
  async exportarPdfCliente(
    @CurrentUser() usuario: any,
    @Param('empresaId') empresaId: string,
    @Query('mes') mes: string,
    @Query('ano') ano: string
  ) {
    // 🛡️ Bloqueio IDOR crítico: Valida se o cliente está pedindo dados da PRÓPRIA empresa
    if (!this.isAdmin(usuario) && usuario.empresa_id !== empresaId) {
      throw new UnauthorizedException('Você não tem permissão para acessar relatórios de outra empresa.');
    }

    const mesNum = mes ? parseInt(mes, 10) : new Date().getMonth() + 1;
    const anoNum = ano ? parseInt(ano, 10) : new Date().getFullYear();
    const dados = await this.relatoriosService.gerarRelatorioCompleto(mesNum, anoNum, empresaId);
    return this.relatoriosService.exportarPdfSla(dados);
  }

  // ROTA 4: Download (Permanece protegida apenas pelo Path Traversal e ApiKey)
  @Public()
  @Get('download/:nomeArquivo')
  @UseGuards(ApiKeyGuard)
  async baixarRelatorio(
    @Param('nomeArquivo') nomeArquivo: string,
    @Res() res: Response
  ) {
    const nomeSanitizado = basename(nomeArquivo); 
    const filePath = join(process.cwd(), 'uploads', 'relatorios', nomeSanitizado);

    if (!filePath.startsWith(join(process.cwd(), 'uploads', 'relatorios'))) {
        throw new NotFoundException('Tentativa de acesso inválida bloqueada.');
    }

    if (!existsSync(filePath)) {
      throw new NotFoundException('Relatório não encontrado no Ecossistema Stellar.');
    }

    const file = createReadStream(filePath);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomeSanitizado}"`, 
    });

    file.pipe(res);
  }

  // Função auxiliar de checagem
  private isAdmin(usuario: any): boolean {
    // Verifica a permissão base (ajuste conforme a nomenclatura do seu JWT/banco)
    return usuario?.permissoes?.includes('can_manage_users') === true;
  }
}