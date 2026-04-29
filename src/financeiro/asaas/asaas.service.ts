import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AsaasService {
  // Usamos um getter para o HTTP client para garantir que as variáveis de ambiente
  // já foram totalmente carregadas pelo NestJS antes de montar o cabeçalho.
  private get http() {
    return axios.create({
      baseURL: process.env.ASAAS_API_URL,
      headers: { 
        access_token: process.env.ASAAS_API_KEY,
        'Content-Type': 'application/json'
      },
    });
  }

  // 👤 CRIA O REGISTO DO CLIENTE (Customer)
  async criarCliente(dados: { nome: string; cnpjCpf: string; email?: string }) {
    try {
      const response = await this.http.post('customers', {
        name: dados.nome,
        cpfCnpj: dados.cnpjCpf,
        email: dados.email,
      });
      return response.data;
    } catch (error: any) {
      const detalhe = error.response?.data || error.message;
      console.error('❌ [Stellar Finance] Erro ao criar cliente no Asaas:', detalhe);
      throw new InternalServerErrorException('Falha na comunicação com o Asaas ao criar o cliente.');
    }
  }

  // 💰 GERA A COBRANÇA (Fatura / Boleto / PIX)
  async gerarFatura(dados: {
    customer: string;
    value: number;
    dueDate: string; // Formato YYYY-MM-DD
    externalReference: string; // O ID do contrato ou fatura no nosso SQL Server
    description: string;
  }) {
    try {
      const response = await this.http.post('/payments', {
        customer: dados.customer,
        billingType: 'UNDEFINED', // UNDEFINED permite que o cliente escolha a forma de pagamento (PIX, Boleto, Cartão)
        value: dados.value,
        dueDate: dados.dueDate,
        externalReference: dados.externalReference,
        description: dados.description,
      });
      return response.data;
    } catch (error: any) {
      const detalhe = error.response?.data || error.message;
      console.error('❌ [Stellar Finance] Erro ao gerar fatura no Asaas:', detalhe);
      throw new InternalServerErrorException('Falha na comunicação com o Asaas ao gerar a fatura.');
    }
  }

  async obterLinkComprovante(paymentId: string): Promise<string | null> {
  try {
    // 1. Buscamos a fatura completa (conforme docs: GET /v3/payments/{id})
    const response = await axios.get(
      `${process.env.ASAAS_API_URL}/payments/${paymentId}`,
      { headers: { 'access_token': process.env.ASAAS_API_KEY || '' } }
    );

    const fatura = response.data;

    // 🚀 A documentação diz que este campo é preenchido após a confirmação
    if (fatura.transactionReceiptUrl) {
      console.log(`✨ [Stellar Asaas] Link direto encontrado!`);
      return fatura.transactionReceiptUrl;
    }

    // 2. Se o campo acima estiver nulo, tentamos o endpoint de recibo (Plano B)
    const receiptRes = await axios.get(
      `${process.env.ASAAS_API_URL}/payments/${paymentId}/receipt`,
      { headers: { 'access_token': process.env.ASAAS_API_KEY || '' } }
    );

    return receiptRes.data?.url || null;

  } catch (error) {
    // Silenciamos o erro 404 aqui porque o loop do Controller vai tentar de novo
    return null;
  }
 }
}