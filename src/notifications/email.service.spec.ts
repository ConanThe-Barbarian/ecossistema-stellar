import { EmailService } from './email.service';

describe('EmailService', () => {
  const semSmtp = () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  };

  it('sem SMTP configurado: não envia e retorna false', async () => {
    semSmtp();
    const svc = new EmailService();
    const r = await svc.enviarConfirmacaoPagamento('cliente@x.com', 'Cliente', '10,00');
    expect(r).toBe(false);
  });

  it('destinatário vazio é ignorado', async () => {
    const svc = new EmailService();
    const enviados: any[] = [];
    (svc as any).getTransporter = () => ({ sendMail: async (o: any) => enviados.push(o) });
    const r = await svc.enviarConfirmacaoPagamento('', 'Cliente', '10,00');
    expect(r).toBe(false);
    expect(enviados).toHaveLength(0);
  });

  it('com transporter: envia confirmação e fatura com campos corretos', async () => {
    const svc = new EmailService();
    const enviados: any[] = [];
    (svc as any).getTransporter = () => ({
      sendMail: async (o: any) => { enviados.push(o); return { messageId: '1' }; },
    });

    const r1 = await svc.enviarConfirmacaoPagamento('cliente@x.com', 'Cliente', '299,90', 'https://r/1');
    const r2 = await svc.enviarFaturaGerada('cliente@x.com', 'Cliente', '299,90', '10/07/2026', 'https://f/1');

    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(enviados).toHaveLength(2);
    expect(enviados[0].to).toBe('cliente@x.com');
    expect(enviados[0].subject).toContain('Pagamento confirmado');
    expect(enviados[0].html).toContain('299,90');
    expect(enviados[1].subject).toContain('fatura');
  });

  it('código MFA aparece no HTML', async () => {
    const svc = new EmailService();
    let html = '';
    (svc as any).getTransporter = () => ({ sendMail: async (o: any) => { html = o.html; } });
    await svc.enviarCodigoMfa('cliente@x.com', 'Cliente', '123456');
    expect(html).toContain('123456');
  });
});
