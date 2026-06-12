import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

@Injectable()
export class EmpresasService {
  constructor(private prisma: PrismaService) {}

  // Remove pontuação do CNPJ/CPF para padronizar a base
  private normalizarDocumento(doc: string): string {
    return doc.replace(/\D/g, '');
  }

  // Cadastrar nova empresa (cliente, fornecedor, parceiro...)
  async criar(dto: CreateEmpresaDto) {
    const cnpjCpf = this.normalizarDocumento(dto.cnpj_cpf);

    const existente = await this.prisma.empresas.findUnique({
      where: { cnpj_cpf: cnpjCpf },
    });

    if (existente) {
      throw new ConflictException(
        `Já existe uma empresa cadastrada com o documento ${cnpjCpf} (${existente.razao_social}).`,
      );
    }

    return this.prisma.empresas.create({
      data: { ...dto, cnpj_cpf: cnpjCpf },
    });
  }

  // Listar empresas (ignora soft-deletadas). Filtros opcionais por status e tipo.
  async listarTodas(filtros?: { status?: string; tipo_empresa?: string }) {
    return this.prisma.empresas.findMany({
      where: {
        deleted_at: null,
        ...(filtros?.status ? { status: filtros.status } : {}),
        ...(filtros?.tipo_empresa ? { tipo_empresa: filtros.tipo_empresa } : {}),
      },
      orderBy: { razao_social: 'asc' },
      include: {
        _count: {
          select: { usuarios: true, contratos: true },
        },
      },
    });
  }

  // Buscar empresa com visão 360: contratos, planos, ferramentas e usuários
  async buscarPorId(id: string) {
    const empresa = await this.prisma.empresas.findFirst({
      where: { id, deleted_at: null },
      include: {
        contratos: {
          include: {
            planos: true,
            ferramentas_contratadas: { include: { servicos: true } },
          },
        },
        usuarios: {
          where: { deleted_at: null },
          select: {
            id: true,
            nome: true,
            email: true,
            status: true,
            perfis_acesso: { select: { nome: true } },
          },
        },
      },
    });

    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada na base estelar.');
    }

    return empresa;
  }

  // Atualizar dados cadastrais
  async atualizar(id: string, dto: UpdateEmpresaDto) {
    await this.buscarPorId(id);

    const data: any = { ...dto, updated_at: new Date() };

    if (dto.cnpj_cpf) {
      const cnpjCpf = this.normalizarDocumento(dto.cnpj_cpf);
      const duplicado = await this.prisma.empresas.findFirst({
        where: { cnpj_cpf: cnpjCpf, id: { not: id } },
      });
      if (duplicado) {
        throw new ConflictException(
          `O documento ${cnpjCpf} já pertence a outra empresa (${duplicado.razao_social}).`,
        );
      }
      data.cnpj_cpf = cnpjCpf;
    }

    return this.prisma.empresas.update({ where: { id }, data });
  }

  // Soft-delete: preserva histórico de chamados, faturas e contratos
  async remover(id: string) {
    await this.buscarPorId(id);

    const contratosAtivos = await this.prisma.contratos.count({
      where: { empresa_id: id, status: 'ATIVO' },
    });

    if (contratosAtivos > 0) {
      throw new ConflictException(
        `Não é possível remover: a empresa possui ${contratosAtivos} contrato(s) ATIVO(s). Encerre os contratos primeiro.`,
      );
    }

    return this.prisma.empresas.update({
      where: { id },
      data: { deleted_at: new Date(), status: 'INATIVO', updated_at: new Date() },
    });
  }
}
