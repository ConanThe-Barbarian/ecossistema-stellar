import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { FaturasService } from './faturas.service';
// Se quiser blindar a rota depois, pode importar o seu JwtAuthGuard aqui

@Controller('financeiro/faturas')
export class FaturasController {
  constructor(private readonly faturasService: FaturasService) {}

  // 🚀 O Gatilho Manual / API
  @Post('gerar/:contratoId')
  //@UseGuards(JwtAuthGuard) // Opcional: Descomente para trancar a rota no futuro
  async gerarFaturaManual(@Param('contratoId') contratoId: string) {
    console.log(`⚡ [Stellar Finance] Recebida ordem para gerar fatura do contrato: ${contratoId}`);
    return await this.faturasService.gerarPrimeiraFatura(contratoId);
  }

  @Post('setup-cobaia')
  async setupCobaia() {
    console.log('🏗️ [Stellar Finance] Criando ambiente de teste...');

    // 1. Criar a Empresa Cobaia
    const empresa = await this.faturasService['prisma'].empresas.create({
      data: {
        razao_social: 'Escola de Música RP - TESTE',
        cnpj_cpf: '61930808000162', // CNPJ de teste
        tipo_empresa: 'CLIENTE',
        status: 'ATIVO',
        email_financeiro: 'financeiro@stellarsyntec.com.br', // Bota o teu e-mail aqui
      }
    });

    // 2. Criar um Plano (O seu schema exige um plano para o contrato)
    const plano = await this.faturasService['prisma'].planos.create({
      data: {
        nome: 'Plano Alpha - Automação',
        tipo_preco: 'FIXO',
        valor_base: 1500.00,
      }
    });

    // 3. Criar o Contrato
    const contrato = await this.faturasService['prisma'].contratos.create({
      data: {
        empresa_id: empresa.id,
        plano_id: plano.id,
        valor_mensalidade: 1500.00,
        dia_vencimento: 15,
        status: 'ATIVO',
      }
    });

    return {
      message: '🚀 Ambiente pronto! Usa o ID do contrato abaixo para testar o Asaas.',
      contrato_id: contrato.id,
      empresa: empresa.razao_social
    };
  }
}