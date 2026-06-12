import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServicoDto, UpdateServicoDto } from './dto/servico.dto';

@Injectable()
export class ServicosService {
  constructor(private prisma: PrismaService) {}

  async criar(dto: CreateServicoDto) {
    return this.prisma.servicos.create({ data: dto });
  }

  async listarTodos(status?: string) {
    return this.prisma.servicos.findMany({
      where: status ? { status } : {},
      orderBy: { nome: 'asc' },
      include: { _count: { select: { ferramentas_contratadas: true } } },
    });
  }

  async buscarPorId(id: string) {
    const servico = await this.prisma.servicos.findUnique({ where: { id } });
    if (!servico) {
      throw new NotFoundException('Serviço não encontrado no catálogo estelar.');
    }
    return servico;
  }

  async atualizar(id: string, dto: UpdateServicoDto) {
    await this.buscarPorId(id);
    return this.prisma.servicos.update({
      where: { id },
      data: { ...dto, updated_at: new Date() },
    });
  }
}
