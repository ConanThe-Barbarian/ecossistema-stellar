import { WebhooksController } from './webhooks.controller';

describe('WebhooksController — Asaas', () => {
  const TOKEN = 'token_teste';
  beforeAll(() => { process.env.ASAAS_WEBHOOK_TOKEN = TOKEN; });
  // a busca do recibo tem esperas de 8s; tornamos o setTimeout instantâneo
  beforeEach(() => {
    jest.spyOn(global, 'setTimeout').mockImplementation(((cb: any) => { cb(); return 0 as any; }) as any);
  });
  afterEach(() => jest.restoreAllMocks());

  function montar(fatura: any) {
    const prisma: any = {
      webhook_logs_asaas: { create: jest.fn(async () => ({})) },
      faturas: {
        findUnique: async () => fatura,
        update: async ({ data }: any) => ({ ...fatura, ...data, empresas: fatura.empresas }),
      },
    };
    const notifications: any = {
      enviarWhatsAppRecibo: jest.fn(async () => undefined),
      enviarWhatsAppAlertaAtraso: jest.fn(async () => undefined),
    };
    const email: any = { enviarConfirmacaoPagamento: jest.fn(async () => true) };
    const asaas: any = { obterLinkComprovante: jest.fn(async () => 'https://recibo/1') };
    const acesso: any = {
      liberarAcessoEmpresa: jest.fn(async () => 1),
      bloquearAcessoEmpresa: jest.fn(async () => 1),
    };
    return {
      ctrl: new WebhooksController(prisma, notifications, email, asaas, acesso),
      notifications, email, acesso,
    };
  }

  const faturaPendente = {
    id: 'f1', status: 'PENDENTE', empresa_id: 'e1', valor: 299.9, url_fatura: 'https://f/1',
    empresas: { razao_social: 'Escola', telefone_principal: '11999999999', email_financeiro: 'fin@escola.com' },
  };

  it('token inválido é rejeitado', async () => {
    const { ctrl } = montar(faturaPendente);
    await expect(
      ctrl.receberEventoAsaas({ event: 'PAYMENT_RECEIVED', payment: { id: 'p1' } }, 'errado'),
    ).rejects.toThrow();
  });

  it('PAYMENT_RECEIVED libera acesso e notifica (WhatsApp + e-mail)', async () => {
    const { ctrl, notifications, email, acesso } = montar(faturaPendente);
    await ctrl.receberEventoAsaas({ event: 'PAYMENT_RECEIVED', payment: { id: 'p1' } }, TOKEN);
    expect(acesso.liberarAcessoEmpresa).toHaveBeenCalledWith('e1');
    expect(notifications.enviarWhatsAppRecibo).toHaveBeenCalled();
    expect(email.enviarConfirmacaoPagamento).toHaveBeenCalledWith(
      'fin@escola.com', 'Escola', '299,90', 'https://recibo/1',
    );
  });

  it('fatura já PAGA é idempotente (não reprocessa)', async () => {
    const { ctrl, acesso } = montar({ ...faturaPendente, status: 'PAGO' });
    await ctrl.receberEventoAsaas({ event: 'PAYMENT_RECEIVED', payment: { id: 'p1' } }, TOKEN);
    expect(acesso.liberarAcessoEmpresa).not.toHaveBeenCalled();
  });

  it('PAYMENT_OVERDUE bloqueia acesso e alerta', async () => {
    const { ctrl, notifications, acesso } = montar(faturaPendente);
    await ctrl.receberEventoAsaas({ event: 'PAYMENT_OVERDUE', payment: { id: 'p1' } }, TOKEN);
    expect(acesso.bloquearAcessoEmpresa).toHaveBeenCalled();
    expect(notifications.enviarWhatsAppAlertaAtraso).toHaveBeenCalled();
  });
});
