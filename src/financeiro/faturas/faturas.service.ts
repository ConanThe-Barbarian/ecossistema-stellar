import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AsaasService } from '../asaas/asaas.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class FaturasService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private asaas: AsaasService,
  ) {}

  // O Gatilho: Roda sempre que um contrato for ativado
  async gerarPrimeiraFatura(contratoId: string) {
    // 1. Busca o contrato e a empresa no banco de dados
    const contrato = await this.prisma.contratos.findUnique({
      where: { id: contratoId },
      include: { empresas: true }
    });

    if (!contrato) {
      throw new NotFoundException('Contrato nao encontrado na base de dados.');
    }

    // 2. Logica de Tempo: Calcula o vencimento
    const hoje = new Date();
    const dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), contrato.dia_vencimento);
    
    if (dataVencimento < hoje) {
        dataVencimento.setMonth(dataVencimento.getMonth() + 1);
    }
    
    // Retorna direto uma String nativa para a API do Asaas (YYYY-MM-DD)
    const dueDateString = dataVencimento.toISOString().substring(0, 10);

    // 3. Cadastra o Cliente no Asaas
    const clienteAsaas = await this.asaas.criarCliente({
      nome: contrato.empresas.razao_social,
      cnpjCpf: contrato.empresas.cnpj_cpf,
      email: contrato.empresas.email_financeiro || undefined, 
    });

    // 4. Cria um rascunho da Fatura no banco local primeiro
    const novaFatura = await this.prisma.faturas.create({
      data: {
        empresa_id: contrato.empresa_id,
        contrato_id: contrato.id,
        valor: contrato.valor_mensalidade,
        data_vencimento: dataVencimento,
        status: 'PENDENTE',
      }
    });

    // 5. Manda a ordem de cobranca para o Asaas
    const faturaAsaas = await this.asaas.gerarFatura({
      customer: clienteAsaas.id,
      value: Number(contrato.valor_mensalidade),
      dueDate: dueDateString,
      externalReference: novaFatura.id, 
      description: `Mensalidade Stellar Syntec - Servicos de Inteligencia TI`,
    });

    // 6. Atualiza a fatura no banco local com o Link e o ID do Asaas
    const faturaAtualizada = await this.prisma.faturas.update({
      where: { id: novaFatura.id },
      data: {
        asaas_payment_id: faturaAsaas.id,
        url_fatura: faturaAsaas.invoiceUrl,
      }
    });

    // 7. DISPARO IMEDIATO (Dia Zero): Notifica o cliente que a fatura foi gerada
    const telefone = contrato.empresas.telefone_principal ?? '';
    if (telefone) {
      await this.notifications.enviarWhatsAppFaturaGerada(
        telefone,
        contrato.empresas.razao_social,
        contrato.valor_mensalidade.toString(),
        faturaAtualizada.data_vencimento.toLocaleDateString('pt-BR'),
        faturaAtualizada.url_fatura ?? ''
      );
      console.log(`[Stellar Finance] Fatura gerada e cliente notificado: ${contrato.empresas.razao_social}`);
    }

    return {
      message: 'Fatura gerada com sucesso e blindada com o Asaas!',
      fatura: faturaAtualizada
    };
  }

  // Agendador: Varre o banco todos os dias as 09:00
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async processarLembretesVencimento() {
    const hoje = new Date();
    
    // 1. Criamos a lista de dias separados para evitar qualquer erro de sintaxe
    const diasDeAntecedencia = [1, 3, 7];

    // 2. Mapeamos os dias para gerar as strings de data (YYYY-MM-DD)
    const datasAlvo = diasDeAntecedencia.map(dias => {
      const data = new Date();
      data.setDate(hoje.getDate() + dias);
      return data.toISOString().split('T')[0];
    });

    // 3. Busca no banco as faturas com datas especificas
    const faturasParaNotificar = await this.prisma.faturas.findMany({
      where: {
        status: 'PENDENTE',
        data_vencimento: {
          in: datasAlvo.map(d => new Date(d))
        }
      },
      include: { empresas: true }
    });

    // 4. Disparo via EvolutionAPI para cada fatura encontrada
    for (const fatura of faturasParaNotificar) {
      const telefone = fatura.empresas.telefone_principal ?? '';
      
      if (telefone) {
        await this.notifications.enviarWhatsAppLembreteVencimento(
          telefone,
          fatura.empresas.razao_social,
          fatura.valor.toString(),
          fatura.data_vencimento.toLocaleDateString('pt-BR'),
          fatura.url_fatura ?? ''
        );
      }
    }
    
    console.log(`[Stellar Finance] Processamento de lembretes concluido: ${faturasParaNotificar.length} faturas.`);
  }
}