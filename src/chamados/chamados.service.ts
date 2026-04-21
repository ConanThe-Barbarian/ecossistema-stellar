import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateChamadoDto } from './dto/update-chamado.dto';
import { CreateInteracaoDto } from './dto/create-interacao.dto';

@Injectable()
export class ChamadosService {
  constructor(private prisma: PrismaService) {}

  async criarChamado(dados: any, usuarioId: string, empresaId: string) {
    return this.prisma.chamados.create({
      data: {
        titulo: dados.titulo,
        descricao: dados.descricao,
        prioridade: dados.prioridade,
        categoria: dados.categoria,
        status: 'NOVO', // Mudamos de ABERTO para NOVO para satisfazer o SQL Server
        requerente_id: usuarioId, 
        empresa_origem_id: empresaId,
        empresa_responsavel_id: dados.empresa_responsavel_id,
      },
    });
  }

  async listarChamados(usuarioLogado: any) {
    const temVisaoGlobal = usuarioLogado.perfil === 'Super Admin' || usuarioLogado.permissoes?.can_manage_users;
    const filtro = temVisaoGlobal ? {} : { empresa_origem_id: usuarioLogado.empresa_id };

    return this.prisma.chamados.findMany({
      where: filtro,
      orderBy: {
        created_at: 'desc',
      },
      // 💡 Usando os nomes exatos do seu schema.prisma para o Join
      include: {
        usuarios_chamados_requerente_idTousuarios: { 
          select: { nome: true, email: true } 
        },
        empresas_chamados_empresa_origem_idToempresas: { 
          select: { razao_social: true } 
        }
      }
    });
  }

  async buscarPorId(id: string, usuarioLogado: any) {
    // 1. Blindagem: Quem é o cara?
    const temVisaoGlobal = usuarioLogado.perfil === 'Super Admin' || usuarioLogado.permissoes?.can_manage_users;
    
    // 2. A Regra do Jogo: Admin busca só pelo ID. Cliente busca pelo ID + ID da sua empresa.
    const filtro = temVisaoGlobal 
      ? { id: id } 
      : { id: id, empresa_origem_id: usuarioLogado.empresa_id };

    // 3. A Busca Cirúrgica com o "Pacote Completo" (Bloco 3)
    const chamado = await this.prisma.chamados.findFirst({
      where: filtro,
      include: {
        // Traz quem abriu e a empresa
        usuarios_chamados_requerente_idTousuarios: { select: { nome: true, email: true } },
        empresas_chamados_empresa_origem_idToempresas: { select: { razao_social: true } },
        
        // Traz o técnico da Stellar que está cuidando (se já tiver um)
        usuarios_chamados_tecnico_atribuido_idTousuarios: { select: { nome: true, email: true } },
        
        // Traz todo o chat do chamado em ordem cronológica
        interacoes: {
          where: temVisaoGlobal ? undefined : { is_nota_interna: false },
          orderBy: { created_at: 'asc' }, // Do mais antigo pro mais novo
          include: {
            usuarios: { select: { nome: true } } // Traz o nome de quem mandou a mensagem
          }
        },
        
        // Traz os arquivos anexados
        anexos: true 
      }
    });

    // 4. Cyber Security: Se o cara tentar um ID falso ou de outra empresa, toma um 404 sem dar pistas
    if (!chamado) {
      throw new NotFoundException('Chamado não encontrado ou você não tem permissão de acesso.');
    }

    return chamado;
  }

  async atualizarChamado(id: string, dadosAtualizacao: UpdateChamadoDto, usuarioLogado: any) {
    // 1. O Escudo (Cyber Security & Validação)
    // Chamamos a função que já existe. Se o cara tentar atualizar um chamado de outra 
    // empresa ou um ID que não existe, o buscarPorId já vai travar a operação e jogar o erro 404.
    await this.buscarPorId(id, usuarioLogado);

    // 2. A Execução Limpa no SQL Server
    // Se passou do escudo, é porque o cara tem acesso. Mandamos o Prisma atualizar apenas 
    // os campos que vieram dentro do dadosAtualizacao.
    return this.prisma.chamados.update({
      where: { id },
      data: dadosAtualizacao,
    });
  }

  async enviarMensagem(chamadoId: string, dadosMensagem: CreateInteracaoDto, usuarioLogado: any) {
    // 1. O Escudo (Cyber Security)
    // Se o usuário não tem acesso ao chamado, o buscarPorId já trava a requisição com 404.
    await this.buscarPorId(chamadoId, usuarioLogado);

    // 2. Inteligência de Negócio: Notas Internas
    // Se o cliente (ex: Escola ou Clínica) enviar maliciosamente "is_nota_interna: true" no JSON,
    // nós ignoramos e forçamos para 'false'. Só a Stellar pode criar nota interna.
    const podeMandarNotaInterna = usuarioLogado.perfil === 'Super Admin' || usuarioLogado.permissoes?.can_manage_users;
    const isNotaInterna = podeMandarNotaInterna ? (dadosMensagem.is_nota_interna || false) : false;

    // 3. O Motor de Gravação
    return this.prisma.interacoes.create({
      data: {
        chamado_id: chamadoId, // ID que veio da URL
        usuario_id: usuarioLogado.userId, // Identidade cravada pelo Token (sem risco de falsificação)
        mensagem: dadosMensagem.mensagem,
        is_nota_interna: isNotaInterna,
      },
      // Faz o Join para já devolver a mensagem com o nome de quem mandou, facilitando o Front-end
      include: {
        usuarios: {
          select: { nome: true }
        }
      }
    });
  }
}