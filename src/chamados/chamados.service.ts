import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { UpdateChamadoDto } from './dto/update-chamado.dto';
import { CreateInteracaoDto } from './dto/create-interacao.dto';
import { CreateChamadoDto } from './dto/create-chamado.dto';

@Injectable()
export class ChamadosService {
  constructor(private prisma: PrismaService, private webhooksService: WebhooksService) {}

  // Resolve a empresa da Stellar (a "casa") — usada nas regras de visibilidade.
  private async getStellarId(): Promise<string | null> {
    const s = await this.prisma.empresas.findFirst({
      where: { razao_social: { contains: 'STELLAR' }, deleted_at: null },
      select: { id: true },
    });
    return s?.id ?? null;
  }

  /** Bloqueia o acesso a quem não for da empresa Stellar (nem gestor de cliente passa). */
  async garantirStellar(usuarioLogado: any): Promise<void> {
    if (usuarioLogado?.perfil === 'Super Admin') return;
    const stellarId = await this.getStellarId();
    if (!stellarId || usuarioLogado?.empresa_id !== stellarId) {
      throw new ForbiddenException('Acesso restrito à equipe Stellar.');
    }
  }

  // Solicitações de contratação (categoria CONTRATACAO). Só Stellar.
  async listarSolicitacoesContratacao(usuarioLogado: any) {
    await this.garantirStellar(usuarioLogado);
    const stellarId = await this.getStellarId();
    const [chamados, servicos] = await Promise.all([
      this.prisma.chamados.findMany({
        where: { categoria: 'CONTRATACAO', empresa_responsavel_id: stellarId ?? undefined },
        orderBy: { created_at: 'desc' },
        include: {
          usuarios_chamados_requerente_idTousuarios: { select: { nome: true } },
          empresas_chamados_empresa_origem_idToempresas: { select: { razao_social: true } },
        },
      }),
      this.prisma.servicos.findMany({ select: { id: true, nome: true, tipo: true } }),
    ]);
    const porNome = new Map(servicos.map((s) => [s.nome, s]));
    return chamados.map((c) => {
      const nomeServico = c.titulo.replace(/^Contratação:\s*/, '');
      const serv = porNome.get(nomeServico);
      return {
        id: c.id,
        titulo: c.titulo,
        status: c.status,
        created_at: c.created_at,
        empresa: c.empresas_chamados_empresa_origem_idToempresas?.razao_social ?? null,
        solicitante: c.usuarios_chamados_requerente_idTousuarios?.nome ?? null,
        servico_nome: nomeServico,
        servico_tipo: serv?.tipo ?? 'SERVICO',
      };
    });
  }

  // Aprova a solicitação e libera a solução pro cliente (ferramenta_contratada).
  async aprovarSolicitacao(usuarioLogado: any, chamadoId: string, urlAcesso?: string) {
    await this.garantirStellar(usuarioLogado);
    const chamado = await this.prisma.chamados.findFirst({
      where: { id: chamadoId, categoria: 'CONTRATACAO' },
    });
    if (!chamado) throw new NotFoundException('Solicitação não encontrada.');

    const nomeServico = chamado.titulo.replace(/^Contratação:\s*/, '');
    const servico = await this.prisma.servicos.findFirst({ where: { nome: nomeServico } });
    if (!servico) throw new NotFoundException(`Serviço "${nomeServico}" não está no catálogo.`);

    const contrato = await this.prisma.contratos.findFirst({
      where: { empresa_id: chamado.empresa_origem_id, status: 'ATIVO' },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });
    if (!contrato) {
      throw new BadRequestException(
        'Este cliente não tem contrato ATIVO. Crie um contrato antes de liberar a solução.',
      );
    }

    const data = {
      status_acesso: 'LIBERADO',
      url_acesso: urlAcesso ?? undefined,
    };
    const existente = await this.prisma.ferramentas_contratadas.findUnique({
      where: { contrato_id_servico_id: { contrato_id: contrato.id, servico_id: servico.id } },
    });
    if (existente) {
      await this.prisma.ferramentas_contratadas.update({
        where: { contrato_id_servico_id: { contrato_id: contrato.id, servico_id: servico.id } },
        data,
      });
    } else {
      await this.prisma.ferramentas_contratadas.create({
        data: { contrato_id: contrato.id, servico_id: servico.id, ...data },
      });
    }

    // Marca a solicitação como resolvida + nota visível ao cliente.
    await this.prisma.chamados.update({
      where: { id: chamadoId },
      data: { status: 'RESOLVIDO', updated_at: new Date() },
    });
    await this.prisma.interacoes.create({
      data: {
        chamado_id: chamadoId,
        usuario_id: usuarioLogado.userId ?? usuarioLogado.id,
        mensagem: `Solicitação aprovada! A solução "${servico.nome}" foi liberada no seu portal (Minhas Ferramentas).`,
        is_nota_interna: false,
      },
    });

    return { ok: true, servico: servico.nome, tipo: servico.tipo };
  }

  async criarChamado(dados: CreateChamadoDto, usuarioLogado: any) {
    const empresaId = usuarioLogado.empresa_id;
    const usuarioId = usuarioLogado.userId ?? usuarioLogado.id;
    const stellarId = await this.getStellarId();

    const responsavelId = dados.empresa_responsavel_id;
    const ehExterno = !!stellarId && responsavelId === stellarId; // chamado PARA a Stellar
    const ehInterno = responsavelId === empresaId;                // chamado interno da própria empresa

    // Cliente só pode abrir chamado interno (própria empresa) ou externo (Stellar)
    if (!ehExterno && !ehInterno) {
      throw new ForbiddenException(
        'Destino inválido: só é permitido abrir chamado interno (própria empresa) ou para a Stellar.',
      );
    }
    // Regra de negócio: chamado para a Stellar exige permissão de chamado externo
    if (ehExterno && !usuarioLogado.permissoes?.can_open_stellar_ticket) {
      throw new ForbiddenException('Apenas o administrador da empresa pode abrir chamados para a Stellar.');
    }

    // Treinamento é um benefício limitado a 2 solicitações por mês por empresa.
    if (dados.categoria === 'TREINAMENTO') {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      const treinosNoMes = await this.prisma.chamados.count({
        where: {
          empresa_origem_id: empresaId,
          categoria: 'TREINAMENTO',
          created_at: { gte: inicioMes },
        },
      });
      if (treinosNoMes >= 2) {
        throw new ForbiddenException(
          'Limite de 2 solicitações de treinamento por mês atingido. Tente novamente no próximo mês.',
        );
      }
    }

    const { dataLimiteResposta, dataLimiteSolucao } = await this.calcularPrazosSla(
      empresaId,
      dados.prioridade,
    );

    const chamado = await this.prisma.chamados.create({
      data: {
        titulo: dados.titulo,
        descricao: dados.descricao,
        prioridade: dados.prioridade,
        categoria: dados.categoria,
        status: 'NOVO',
        requerente_id: usuarioId,
        empresa_origem_id: empresaId,
        empresa_responsavel_id: responsavelId,
        data_limite_resposta: dataLimiteResposta,
        data_limite_solucao: dataLimiteSolucao,
      },
    });

    // Chamado PARA a Stellar -> distribuição automática por carga entre os agentes.
    // (best-effort: se não houver técnico, não bloqueia a abertura)
    if (ehExterno) {
      try {
        await this.atribuirChamadoAutomaticamente(chamado.id);
      } catch (e) {
        console.error('Falha na atribuição automática:', e);
      }
    }

    return chamado;
  }

// 🛡️ MOTOR PRIVADO DE SLA (A Inteligência GTI da Stellar)
  private async calcularPrazosSla(empresaId: string, prioridade: string) {
    // 1. Busca o plano através do contrato ATIVO da empresa
    const contrato = await this.prisma.contratos.findFirst({
      where: { 
        empresa_id: empresaId, 
        status: 'ATIVO' 
      },
      include: {
        planos: {
          include: {
            config_slas: {
              where: { prioridade: prioridade }
            }
          }
        }
      }
    });

   
    const slaConfig = contrato?.planos?.config_slas?.[0];
    
    const respostaHoras = slaConfig?.tempo_resposta_horas || 24;
    const solucaoHoras = slaConfig?.tempo_solucao_horas || 72;

    const dataLimiteResposta = new Date();
    dataLimiteResposta.setHours(dataLimiteResposta.getHours() + respostaHoras);

    const dataLimiteSolucao = new Date();
    dataLimiteSolucao.setHours(dataLimiteSolucao.getHours() + solucaoHoras);

    return { dataLimiteResposta, dataLimiteSolucao };
  }

async listarChamados(usuarioLogado: any) {
    // 1. O Escudo de Visibilidade
    // Stellar vê SÓ o que foi aberto para ela (+ internos da própria Stellar).
    // Cliente vê SÓ os chamados da própria empresa (internos + os abertos p/ Stellar).
    const stellarId = await this.getStellarId();
    const ehStellar = !!stellarId && usuarioLogado.empresa_id === stellarId;

    // Solicitações de contratação têm aba própria (Contratos) — fora da lista de suporte da Stellar.
    const filtro: any = ehStellar
      ? { empresa_responsavel_id: stellarId!, categoria: { not: 'CONTRATACAO' } }
      : { empresa_origem_id: usuarioLogado.empresa_id };

    // 2. A Busca Inteligente (Ordenando pela "bomba" que vai estourar primeiro)
    const chamados = await this.prisma.chamados.findMany({
      where: filtro,
      orderBy: [
        { data_limite_solucao: 'asc' }, // 🚀 Prioriza o que vence mais cedo
        { created_at: 'desc' }
      ],
      include: {
        usuarios_chamados_requerente_idTousuarios: { select: { nome: true } },
        usuarios_chamados_tecnico_atribuido_idTousuarios: { select: { nome: true } },
        empresas_chamados_empresa_origem_idToempresas: { select: { razao_social: true } }
      }
    });

    // 3. O Cálculo de Urgência em Tempo Real
    const agora = new Date();

    return chamados.map(chamado => {
      let statusSla = 'SEM SLA';
      let horasRestantes = 0;

      // Só calculamos se o chamado não estiver finalizado
      if (chamado.status !== 'RESOLVIDO' && chamado.status !== 'FECHADO') {
        if (chamado.data_limite_solucao) {
          const limite = new Date(chamado.data_limite_solucao);
          const diffMs = limite.getTime() - agora.getTime();
          horasRestantes = diffMs / (1000 * 60 * 60); // Convertendo milissegundos para horas

          if (horasRestantes < 0) {
            statusSla = 'VIOLADO 🚨';
          } else if (horasRestantes <= 2) {
            statusSla = 'ALERTA ⚠️'; // Menos de 2h para o prazo acabar
          } else {
            statusSla = 'NO PRAZO ✅';
          }
        }
      } else {
        statusSla = 'CONCLUÍDO 🎯';
      }

      // Devolvemos o objeto original com os novos indicadores para o Front-end
      return {
        ...chamado,
        indicador_sla: statusSla,
        horas_para_vencer: horasRestantes > 0 ? Math.floor(horasRestantes) : 0,
        // interno = origem e responsável são a mesma empresa
        interno: chamado.empresa_origem_id === chamado.empresa_responsavel_id,
      };
    });
  }

  async buscarPorId(id: string, usuarioLogado: any) {
    // 1. Blindagem de visibilidade (mesma regra da listagem)
    const stellarId = await this.getStellarId();
    const ehStellar = !!stellarId && usuarioLogado.empresa_id === stellarId;

    // Stellar só abre chamado cujo responsável é a Stellar; cliente só os da sua empresa.
    const filtro = ehStellar
      ? { id, empresa_responsavel_id: stellarId as string }
      : { id, empresa_origem_id: usuarioLogado.empresa_id };

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
          where: ehStellar ? undefined : { is_nota_interna: false },
          orderBy: { created_at: 'asc' }, // Do mais antigo pro mais novo
          include: {
            usuarios: { select: { nome: true } }, // Traz o nome de quem mandou a mensagem
            anexos: true
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

async adicionarAnexo(chamadoId: string, file: Express.Multer.File, usuarioLogado: any, interacaoId?: string) {
    // 1. O Escudo Principal: Valida se o utilizador tem acesso a este chamado (já trava 404 se for fraude)
    await this.buscarPorId(chamadoId, usuarioLogado);

    // 2. A Dupla Verificação (Cyber Security): Se veio um interacaoId, garantimos que pertence a este ticket
    if (interacaoId) {
      const interacaoValida = await this.prisma.interacoes.findFirst({
        where: { 
          id: interacaoId,
          chamado_id: chamadoId 
        }
      });

      if (!interacaoValida) {
        throw new NotFoundException('Aviso de Segurança: A interação não pertence a este ticket.');
      }
    }

    // 3. O Registo de Metadados: Grava no SQL Server
    return this.prisma.anexos.create({
      data: {
        chamado_id: chamadoId, 
        interacao_id: interacaoId || null, // Se vier vazio, fica null (anexo do ticket)
        nome_arquivo: file.filename, 
        url_arquivo: `/uploads/chamados/${file.filename}`, 
        tipo_arquivo: file.mimetype, 
      }
    });
  }

  // ✨ Script de Reparo para Chamados Legados
  async repararSlasLegados() {
    // 1. Busca todos os chamados que estão com o SLA zerado
    const chamadosSemSla = await this.prisma.chamados.findMany({
      where: { data_limite_solucao: null }
    });

    let contagem = 0;

    for (const chamado of chamadosSemSla) {
      // 2. Chama o motor de cálculo que já criamos (Bloco 2)
      // Passamos a empresa e a prioridade do chamado antigo
      const { dataLimiteResposta, dataLimiteSolucao } = await this.calcularPrazosSla(
        chamado.empresa_origem_id,
        chamado.prioridade
      );

      // Ajuste importante: O cálculo original usa "new Date()". 
      // Para o legado, vamos ajustar para ser baseado na data de criação original.
      const dataCriacao = new Date(chamado.created_at);
      
      const respostaCorrigida = new Date(dataCriacao);
      respostaCorrigida.setHours(dataCriacao.getHours() + (dataLimiteResposta.getHours() - new Date().getHours()));

      const solucaoCorrigida = new Date(dataCriacao);
      solucaoCorrigida.setHours(dataCriacao.getHours() + (dataLimiteSolucao.getHours() - new Date().getHours()));

      // 3. Atualiza o chamado no SQL Server
      await this.prisma.chamados.update({
        where: { id: chamado.id },
        data: {
          data_limite_resposta: dataLimiteResposta, // Ou use as corrigidas se quiser histórico real
          data_limite_solucao: dataLimiteSolucao,
        }
      });
      contagem++;
    }

    return {
      message: `Faxina concluída! ${contagem} chamados legados foram atualizados com sucesso.`,
    };
  }

  async gerarResumoAnalytics(usuarioLogado: any) {
    // 1. O Escudo de Visibilidade
    const temVisaoGlobal = usuarioLogado.perfil === 'Super Admin' || usuarioLogado.permissoes?.can_manage_users;
    const filtroBase = temVisaoGlobal ? {} : { empresa_origem_id: usuarioLogado.empresa_id };

    // 2. A Consulta de Alta Performance (Agrupamento nativo do banco)
    const statusCounts = await this.prisma.chamados.groupBy({
      by: ['status'],
      where: filtroBase,
      _count: { id: true } // Conta quantos IDs existem para cada status
    });

    // 3. Processamento dos KPIs
    let total = 0;
    let ativos = 0; // NOVO, EM_ATENDIMENTO, PENDENTE
    let finalizados = 0; // RESOLVIDO, FECHADO

    statusCounts.forEach(item => {
      const quantidade = item._count.id;
      total += quantidade;
      
      if (['RESOLVIDO', 'FECHADO'].includes(item.status)) {
        finalizados += quantidade;
      } else {
        ativos += quantidade;
      }
    });

    // 4. Entrega Mastigada para o Front-end
    return {
      message: "Resumo de Analytics gerado com sucesso.",
      kpis: {
        total_chamados: total,
        chamados_ativos: ativos,
        chamados_finalizados: finalizados
      },
      // Mandamos também o detalhado caso você queira fazer um gráfico de barras por status
      distribuicao_status: statusCounts.map(s => ({
        status: s.status,
        quantidade: s._count.id
      }))
    };
  }

  async gerarSlaAnalytics(usuarioLogado: any) {
    const temVisaoGlobal = usuarioLogado.perfil === 'Super Admin' || usuarioLogado.permissoes?.can_manage_users;
    const filtroBase = temVisaoGlobal ? {} : { empresa_origem_id: usuarioLogado.empresa_id };

    // Pega apenas os chamados ATIVOS e que POSSUEM uma data limite definida
    const chamadosAtivos = await this.prisma.chamados.findMany({
      where: {
        ...filtroBase,
        status: { notIn: ['RESOLVIDO', 'FECHADO'] },
        data_limite_solucao: { not: null }
      },
      select: { data_limite_solucao: true }
    });

    let noPrazo = 0;
    let alerta = 0; // Menos de 2h para estourar
    let violado = 0; // Já estourou
    const agora = new Date();

chamadosAtivos.forEach(chamado => {
      // 🛡️ O Escudo do TypeScript: Se for null, pula pro próximo (resolve o erro!)
      if (!chamado.data_limite_solucao) return;

      const limite = new Date(chamado.data_limite_solucao);
      const diffHoras = (limite.getTime() - agora.getTime()) / (1000 * 60 * 60);

      if (diffHoras < 0) {
        violado++;
      } else if (diffHoras <= 2) {
        alerta++;
      } else {
        noPrazo++;
      }
    });

    const totalAvaliados = noPrazo + alerta + violado;
    
    // Calcula a porcentagem de chamados que não estouraram o prazo
    const taxaConformidade = totalAvaliados > 0 
      ? Math.round(((noPrazo + alerta) / totalAvaliados) * 100) 
      : 100;

    return {
      message: "Analytics de SLA gerado com sucesso.",
      saude_sla: {
        no_prazo: noPrazo,
        alerta: alerta,
        violado: violado,
        total_avaliados: totalAvaliados
      },
      indicadores: {
        taxa_conformidade_percentual: taxaConformidade
      }
    };
  }

  async gerarPerformanceAnalytics(usuarioLogado: any) {
    const temVisaoGlobal = usuarioLogado.perfil === 'Super Admin' || usuarioLogado.permissoes?.can_manage_users;
    const filtroBase = temVisaoGlobal ? {} : { empresa_origem_id: usuarioLogado.empresa_id };

    // 1. Cálculo de MTTR (Apenas para chamados já concluídos)
    const agregacaoTempo = await this.prisma.chamados.aggregate({
      where: {
        ...filtroBase,
        status: { in: ['RESOLVIDO', 'FECHADO'] }
      },
      _avg: { tempo_gasto_minutos: true },
      _count: { id: true }
    });

    // 2. O Ranking das "Dores" (Top 5 Categorias mais abertas)
    const rankingCategorias = await this.prisma.chamados.groupBy({
      by: ['categoria'],
      where: filtroBase,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5 // Pegamos só os 5 maiores ofensores
    });

    // Tratamento matemático rápido
    const mediaMinutos = agregacaoTempo._avg.tempo_gasto_minutos || 0;
    const mediaHoras = (mediaMinutos / 60).toFixed(2);

    return {
      message: "Analytics de Performance gerado com sucesso.",
      mttr: {
        tempo_medio_minutos: Math.round(mediaMinutos),
        tempo_medio_horas: parseFloat(mediaHoras),
        chamados_considerados: agregacaoTempo._count.id
      },
      top_categorias: rankingCategorias.map(cat => ({
        categoria: cat.categoria,
        quantidade: cat._count.id
      }))
    };
  }

//  MOTOR DE ANALYTICS: Insights Detalhados por Cliente
  async gerarInsightsAnalytics(usuarioLogado: any) {
    const temVisaoGlobal = usuarioLogado.perfil === 'Super Admin' || usuarioLogado.permissoes?.can_manage_users;
    const filtroBase = temVisaoGlobal ? {} : { empresa_origem_id: usuarioLogado.empresa_id };

    // 1. Ranking das Top 5 Empresas
    const rankingEmpresas = await this.prisma.chamados.groupBy({
      by: ['empresa_origem_id'],
      where: filtroBase,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    });

    
    const insightsDetalhados: any[] = []; 
   

    for (const item of rankingEmpresas) {
      const empresa = await this.prisma.empresas.findUnique({
        where: { id: item.empresa_origem_id },
        select: { razao_social: true }
      });

      const statusBreakdown = await this.prisma.chamados.groupBy({
        by: ['status'],
        where: { empresa_origem_id: item.empresa_origem_id },
        _count: { id: true }
      });

      const prioridadeBreakdown = await this.prisma.chamados.groupBy({
        by: ['prioridade'],
        where: { empresa_origem_id: item.empresa_origem_id },
        _count: { id: true }
      });

      insightsDetalhados.push({
        cliente: empresa?.razao_social || 'Empresa Desconhecida',
        total_geral: item._count.id,
        distribuicao_status: {
          novos: statusBreakdown.find(s => s.status === 'NOVO')?._count.id || 0,
          em_andamento: statusBreakdown.find(s => s.status === 'EM_ATENDIMENTO')?._count.id || 0,
          resolvidos: statusBreakdown.filter(s => ['RESOLVIDO', 'FECHADO'].includes(s.status))
                                     .reduce((acc, curr) => acc + curr._count.id, 0)
        },
        distribuicao_prioridade: prioridadeBreakdown.map(p => ({
          nivel: p.prioridade,
          quantidade: p._count.id
        }))
      });
    }

    return {
      message: "Insights detalhados de negócio gerados com sucesso.",
      top_clientes: insightsDetalhados
    };
  }

async calcularWorkloadEquipe(usuarioLogado: any) {
    const temVisaoGlobal = usuarioLogado.perfil === 'Super Admin' || usuarioLogado.permissoes?.can_manage_users;
    const filtroBase = temVisaoGlobal ? {} : { empresa_origem_id: usuarioLogado.empresa_id };

    const chamadosAtivos = await this.prisma.chamados.findMany({
      where: {
        ...filtroBase,
        status: { notIn: ['RESOLVIDO', 'FECHADO'] },
        tecnico_atribuido_id: { not: null }
      },
      include: {
        empresas_chamados_empresa_origem_idToempresas: { select: { razao_social: true } },
        usuarios_chamados_tecnico_atribuido_idTousuarios: { select: { nome: true } }
      }
    });

    const pesosSla = { URGENTE: 10, ALTA: 7, MEDIA: 4, BAIXA: 2 };
    const workloadMap: Record<string, any> = {};

    chamadosAtivos.forEach(chamado => {
      const tecnicoId = chamado.tecnico_atribuido_id as string;
      const tecnicoNome = chamado.usuarios_chamados_tecnico_atribuido_idTousuarios?.nome || 'Desconhecido';
      const empresaId = chamado.empresa_origem_id;
      const empresaNome = chamado.empresas_chamados_empresa_origem_idToempresas?.razao_social || 'Empresa Desconhecida';
      const prioridade = chamado.prioridade || 'BAIXA';
      const pontos = pesosSla[prioridade as keyof typeof pesosSla] || 2;

      // 1. Inicializa o Técnico no Mapa
      if (!workloadMap[tecnicoId]) {
        workloadMap[tecnicoId] = {
          tecnico: tecnicoNome,
          peso_total_tecnico: 0,
          total_chamados_tecnico: 0,
          empresas: {} // Aqui entra o detalhamento por empresa
        };
      }

      // 2. Inicializa a Empresa dentro do Técnico
      if (!workloadMap[tecnicoId].empresas[empresaId]) {
        workloadMap[tecnicoId].empresas[empresaId] = {
          nome_empresa: empresaNome,
          peso_na_empresa: 0,
          quantidade_chamados: 0,
          detalhe_prioridades: { URGENTE: 0, ALTA: 0, MEDIA: 0, BAIXA: 0 }
        };
      }

      // 3. Incrementa os pesos e contadores
      workloadMap[tecnicoId].peso_total_tecnico += pontos;
      workloadMap[tecnicoId].total_chamados_tecnico += 1;
      
      workloadMap[tecnicoId].empresas[empresaId].peso_na_empresa += pontos;
      workloadMap[tecnicoId].empresas[empresaId].quantidade_chamados += 1;
      workloadMap[tecnicoId].empresas[empresaId].detalhe_prioridades[prioridade] += 1;
    });

    // 4. Formata o objeto para um Array amigável para o Front-end
    const resultadoFinal = Object.values(workloadMap).map((t: any) => ({
      ...t,
      empresas: Object.values(t.empresas) // Converte o objeto de empresas em array
    }));

    // Ordena pelo técnico mais "pesado"
    resultadoFinal.sort((a, b) => b.peso_total_tecnico - a.peso_total_tecnico);

    const chamadosOrfaos = await this.prisma.chamados.count({
      where: { ...filtroBase, status: { notIn: ['RESOLVIDO', 'FECHADO'] }, tecnico_atribuido_id: null }
    });

    return {
      message: "Workload detalhado por empresa gerado com sucesso.",
      fila_sem_dono: chamadosOrfaos,
      equipe: resultadoFinal
    };
  }

  async calcularProdutividadeEquipe(usuarioLogado: any) {
    // 1. Escudo de Visibilidade
    const temVisaoGlobal = usuarioLogado.perfil === 'Super Admin' || usuarioLogado.permissoes?.can_manage_users;
    const filtroBase = temVisaoGlobal ? {} : { empresa_origem_id: usuarioLogado.empresa_id };

    // 2. Busca apenas os chamados FINALIZADOS que tiveram um técnico responsável
    const chamadosResolvidos = await this.prisma.chamados.findMany({
      where: {
        ...filtroBase,
        status: { in: ['RESOLVIDO', 'FECHADO'] },
        tecnico_atribuido_id: { not: null }
      },
      select: {
        tecnico_atribuido_id: true,
        tempo_gasto_minutos: true
      }
    });

    const produtividadeMap: Record<string, any> = {};

    // 3. Processa a matemática (Contagem de vitórias e soma de tempo)
    chamadosResolvidos.forEach(chamado => {
      const id = chamado.tecnico_atribuido_id as string;
      const tempo = chamado.tempo_gasto_minutos || 0;

      if (!produtividadeMap[id]) {
        produtividadeMap[id] = {
          total_resolvidos: 0,
          tempo_total_minutos: 0
        };
      }

      produtividadeMap[id].total_resolvidos += 1;
      produtividadeMap[id].tempo_total_minutos += tempo;
    });

    // 4. Puxa os nomes dos guerreiros e calcula a média de eficiência
    const tecnicosIds = Object.keys(produtividadeMap);
    const tecnicosDados = await this.prisma.usuarios.findMany({
      where: { id: { in: tecnicosIds } },
      select: { id: true, nome: true }
    });

    const rankingProdutividade = tecnicosIds.map(id => {
      const user = tecnicosDados.find(u => u.id === id);
      const totalResolvidos = produtividadeMap[id].total_resolvidos;
      const tempoTotal = produtividadeMap[id].tempo_total_minutos;
      
      // Cálculo do MTTR (Tempo Médio de Resolução) por técnico
      const mttrMinutos = totalResolvidos > 0 ? Math.round(tempoTotal / totalResolvidos) : 0;
      const mttrHoras = (mttrMinutos / 60).toFixed(2);

      return {
        tecnico: user?.nome || 'Técnico Desconhecido',
        chamados_resolvidos: totalResolvidos,
        mttr_minutos: mttrMinutos,
        mttr_horas: parseFloat(mttrHoras)
      };
    });

    // 5. Ordena pelo cara que mais resolveu chamados no período
    rankingProdutividade.sort((a, b) => b.chamados_resolvidos - a.chamados_resolvidos);

    return {
      message: "Produtividade da equipe calculada com sucesso.",
      ranking: rankingProdutividade
    };
  }

  async sugerirMelhorTecnico(usuarioLogado: any) {
    // 1. Busca técnicos filtrando através da relação 'perfis_acesso' [cite: 61]
    const tecnicosElegiveis = await this.prisma.usuarios.findMany({
      where: {
        perfis_acesso: {
          nome: { in: ['Super Admin', 'Técnico'] } // Onde o nome do perfil é um desses 
        },
        status: 'ATIVO' // Garante que não vamos mandar chamado pra quem está desativado [cite: 58]
      },
      select: { id: true, nome: true } // [cite: 55]
    });

    if (tecnicosElegiveis.length === 0) {
      return { message: "Nenhum técnico elegível encontrado.", sugerido: null };
    }

    // 2. Prepara o placar inicial
    const cargaPorTecnico: Record<string, any> = {};
    tecnicosElegiveis.forEach(t => {
      cargaPorTecnico[t.id] = { 
        id: t.id, 
        nome: t.nome, 
        peso_total: 0, 
        chamados_ativos: 0 
      };
    });

    // 3. Busca a carga de trabalho atual nos chamados abertos [cite: 10]
    const chamadosAtivos = await this.prisma.chamados.findMany({
      where: {
        status: { notIn: ['RESOLVIDO', 'FECHADO'] },
        tecnico_atribuido_id: { in: tecnicosElegiveis.map(t => t.id) }
      },
      select: { tecnico_atribuido_id: true, prioridade: true }
    });

    const pesosSla = { URGENTE: 10, ALTA: 7, MEDIA: 4, BAIXA: 2 };

    // 4. Soma os pesos (O coração da inteligência da Stellar Syntec)
    chamadosAtivos.forEach(chamado => {
      const id = chamado.tecnico_atribuido_id as string;
      const prioridade = chamado.prioridade || 'BAIXA';
      const pontos = pesosSla[prioridade as keyof typeof pesosSla] || 2;

      if (cargaPorTecnico[id]) {
        cargaPorTecnico[id].peso_total += pontos;
        cargaPorTecnico[id].chamados_ativos += 1;
      }
    });

    // 5. Ordena para encontrar o mais livre
    const ranking = Object.values(cargaPorTecnico).sort((a: any, b: any) => {
      if (a.peso_total === b.peso_total) {
        return a.chamados_ativos - b.chamados_ativos; 
      }
      return a.peso_total - b.peso_total;
    });

    const melhorOpcao = ranking;

    return {
      message: "Técnico sugerido com base na menor carga de trabalho.",
      sugerido: melhorOpcao,
      ranking_completo: ranking
    };
  }

async atribuirChamadoAutomaticamente(chamadoId: string) {
    const tecnicos = await this.prisma.usuarios.findMany({
      where: {
        perfis_acesso: { nome: { in: ['Super Admin', 'Técnico'] } },
        status: 'ATIVO'
      },
      select: { id: true, nome: true, telefone_whatsapp: true }
    });

    const pesosSla = { URGENTE: 10, ALTA: 7, MEDIA: 4, BAIXA: 2 };
    
    // ✨ O PULO DO GATO: Definindo o molde exato para o TypeScript
    // Isso impede o erro de 'any[]' e blinda as propriedades
    const rankingCarga: Array<{
      id: string;
      nome: string;
      telefone_whatsapp: string | null;
      peso_total: number;
    }> = [];

    for (const tecnico of tecnicos) {
      const chamadosAtivos = await this.prisma.chamados.findMany({
        where: {
          status: { notIn: ['RESOLVIDO', 'FECHADO'] },
          tecnico_atribuido_id: tecnico.id
        },
        select: { prioridade: true }
      });

      const pesoTotal = chamadosAtivos.reduce((acc, curr) => {
        return acc + (pesosSla[curr.prioridade as keyof typeof pesosSla] || 2);
      }, 0);

      rankingCarga.push({ ...tecnico, peso_total: pesoTotal });
    }


    // 1. Ordenamos a lista (Menor peso primeiro)
rankingCarga.sort((a, b) => a.peso_total - b.peso_total);

// ✨ A SOLUÇÃO POR PARTES: 
// Em vez de 'const tecnicoEscolhido = rankingCarga', vamos fazer assim:
const [tecnicoEscolhido] = rankingCarga; 

// O vencedorDaRoleta agora é UM objeto único, não uma lista.
// Se a lista estiver vazia, ele será 'undefined'.

if (!tecnicoEscolhido) {
  return { message: "Nenhum técnico encontrado para atribuição." };
}

// 2. Agora o TS sabe que 'vencedorDaRoleta' tem o 'id' que está no seu schema.
const chamadoAtualizado = await this.prisma.chamados.update({
  where: { id: chamadoId },
  data: { 
    // Usamos o ID do modelo 'usuarios' que está no seu schema [cite: 8, 54]
    tecnico_atribuido_id: tecnicoEscolhido.id, 
    status: 'EM_ATENDIMENTO' 
  },
  include: { 
    // Nome da relação exato do seu schema.prisma [cite: 14]
    empresas_chamados_empresa_origem_idToempresas: { select: { razao_social: true } }
  }
});

    // 🚀 DISPARO DO WEBHOOK: Enviando os dados do técnico individual
    await this.webhooksService.dispararEvento('CHAMADO_ATRIBUIDO_AUTOMATICO', {
      chamado_id: chamadoAtualizado.id,
      titulo: chamadoAtualizado.titulo,
      cliente: chamadoAtualizado.empresas_chamados_empresa_origem_idToempresas.razao_social,
      tecnico_nome: tecnicoEscolhido.nome,
      tecnico_whatsapp: tecnicoEscolhido.telefone_whatsapp,
      prioridade: chamadoAtualizado.prioridade
    });

    return {
      message: `Chamado atribuído com sucesso ao técnico ${tecnicoEscolhido.nome}`,
      tecnico: tecnicoEscolhido.nome
    };
  }

  // ── Omnichannel: mensagem recebida do WhatsApp (via n8n/EvolutionAPI) ──
  // Identifica o usuário pelo telefone; se já houver chamado aberto vira nova
  // interação, senão abre um novo chamado (respeitando a regra de can_open_stellar_ticket).
  async processarMensagemWhatsApp(payload: any) {
    const telefoneBruto =
      payload?.telefone ?? payload?.phone ?? payload?.number ?? payload?.from ?? '';
    const texto = (payload?.mensagem ?? payload?.message ?? payload?.text ?? '')
      .toString()
      .trim();

    const digitos = String(telefoneBruto).replace(/\D/g, '');
    if (!digitos || !texto) {
      return { status: 'IGNORADO', reply: 'Mensagem sem telefone ou texto.' };
    }
    const sufixo11 = digitos.slice(-11);
    const sufixo10 = digitos.slice(-10);

    // Casa pelos últimos dígitos (ignora DDI/formatação salva no cadastro)
    const candidatos = await this.prisma.usuarios.findMany({
      where: { status: 'ATIVO', telefone_whatsapp: { not: null }, deleted_at: null },
      include: { perfis_acesso: true },
    });
    const usuario = candidatos.find((u) => {
      const d = (u.telefone_whatsapp || '').replace(/\D/g, '');
      return d.slice(-11) === sufixo11 || d.slice(-10) === sufixo10;
    });

    if (!usuario) {
      return {
        status: 'NAO_CADASTRADO',
        reply:
          'Não encontramos o seu número no cadastro. Peça ao administrador da sua empresa para cadastrar o seu WhatsApp e abrir chamados por aqui.',
      };
    }

    // Já existe chamado em aberto deste requerente? Vira nova interação.
    const chamadoAberto = await this.prisma.chamados.findFirst({
      where: { requerente_id: usuario.id, status: { notIn: ['RESOLVIDO', 'FECHADO'] } },
      orderBy: { created_at: 'desc' },
    });

    if (chamadoAberto) {
      await this.prisma.interacoes.create({
        data: {
          chamado_id: chamadoAberto.id,
          usuario_id: usuario.id,
          mensagem: texto,
          is_nota_interna: false,
        },
      });
      return {
        status: 'INTERACAO_ADICIONADA',
        chamado_id: chamadoAberto.id,
        reply: `Recebemos a sua mensagem e a adicionamos ao chamado "${chamadoAberto.titulo}". A equipe já foi notificada.`,
      };
    }

    // Abertura de chamado novo exige a permissão de chamado externo (regra de negócio)
    if (!usuario.perfis_acesso?.can_open_stellar_ticket) {
      return {
        status: 'SEM_PERMISSAO',
        reply:
          'Para abrir um novo chamado para a Stellar, fale com o administrador da sua empresa (somente ele pode abrir chamados externos).',
      };
    }

    const stellar = await this.prisma.empresas.findFirst({
      where: { razao_social: { contains: 'STELLAR' } },
      select: { id: true },
    });
    if (!stellar) {
      return {
        status: 'ERRO_CONFIG',
        reply: 'Empresa de suporte não configurada no sistema. Contate o suporte.',
      };
    }

    const { dataLimiteResposta, dataLimiteSolucao } = await this.calcularPrazosSla(
      usuario.empresa_id,
      'MEDIA',
    );

    const titulo = texto.length > 60 ? `${texto.slice(0, 57)}...` : texto;
    const chamado = await this.prisma.chamados.create({
      data: {
        titulo: titulo || 'Atendimento via WhatsApp',
        descricao: texto,
        prioridade: 'MEDIA',
        categoria: 'WHATSAPP',
        status: 'NOVO',
        requerente_id: usuario.id,
        empresa_origem_id: usuario.empresa_id,
        empresa_responsavel_id: stellar.id,
        data_limite_resposta: dataLimiteResposta,
        data_limite_solucao: dataLimiteSolucao,
      },
    });

    // Atribuição automática por carga (já dispara webhook ao técnico via n8n)
    await this.atribuirChamadoAutomaticamente(chamado.id);

    return {
      status: 'CHAMADO_CRIADO',
      chamado_id: chamado.id,
      reply:
        'Chamado aberto com sucesso! Um técnico já foi acionado e em breve entraremos em contato.',
    };
  }

  // ── Kanban dos técnicos: chamados agrupados por status (colunas) ──
  async obterKanban(usuarioLogado: any, tecnicoFiltro?: string) {
    const ehAdmin =
      usuarioLogado.perfil === 'Super Admin' || usuarioLogado.permissoes?.can_manage_users;

    // Kanban INDIVIDUAL: por padrão cada agente vê só os chamados atribuídos a ele,
    // para não se confundir com o board dos colegas.
    // Um admin pode inspecionar outro técnico (?tecnico=<id>) ou ver todos (?tecnico=todos).
    let alvoTecnico: string | null = usuarioLogado.id;
    if (ehAdmin && tecnicoFiltro) {
      alvoTecnico = tecnicoFiltro === 'todos' ? null : tecnicoFiltro;
    }
    const filtro = alvoTecnico ? { tecnico_atribuido_id: alvoTecnico } : {};

    const chamados = await this.prisma.chamados.findMany({
      where: filtro,
      orderBy: [{ data_limite_solucao: 'asc' }, { created_at: 'desc' }],
      include: {
        usuarios_chamados_requerente_idTousuarios: { select: { nome: true } },
        usuarios_chamados_tecnico_atribuido_idTousuarios: { select: { nome: true } },
        empresas_chamados_empresa_origem_idToempresas: { select: { razao_social: true } },
      },
    });

    const colunas = ['NOVO', 'EM_ATENDIMENTO', 'PENDENTE_CLIENTE', 'RESOLVIDO', 'FECHADO'];
    const agora = Date.now();
    const board = colunas.map((status) => ({ status, chamados: [] as any[] }));
    const idx = new Map(board.map((c, i) => [c.status, i] as const));

    for (const ch of chamados) {
      let slaViolado = false;
      if (ch.status !== 'RESOLVIDO' && ch.status !== 'FECHADO' && ch.data_limite_solucao) {
        slaViolado = new Date(ch.data_limite_solucao).getTime() < agora;
      }
      const card = {
        id: ch.id,
        titulo: ch.titulo,
        prioridade: ch.prioridade,
        categoria: ch.categoria,
        status: ch.status,
        cliente: ch.empresas_chamados_empresa_origem_idToempresas?.razao_social ?? null,
        requerente: ch.usuarios_chamados_requerente_idTousuarios?.nome ?? null,
        tecnico: ch.usuarios_chamados_tecnico_atribuido_idTousuarios?.nome ?? null,
        tempo_gasto_minutos: ch.tempo_gasto_minutos,
        sla_violado: slaViolado,
        data_limite_solucao: ch.data_limite_solucao,
      };
      const i = idx.get(ch.status);
      board[i === undefined ? 0 : i].chamados.push(card);
    }

    // Para admins: lista de técnicos da Stellar, para alternar entre os boards.
    let tecnicos: { id: string; nome: string }[] = [];
    if (ehAdmin) {
      const stellarId = await this.getStellarId();
      if (stellarId) {
        tecnicos = await this.prisma.usuarios.findMany({
          where: { empresa_id: stellarId },
          select: { id: true, nome: true },
          orderBy: { nome: 'asc' },
        });
      }
    }

    return { colunas: board, tecnicos, tecnico_selecionado: alvoTecnico, eh_admin: ehAdmin };
  }

  // Apontamento de horas: incrementa o tempo gasto (em minutos) no chamado.
  async apontarHoras(id: string, minutos: number, usuarioLogado: any) {
    await this.buscarPorId(id, usuarioLogado); // valida acesso (404 se não puder)
    const inc = Math.max(0, Math.floor(Number(minutos) || 0));
    if (inc === 0) {
      const atual = await this.prisma.chamados.findUnique({
        where: { id },
        select: { tempo_gasto_minutos: true },
      });
      return { id, tempo_gasto_minutos: atual?.tempo_gasto_minutos ?? 0 };
    }
    return this.prisma.chamados.update({
      where: { id },
      data: { tempo_gasto_minutos: { increment: inc } },
      select: { id: true, tempo_gasto_minutos: true },
    });
  }
}