import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { comRetentativas } from '../../common/retry.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AsaasService } from '../asaas/asaas.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../../notifications/notifications.service';
import { EmailService } from '../../notifications/email.service';
import { AcessoService } from '../acesso/acesso.service';

@Injectable()
export class FaturasService {
  private readonly logger = new Logger(FaturasService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private email: EmailService,
    private asaas: AsaasService,
    private acesso: AcessoService,
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

    // 📧 E-mail de fatura gerada (só envia se houver e-mail + SMTP configurado)
    if (contrato.empresas.email_financeiro) {
      await this.email.enviarFaturaGerada(
        contrato.empresas.email_financeiro,
        contrato.empresas.razao_social,
        contrato.valor_mensalidade.toString(),
        faturaAtualizada.data_vencimento.toLocaleDateString('pt-BR'),
        faturaAtualizada.url_fatura ?? '',
      );
    }

    return { message: 'Fatura gerada e blindada com o Asaas!', fatura: faturaAtualizada };
  }

  // Gera (ou reaproveita) a cobrança Asaas de uma fatura JÁ existente — para
  // faturas pendentes que ainda não têm link de pagamento (ex.: dados antigos).
  // Retorna o url_fatura para o cliente pagar (boleto/PIX/cartão).
  async gerarCobranca(faturaId: string, usuarioLogado: any) {
    const fatura = await this.prisma.faturas.findUnique({
      where: { id: faturaId },
      include: { empresas: true },
    });
    if (!fatura) throw new NotFoundException('Fatura não encontrada.');

    // IDOR: cliente só pode gerar/pagar cobrança da própria empresa
    const ehDaEmpresa = fatura.empresa_id === usuarioLogado.empresa_id;
    const ehGestor = usuarioLogado?.permissoes?.can_generate_invoices === true;
    if (!ehDaEmpresa && !ehGestor) {
      throw new ForbiddenException('Você não pode acessar a cobrança de outra empresa.');
    }

    if (fatura.status === 'PAGO') {
      throw new BadRequestException('Esta fatura já foi paga.');
    }
    // Já tem link: só devolve
    if (fatura.url_fatura) {
      return { url_fatura: fatura.url_fatura, asaas_payment_id: fatura.asaas_payment_id };
    }

    const clienteAsaas = await this.asaas.criarCliente({
      nome: fatura.empresas.razao_social,
      cnpjCpf: fatura.empresas.cnpj_cpf,
      email: fatura.empresas.email_financeiro || undefined,
    });

    // Vencida? gera com vencimento de hoje (Asaas não aceita data no passado)
    const hoje = new Date();
    const venc = new Date(fatura.data_vencimento);
    const dueDate = (venc < hoje ? hoje : venc).toISOString().substring(0, 10);

    const asaasFatura = await this.asaas.gerarFatura({
      customer: clienteAsaas.id,
      value: Number(fatura.valor),
      dueDate: dueDate,
      externalReference: fatura.id,
      description: 'Mensalidade Stellar Syntec - Serviços de Inteligência TI',
    });

    const atualizada = await this.prisma.faturas.update({
      where: { id: fatura.id },
      data: { asaas_payment_id: asaasFatura.id, url_fatura: asaasFatura.invoiceUrl },
    });

    return { url_fatura: atualizada.url_fatura, asaas_payment_id: atualizada.asaas_payment_id };
  }

  // Reconciliação: consulta o Asaas e atualiza a fatura se já estiver paga.
  // Rede de segurança para quando o webhook não chega (ngrok fora, fila pausada, etc.).
  async sincronizarPagamento(faturaId: string, usuarioLogado: any) {
    const fatura = await this.prisma.faturas.findUnique({ where: { id: faturaId } });
    if (!fatura) throw new NotFoundException('Fatura não encontrada.');

    const ehDaEmpresa = fatura.empresa_id === usuarioLogado.empresa_id;
    const ehGestor = usuarioLogado?.permissoes?.can_generate_invoices === true;
    if (!ehDaEmpresa && !ehGestor) {
      throw new ForbiddenException('Você não pode acessar esta fatura.');
    }

    if (fatura.status === 'PAGO') return { status: 'PAGO', pago: true };
    if (!fatura.asaas_payment_id) {
      return { status: fatura.status, pago: false, message: 'Esta fatura ainda não tem cobrança gerada.' };
    }

    const cobranca = await this.asaas.consultarPagamento(fatura.asaas_payment_id);
    const statusAsaas = cobranca?.status;
    const pago = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(statusAsaas);

    if (pago) {
      await this.prisma.faturas.update({
        where: { id: fatura.id },
        data: { status: 'PAGO', data_pagamento: new Date() },
      });
      const liberadas = await this.acesso.liberarAcessoEmpresa(fatura.empresa_id);
      this.logger.log(
        `Fatura ${fatura.id} reconciliada como PAGA; ${liberadas} ferramenta(s) liberada(s).`,
      );
      return { status: 'PAGO', pago: true, ferramentas_liberadas: liberadas };
    }

    return { status: statusAsaas ?? fatura.status, pago: false };
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

    // Retry: o Azure SQL serverless pode estar pausado quando o cron dispara
    const faturasParaNotificar = await comRetentativas(
      () => this.prisma.faturas.findMany({
        where: {
          status: 'PENDENTE',
          data_vencimento: { in: datasAlvo.map(d => new Date(d)) }
        },
        include: { empresas: true }
      }),
      'lembretes de vencimento',
    );

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