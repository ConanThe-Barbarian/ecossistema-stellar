import { FaturasService } from './faturas.service';

describe('FaturasService — e-mail de fatura gerada', () => {
  function montar(emailFinanceiro: string | null) {
    const contrato = {
      id: 'c1',
      empresa_id: 'e1',
      dia_vencimento: 10,
      valor_mensalidade: 299.9,
      empresas: {
        razao_social: 'Escola de Música',
        cnpj_cpf: '12345678000199',
        email_financeiro: emailFinanceiro,
        telefone_principal: '11999999999',
      },
    };
    const prisma: any = {
      contratos: { findUnique: async () => contrato },
      faturas: {
        create: async () => ({ id: 'f1' }),
        update: async () => ({
          id: 'f1',
          data_vencimento: new Date('2026-07-10T00:00:00'),
          url_fatura: 'https://asaas/f1',
        }),
      },
    };
    const notifications: any = { enviarWhatsAppFaturaGerada: jest.fn(async () => undefined) };
    const email: any = { enviarFaturaGerada: jest.fn(async () => true) };
    const asaas: any = {
      criarCliente: jest.fn(async () => ({ id: 'cli1' })),
      gerarFatura: jest.fn(async () => ({ id: 'pay1', invoiceUrl: 'https://asaas/f1' })),
    };
    return { svc: new FaturasService(prisma, notifications, email, asaas), notifications, email };
  }

  it('com email_financeiro: dispara WhatsApp e e-mail de fatura', async () => {
    const { svc, notifications, email } = montar('fin@escola.com');
    await svc.gerarPrimeiraFatura('c1');
    expect(notifications.enviarWhatsAppFaturaGerada).toHaveBeenCalled();
    expect(email.enviarFaturaGerada).toHaveBeenCalledWith(
      'fin@escola.com',
      'Escola de Música',
      '299.9',
      expect.any(String),
      'https://asaas/f1',
    );
  });

  it('sem email_financeiro: não tenta enviar e-mail', async () => {
    const { svc, email } = montar(null);
    await svc.gerarPrimeiraFatura('c1');
    expect(email.enviarFaturaGerada).not.toHaveBeenCalled();
  });
});
