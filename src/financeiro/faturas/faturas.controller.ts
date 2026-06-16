import { Controller, Post, Param, UseGuards, Body } from '@nestjs/common';
import { FaturasService } from './faturas.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermission } from '../../auth/decorators/permissions.decorator';

@Controller('financeiro/faturas')
@UseGuards(PermissionsGuard) // 🛡️ Protege as rotas com niveis de permissao
export class FaturasController {
  constructor(
    private readonly faturasService: FaturasService,
    private readonly prisma: PrismaService, // 💉 Injeção correta do Prisma
  ) {}

  // Gatilho Manual: Apenas quem tem permissão de financeiro pode gerar
  @Post('gerar/:contratoId')
  @RequirePermission('financeiro:gerar') 
  async gerarFaturaManual(@Param('contratoId') contratoId: string) {
    console.log(`⚡ [Stellar Finance] Ordem recebida para o contrato: ${contratoId}`);
    return await this.faturasService.gerarPrimeiraFatura(contratoId);
  }

  // Ambiente de Teste: Apenas o Super Admin (voce) pode rodar isso!
  @Post('setup-cobaia')
  @RequirePermission('can_manage_users') 
  async setupCobaia() {
    console.log('🏗️ [Stellar Finance] Preparando ambiente de teste (idempotente)...');

    // 1. Empresa cobaia — idempotente pelo CNPJ (campo único)
    const empresa = await this.prisma.empresas.upsert({
      where: { cnpj_cpf: '61930808000162' },
      update: {},
      create: {
        razao_social: 'Escola de Musica RP - TESTE',
        cnpj_cpf: '61930808000162',
        tipo_empresa: 'CLIENTE',
        status: 'ATIVO',
        email_financeiro: 'financeiro@stellarsyntec.com.br',
      },
    });

    // 2. Plano — reaproveita se já existir (nome não é único, então findFirst)
    let plano = await this.prisma.planos.findFirst({
      where: { nome: 'Plano Alpha - Automacao' },
    });
    if (!plano) {
      plano = await this.prisma.planos.create({
        data: { nome: 'Plano Alpha - Automacao', tipo_preco: 'FIXO', valor_base: 1500.0 },
      });
    }

    // 3. Contrato ativo — reaproveita o existente da empresa, senão cria
    let contrato = await this.prisma.contratos.findFirst({
      where: { empresa_id: empresa.id, status: 'ATIVO' },
    });
    if (!contrato) {
      contrato = await this.prisma.contratos.create({
        data: {
          empresa_id: empresa.id,
          plano_id: plano.id,
          valor_mensalidade: 1500.0,
          dia_vencimento: 15,
          status: 'ATIVO',
        },
      });
    }

    return {
      message: '🚀 Ambiente pronto (reaproveitado se já existia). Use o contrato_id para testar o Asaas.',
      contrato_id: contrato.id,
      empresa: empresa.razao_social,
    };
  }
}