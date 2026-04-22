import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  async getHello() {
    const empresa = await this.prisma.empresas.findFirst();
    return {
      message: 'Ecossistema Stellar Online!',
      database: 'SQL Server via Radmin',
      empresa_detectada: empresa?.nome_fantasia || 'Sem dados',
      tecnologia: 'NestJS + Prisma v7'
    };
  }

  // BLOCO 1: O Motor de Parametrização de SLAs
  async setupPlanosESlas() {
    // 1. Blindagem: Verifica se já existem planos para não duplicar dados se você rodar a rota 2x
    const totalPlanos = await this.prisma.planos.count();
    if (totalPlanos > 0) {
      return { message: 'Os planos e SLAs já foram configurados anteriormente no banco!' };
    }

    // 2. Criando o Plano Standard (Foco no GalaxIA)
    const planoStandard = await this.prisma.planos.create({
      data: {
        nome: 'Standard - GalaxIA',
        tipo_preco: 'FIXO',
        valor_base: 499.90,
        // O Prisma já cria os SLAs vinculados automaticamente ao ID deste plano!
        config_slas: {
          create: [
            { prioridade: 'URGENTE', tempo_resposta_horas: 4, tempo_solucao_horas: 12 },
            { prioridade: 'ALTA', tempo_resposta_horas: 8, tempo_solucao_horas: 24 },
            { prioridade: 'MEDIA', tempo_resposta_horas: 24, tempo_solucao_horas: 48 },
            { prioridade: 'BAIXA', tempo_resposta_horas: 48, tempo_solucao_horas: 96 },
          ]
        }
      }
    });

    // 3. Criando o Plano Enterprise (Híbrido - Presencial/VIP)
    const planoHibrido = await this.prisma.planos.create({
      data: {
        nome: 'Enterprise - Híbrido',
        tipo_preco: 'CUSTOM',
        valor_base: 1499.90,
        config_slas: {
          create: [
            { prioridade: 'URGENTE', tempo_resposta_horas: 1, tempo_solucao_horas: 4 },
            { prioridade: 'ALTA', tempo_resposta_horas: 2, tempo_solucao_horas: 8 },
            { prioridade: 'MEDIA', tempo_resposta_horas: 8, tempo_solucao_horas: 24 },
            { prioridade: 'BAIXA', tempo_resposta_horas: 24, tempo_solucao_horas: 48 },
          ]
        }
      }
    });

    return {
      message: 'Base de Conhecimento de SLAs injetada com sucesso no SQL Server!',
      planos_criados: [planoStandard.nome, planoHibrido.nome]
    };
  }
}