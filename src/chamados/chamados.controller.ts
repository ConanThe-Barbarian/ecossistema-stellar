import { Controller, Post, Get, Patch, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ChamadosService } from './chamados.service';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateChamadoDto } from './dto/create-chamado.dto'; // <-- Importe o DTO
import { UpdateChamadoDto } from './dto/update-chamado.dto';
import { CreateInteracaoDto } from './dto/create-interacao.dto';

@Controller('chamados')
export class ChamadosController {
  constructor(private readonly chamadosService: ChamadosService) {}

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('can_open_internal_ticket')
  @Post()
  async abrirChamado(
    @Body() body: CreateChamadoDto, // <-- Trocamos o 'any' pelo DTO!
    @CurrentUser('userId') usuarioId: string,
    @CurrentUser('empresa_id') empresaId: string,
  ) {
    const chamado = await this.chamadosService.criarChamado(body, usuarioId, empresaId);
    
    return {
      message: 'Chamado aberto com sucesso na Stellar Syntec!',
      ticket: chamado,
    };
  }

  @UseGuards(AuthGuard('jwt')) // Exige que esteja logado, mas qualquer usuário pode tentar listar os seus próprios
  @Get()
  async listarChamados(@CurrentUser() usuarioLogado: any) {
    // Aqui nós passamos o objeto inteiro que extraímos do JWT para o Service tomar a decisão
    const chamados = await this.chamadosService.listarChamados(usuarioLogado);
    
    return {
      message: 'Listagem de chamados recuperada com sucesso.',
      total_encontrado: chamados.length,
      dados: chamados,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async buscarChamadoPorId(
    @Param('id', ParseUUIDPipe) id: string, // Segurança: Valida se é um UUID correto
    @CurrentUser() usuarioLogado: any, // Extrai quem está pedindo
  ) {
    // Passa a bola pro Service fazer a busca segura
    const ticket = await this.chamadosService.buscarPorId(id, usuarioLogado);
    
    return {
      message: 'Detalhes do chamado recuperados com sucesso.',
      dados: ticket,
    };
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('can_manage_users') // O Bloco 3 brilhando aqui: só a Stellar altera!
  @Patch(':id')
  async atualizarChamado(
    @Param('id', ParseUUIDPipe) id: string, // Segurança extra contra injeções na URL
    @Body() body: UpdateChamadoDto, // O Contrato do Bloco 1 garantindo dados limpos
    @CurrentUser() usuarioLogado: any, // A identidade para o "escudo" do Service
  ) {
    const ticketAtualizado = await this.chamadosService.atualizarChamado(id, body, usuarioLogado);
    
    return {
      message: 'Status/Atribuição do chamado atualizado com sucesso!',
      dados: ticketAtualizado,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  // Rota aninhada para ficar semântico: /chamados/:id/interacoes
  @Post(':id/interacoes') 
  async adicionarInteracao(
    @Param('id', ParseUUIDPipe) chamadoId: string,
    @Body() body: CreateInteracaoDto,
    @CurrentUser() usuarioLogado: any,
  ) {
    const mensagem = await this.chamadosService.enviarMensagem(chamadoId, body, usuarioLogado);
    
    return {
      message: 'Mensagem registrada com sucesso!',
      dados: mensagem,
    };
  }
}