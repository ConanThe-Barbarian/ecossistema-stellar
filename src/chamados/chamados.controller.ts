import { Controller, Post, Get, Patch, Body, Param, Req, Res, UseGuards, ParseUUIDPipe, UseInterceptors, UploadedFile, BadRequestException, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { join, basename } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { fileTypeFromFile } from 'file-type'; // 🛡️ Importação para checar o DNA do arquivo
import { ChamadosService } from './chamados.service';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateChamadoDto } from './dto/create-chamado.dto';
import { UpdateChamadoDto } from './dto/update-chamado.dto';
import { CreateInteracaoDto } from './dto/create-interacao.dto';
import { multerConfig } from './utils/upload.config';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('chamados')
@UseGuards(PermissionsGuard)
export class ChamadosController {
  constructor(private readonly chamadosService: ChamadosService) {}

  @RequirePermission('can_open_internal_ticket')
  @Post()
  async abrirChamado(
    @Body() body: CreateChamadoDto,
    @CurrentUser('userId') usuarioId: string,
    @CurrentUser('empresa_id') empresaId: string,
  ) {
    const chamado = await this.chamadosService.criarChamado(body, usuarioId, empresaId);
    return { message: 'Chamado aberto com sucesso na Stellar Syntec!', ticket: chamado };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async listarChamados(@CurrentUser() usuarioLogado: any) {
    const chamados = await this.chamadosService.listarChamados(usuarioLogado);
    return { message: 'Listagem de chamados recuperada.', total_encontrado: chamados.length, dados: chamados };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async buscarChamadoPorId(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuarioLogado: any,
  ) {
    const ticket = await this.chamadosService.buscarPorId(id, usuarioLogado);
    return { message: 'Detalhes recuperados.', dados: ticket };
  }

  @RequirePermission('can_manage_users')
  @Patch(':id')
  async atualizarChamado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateChamadoDto,
    @CurrentUser() usuarioLogado: any,
  ) {
    const ticketAtualizado = await this.chamadosService.atualizarChamado(id, body, usuarioLogado);
    return { message: 'Status atualizado com sucesso!', dados: ticketAtualizado };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/interacoes')
  async adicionarInteracao(
    @Param('id', ParseUUIDPipe) chamadoId: string,
    @Body() body: CreateInteracaoDto,
    @CurrentUser() usuarioLogado: any,
  ) {
    const mensagem = await this.chamadosService.enviarMensagem(chamadoId, body, usuarioLogado);
    return { message: 'Mensagem registrada!', dados: mensagem };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/interacoes/:interacaoId/anexos')
  @UseInterceptors(FileInterceptor('arquivo', multerConfig))
  async fazerUploadAnexoNaInteracao(
    @Param('id', ParseUUIDPipe) chamadoId: string,
    @Param('interacaoId', ParseUUIDPipe) interacaoId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() usuarioLogado: any,
  ) {
    if (!file) throw new BadRequestException('Nenhum ficheiro válido foi enviado.');

    // 🛡️ Defesa de Magic Numbers: Verifica o DNA real do arquivo
    const fileType = await fileTypeFromFile(file.path);
    const tiposPermitidos = ['image/jpeg', 'image/png', 'application/pdf'];
    
    if (!fileType || !tiposPermitidos.includes(fileType.mime)) {
      unlinkSync(file.path); // Apaga a ameaça do servidor
      throw new BadRequestException('Ameaça detectada: Arquivo corrompido ou disfarçado.');
    }

    const anexo = await this.chamadosService.adicionarAnexo(chamadoId, file, usuarioLogado, interacaoId);
    return { message: 'Evidência anexada com sucesso!', dados: anexo };
  }

  // 🛡️ Proxy de Mídia: Apenas usuários logados podem ver os anexos!
  @UseGuards(AuthGuard('jwt'))
  @Get('anexo/:nomeArquivo')
  async verAnexo(@Param('nomeArquivo') nomeArquivo: string, @Res() res: Response) {
    const filePath = join(process.cwd(), 'uploads', 'chamados', basename(nomeArquivo));
    if (!existsSync(filePath)) throw new NotFoundException('Anexo não encontrado.');
    return res.sendFile(filePath);
  }

  @RequirePermission('can_manage_users')
  @Post('reparar-slas')
  async repararSlas() { return this.chamadosService.repararSlasLegados(); }

  @Get('analytics/resumo')
  async obterResumoAnalytics(@Req() req: any) { return this.chamadosService.gerarResumoAnalytics(req.user); }

  @Get('analytics/sla')
  async obterAnalyticsSla(@Req() req: any) { return this.chamadosService.gerarSlaAnalytics(req.user); }

  @Get('analytics/performance')
  async obterAnalyticsPerformance(@Req() req: any) { return this.chamadosService.gerarPerformanceAnalytics(req.user); }

  @Get('analytics/insights')
  async obterAnalyticsInsights(@Req() req: any) { return this.chamadosService.gerarInsightsAnalytics(req.user); }

  @Get('analytics/workload')
  async obterWorkloadEquipe(@Req() req: any) { return this.chamadosService.calcularWorkloadEquipe(req.user); }

  @Get('analytics/produtividade')
  async obterProdutividadeEquipe(@Req() req: any) { return this.chamadosService.calcularProdutividadeEquipe(req.user); }

  @Get('workload/sugerir-tecnico')
  async sugerirMelhorTecnico(@Req() req: any) { return this.chamadosService.sugerirMelhorTecnico(req.user); }

  @Post(':id/testar-automacao')
  async testarAutomacao(@Param('id') id: string) { return this.chamadosService.atribuirChamadoAutomaticamente(id); }
}