import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustoFixoDto, UpdateCustoFixoDto } from './dto/custo-fixo.dto';

@Injectable()
export class CustosFixosService {
  constructor(private prisma: PrismaService) {}

  // ⚠️ Cast temporário: o model custos_fixos só aparece nos tipos após
  // rodar `npx prisma generate` (depois de aplicar prisma/migrations-manuais/001).
  private get model() {
    return (this.prisma as any).custos_fixos;
  }

  async criar(dto: CreateCustoFixoDto) {
    if (dto.empresa_id) {
      const empresa = await this.prisma.empresas.findFirst({
        where: { id: dto.empresa_id, deleted_at: null },
      });
      if (!empresa) {
        throw new NotFoundException('Empresa não encontrada na base estelar.');
      }
    }
    return this.model.create({ data: dto });
  }

  // Lista custos; filtro opcional por empresa ('GERAL' = só custos gerais)
  async listar(empresaId?: string) {
    return this.model.findMany({
      where:
        empresaId === 'GERAL'
          ? { empresa_id: null }
          : empresaId
            ? { empresa_id: empresaId }
            : {},
      orderBy: { created_at: 'desc' },
      include: { empresas: { select: { razao_social: true } } },
    });
  }

  async atualizar(id: string, dto: UpdateCustoFixoDto) {
    const custo = await this.model.findUnique({ where: { id } });
    if (!custo) {
      throw new NotFoundException('Custo fixo não encontrado.');
    }
    return this.model.update({
      where: { id },
      data: { ...dto, updated_at: new Date() },
    });
  }

  async remover(id: string) {
    const custo = await this.model.findUnique({ where: { id } });
    if (!custo) {
      throw new NotFoundException('Custo fixo não encontrado.');
    }
    return this.model.delete({ where: { id } });
  }
}
