import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AsaasService } from '../asaas/asaas.service';

@Injectable()
export class FaturasService {
  constructor(
    private prisma: PrismaService,
    private asaas: AsaasService,
  ) {}

  // 🚀 O Gatilho: Roda sempre que um contrato for ativado
  async gerarPrimeiraFatura(contratoId: string) {
    // 1. Busca o contrato e a empresa no banco de dados
    const contrato = await this.prisma.contratos.findUnique({
      where: { id: contratoId },
      include: { empresas: true }
    });

    if (!contrato) {
      throw new NotFoundException('Contrato não encontrado na base estelar.');
    }

    // 2. Lógica de Tempo: Calcula o vencimento
    const hoje = new Date();
    const dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), contrato.dia_vencimento);
    
    if (dataVencimento < hoje) {
        dataVencimento.setMonth(dataVencimento.getMonth() + 1);
    }
    
    // ⬇️ SOLUÇÃO DEFINITIVA: Retorna direto uma String nativa, sem arrays.
    const dueDateString = dataVencimento.toISOString().substring(0, 10);

    // 3. Cadastra o Cliente no Asaas
    const clienteAsaas = await this.asaas.criarCliente({
      nome: contrato.empresas.razao_social,
      cnpjCpf: contrato.empresas.cnpj_cpf,
      email: contrato.empresas.email_financeiro || undefined, 
    });

    // 4. Cria um rascunho da Fatura no nosso banco primeiro
    const novaFatura = await this.prisma.faturas.create({
      data: {
        empresa_id: contrato.empresa_id,
        contrato_id: contrato.id,
        valor: contrato.valor_mensalidade,
        data_vencimento: dataVencimento,
        status: 'PENDENTE',
      }
    });

    // 5. Manda a ordem de cobrança para o Asaas
    const faturaAsaas = await this.asaas.gerarFatura({
      customer: clienteAsaas.id,
      value: Number(contrato.valor_mensalidade),
      dueDate: dueDateString,
      externalReference: novaFatura.id, 
      description: `Mensalidade Stellar Syntec - Serviços de Inteligência TI`,
    });

    // 6. Atualiza a fatura no nosso banco com o Link e o ID do Asaas
    const faturaAtualizada = await this.prisma.faturas.update({
      where: { id: novaFatura.id },
      data: {
        asaas_payment_id: faturaAsaas.id,
        url_fatura: faturaAsaas.invoiceUrl,
      }
    });

    return {
      message: 'Fatura gerada com sucesso e blindada com o Asaas!',
      fatura: faturaAtualizada
    };
  }
}