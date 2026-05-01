import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AsaasService } from '../asaas/asaas.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class FaturasService {
  private readonly logger = new Logger(FaturasService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private asaas: AsaasService,
  ) {}

  async gerarPrimeiraFatura(contratoId: string) {
    const contrato = await this.prisma.contratos.findUnique({
      where: { id: contratoId },
      include: { empresas: true }
    });

    if (!contrato) throw new NotFoundException('Contrato nao encontrado.');

    const hoje = new Date();
    const dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), contrato.dia_vencimento);
    if (dataVencimento < hoje) dataVencimento.setMonth(dataVencimento.getMonth() + 1);
    
    const dueDateString = dataVencimento.toISOString().substring(0, 10);

    const clienteAsaas = await this.asaas.criarCliente({
      nome: contrato.empresas.razao_social,
      cnpjCpf: contrato.empresas.cnpj_cpf,
      email: contrato.empresas.email_financeiro || undefined, 
    });

    const novaFatura = await this.prisma.faturas.create({
      data: {
        empresa_id: contrato.empresa_id,
        contrato_id: contrato.id,
        valor: contrato.valor_mensalidade,
        data_vencimento: dataVencimento,
        status: 'PENDENTE',
      }
    });

    const faturaAsaas = await this.asaas.gerarFatura({
      customer: clienteAsaas.id,
      value: Number(contrato.valor_mensalidade),
      dueDate: dueDateString,
      externalReference: novaFatura.id, 
      description: `Mensalidade Stellar Syntec - Serviços de Inteligência TI`,
    });

    const faturaAtualizada = await this.prisma.faturas.update({
      where: { id: novaFatura.id },
      data: {
        asaas_payment_id: faturaAsaas.id,
        url_fatura: faturaAsaas.invoiceUrl,
      }
    });

    const telefone = contrato.empresas.telefone_principal ?? '';
    if (telefone) {
      await this.notifications.enviarWhatsAppFaturaGerada(
        telefone,
        contrato.empresas.razao_social,
        contrato.valor_mensalidade.toString(),
        faturaAtualizada.data_vencimento.toLocaleDateString('pt-BR'),
        faturaAtualizada.url_fatura ?? ''
      );
      this.logger.log(`Fatura gerada e cliente notificado com sucesso. (Contrato ID: ${contrato.id})`);
    }

    return { message: 'Fatura gerada e blindada com o Asaas!', fatura: faturaAtualizada };
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async processarLembretesVencimento() {
    const hoje = new Date();
    const diasDeAntecedencia = [1, 3, 7];

    const datasAlvo = diasDeAntecedencia.map(dias => {
      const data = new Date();
      data.setDate(hoje.getDate() + dias);
      return data.toISOString().split('T')[0];
    });

    const faturasParaNotificar = await this.prisma.faturas.findMany({
      where: {
        status: 'PENDENTE',
        data_vencimento: { in: datasAlvo.map(d => new Date(d)) }
      },
      include: { empresas: true }
    });

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
    
    this.logger.log(`Processamento de lembretes concluído: ${faturasParaNotificar.length} faturas.`);
  }
}