import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContratoDto } from './dto/create-contrato.dto';
import { UpdateContratoDto, StatusContrato } from './dto/update-contrato.dto';
import { AddFerramentaDto } from './dto/add-ferramenta.dto';

@Injectable()
export class ContratosService {
  constructor(private prisma: PrismaService) {}

  // Criar contrato vinculando empresa + plano
  async criar(dto: CreateContratoDto) {
    // Valida se a empresa existe e está ativa
    const empresa = await this.prisma.empresas.findFirst({
      where: { id: dto.empresa_id, deleted_at: null },
    });
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada na base estelar.');
    }

    // Valida se o plano existe
    const plano = await this.prisma.planos.findUnique({
      where: { id: dto.plano_id },
    });
    if (!plano) {
      throw new NotFoundException('Plano não encontrado na base estelar.');
    }

    // Regra de negócio: uma empresa não pode ter 2 contratos ATIVOS do mesmo plano
    const duplicado = await this.prisma.contratos.findFirst({
      where: { empresa_id: dto.empresa_id, plano_id: dto.plano_id, status: 'ATIVO' },
    });
    if (duplicado) {
      throw new ConflictException(
        `A empresa ${empresa.razao_social} já possui um contrato ATIVO do plano ${plano.nome}.`,
      );
    }

    return this.prisma.contratos.create({
      data: dto,
      include: { empresas: true, planos: true },
    });
  }

  // Listar contratos com filtros opcionais
  async listarTodos(filtros?: { status?: string; empresa_id?: string }) {
    return this.prisma.contratos.findMany({
      where: {
        ...(filtros?.status ? { status: filtros.status } : {}),
        ...(filtros?.empresa_id ? { empresa_id: filtros.empresa_id } : {}),
      },
      orderBy: { created_at: 'desc' },
      include: {
        empresas: { select: { id: true, razao_social: true, cnpj_cpf: true } },
        planos: { select: { id: true, nome: true, tipo_preco: true } },
        _count: { select: { faturas: true, ferramentas_contratadas: true } },
      },
    });
  }

  // Visão completa de um contrato: plano, SLAs, ferramentas e últimas faturas
  async buscarPorId(id: string) {
    const contrato = await this.prisma.contratos.findUnique({
      where: { id },
      include: {
        empresas: true,
        planos: { include: { config_slas: true } },
        ferramentas_contratadas: { include: { servicos: true } },
        faturas: { orderBy: { data_vencimento: 'desc' }, take: 12 },
      },
    });

    if (!contrato) {
      throw new NotFoundException('Contrato não encontrado na base estelar.');
    }

    return contrato;
  }

  // Atualizar contrato (plano, valor, vencimento ou status)
  async atualizar(id: string, dto: UpdateContratoDto) {
    await this.buscarPorId(id);

    if (dto.plano_id) {
      const plano = await this.prisma.planos.findUnique({ where: { id: dto.plano_id } });
      if (!plano) {
        throw new NotFoundException('Plano não encontrado na base estelar.');
      }
    }

    return this.prisma.contratos.update({
      where: { id },
      data: { ...dto, updated_at: new Date() },
      include: { empresas: true, planos: true },
    });
  }

  // Salva a referência do arquivo do contrato assinado.
  async salvarArquivoContrato(id: string, arquivo: string, nomeOriginal: string) {
    await this.buscarPorId(id);
    return this.prisma.contratos.update({
      where: { id },
      data: { arquivo_contrato: arquivo, arquivo_nome: nomeOriginal, updated_at: new Date() },
      select: { id: true, arquivo_contrato: true, arquivo_nome: true },
    });
  }

  // Cancelar contrato: muda status e bloqueia o acesso às ferramentas
  async cancelar(id: string) {
    await this.buscarPorId(id);

    const [contrato] = await this.prisma.$transaction([
      this.prisma.contratos.update({
        where: { id },
        data: { status: StatusContrato.CANCELADO, updated_at: new Date() },
      }),
      this.prisma.ferramentas_contratadas.updateMany({
        where: { contrato_id: id },
        data: { status_acesso: 'BLOQUEADO' },
      }),
    ]);

    return {
      mensagem: 'Contrato cancelado e acesso às ferramentas bloqueado.',
      contrato,
    };
  }

  // ─── Ferramentas Contratadas (acesso SSO do Portal do Cliente) ───

  async adicionarFerramenta(contratoId: string, dto: AddFerramentaDto) {
    await this.buscarPorId(contratoId);

    const servico = await this.prisma.servicos.findUnique({
      where: { id: dto.servico_id },
    });
    if (!servico) {
      throw new NotFoundException('Serviço não encontrado no catálogo estelar.');
    }

    const jaVinculada = await this.prisma.ferramentas_contratadas.findUnique({
      where: {
        contrato_id_servico_id: {
          contrato_id: contratoId,
          servico_id: dto.servico_id,
        },
      },
    });
    if (jaVinculada) {
      throw new ConflictException(
        `O serviço ${servico.nome} já está vinculado a este contrato.`,
      );
    }

    return this.prisma.ferramentas_contratadas.create({
      data: { contrato_id: contratoId, ...dto },
      include: { servicos: true },
    });
  }

  async alterarAcessoFerramenta(
    contratoId: string,
    servicoId: string,
    statusAcesso: 'LIBERADO' | 'BLOQUEADO',
  ) {
    const vinculo = await this.prisma.ferramentas_contratadas.findUnique({
      where: {
        contrato_id_servico_id: { contrato_id: contratoId, servico_id: servicoId },
      },
    });
    if (!vinculo) {
      throw new NotFoundException('Ferramenta não vinculada a este contrato.');
    }

    return this.prisma.ferramentas_contratadas.update({
      where: {
        contrato_id_servico_id: { contrato_id: contratoId, servico_id: servicoId },
      },
      data: { status_acesso: statusAcesso },
      include: { servicos: true },
    });
  }

  async removerFerramenta(contratoId: string, servicoId: string) {
    const vinculo = await this.prisma.ferramentas_contratadas.findUnique({
      where: {
        contrato_id_servico_id: { contrato_id: contratoId, servico_id: servicoId },
      },
    });
    if (!vinculo) {
      throw new NotFoundException('Ferramenta não vinculada a este contrato.');
    }

    return this.prisma.ferramentas_contratadas.delete({
      where: {
        contrato_id_servico_id: { contrato_id: contratoId, servico_id: servicoId },
      },
    });
  }
}
