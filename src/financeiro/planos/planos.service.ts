import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanoDto } from './dto/create-plano.dto';

@Injectable()
export class PlanosService {
  constructor(private prisma: PrismaService) {}

  // Criar um novo plano no Ecossistema
  async criar(dto: CreatePlanoDto) {
    return this.prisma.planos.create({
      data: dto,
    });
  }

  // Listar todos os planos ativos (Util para selecionar no contrato)
  async listarTodos() {
    return this.prisma.planos.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  // Buscar um plano especifico
  async buscarPorId(id: string) {
    const plano = await this.prisma.planos.findUnique({
      where: { id },
    });

    if (!plano) {
      throw new NotFoundException('Plano nao encontrado na base estelar.');
    }

    return plano;
  }

  // Deletar um plano (Apenas se nao houver contratos vinculados)
  async remover(id: string) {
    await this.buscarPorId(id);
    return this.prisma.planos.delete({
      where: { id },
    });
  }
}