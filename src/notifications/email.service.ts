import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Serviço de e-mail transacional da Stellar Syntec.
 *
 * Segue o mesmo padrão das demais integrações opcionais do projeto
 * (n8n, Chatwoot): se as variáveis SMTP_* não estiverem configuradas no .env,
 * o serviço apenas registra a intenção em log (comportamento atual), sem quebrar
 * nenhum fluxo. Assim que o SMTP for configurado, os e-mails passam a ser
 * enviados de verdade — sem nenhuma outra alteração de código.
 *
 * Variáveis de ambiente:
 *   SMTP_HOST     host do servidor SMTP (ex.: smtp.sendgrid.net)
 *   SMTP_PORT     porta (587 padrão; 465 para SSL)
 *   SMTP_SECURE   "true" para conexão SSL direta (porta 465)
 *   SMTP_USER     usuário/login SMTP
 *   SMTP_PASS     senha/api key SMTP
 *   SMTP_FROM     remetente exibido (ex.: "Stellar Syntec <financeiro@stellarsyntec.com.br>")
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      return null; // SMTP não configurado -> modo log
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });

    return this.transporter;
  }

  private get remetente(): string {
    return (
      process.env.SMTP_FROM ||
      'Stellar Syntec <nao-responder@stellarsyntec.com.br>'
    );
  }

  /**
   * Envio genérico. Retorna true se o e-mail foi efetivamente enviado,
   * false se caiu no modo log (SMTP não configurado) ou se houve falha.
   */
  async enviarEmail(
    destinatario: string,
    assunto: string,
    html: string,
  ): Promise<boolean> {
    const destino = (destinatario || '').trim();
    if (!destino) {
      this.logger.debug('E-mail ignorado: destinatário vazio.');
      return false;
    }

    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.log(
        `📧 [Email/log] SMTP não configurado — e-mail NÃO enviado. Para: ${destino} | Assunto: "${assunto}"`,
      );
      return false;
    }

    try {
      await transporter.sendMail({
        from: this.remetente,
        to: destino,
        subject: assunto,
        html,
      });
      this.logger.log(`📧 [Email] Enviado para ${destino} — "${assunto}"`);
      return true;
    } catch (error) {
      this.logger.error(`❌ [Email] Falha ao enviar para ${destino}:`, error);
      return false;
    }
  }

  /** Confirmação de pagamento (espelha o WhatsApp de recibo). */
  async enviarConfirmacaoPagamento(
    destinatario: string,
    nome: string,
    valor: string,
    linkRecibo?: string | null,
  ): Promise<boolean> {
    const botaoRecibo = linkRecibo
      ? `<tr><td align="center" style="padding: 8px 0 4px 0;">
           <a href="${linkRecibo}" target="_blank"
              style="display:inline-block; background:#22d3ee; color:#0b1020;
                     font-weight:700; text-decoration:none; padding:14px 28px;
                     border-radius:10px; font-family:'Space Grotesk',Arial,sans-serif;">
             Acessar comprovante oficial
           </a>
         </td></tr>`
      : '';

    const corpo = `
      <p style="margin:0 0 16px 0;">Olá, <strong>${nome}</strong>!</p>
      <p style="margin:0 0 16px 0;">
        Confirmamos o recebimento do seu pagamento de
        <strong style="color:#22d3ee;">R$ ${valor}</strong>.
        A fatura já foi liquidada em nosso sistema e seus serviços seguem ativos. 🚀
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${botaoRecibo}
      </table>
      <p style="margin:16px 0 0 0; color:#94a3b8; font-size:13px;">
        Se precisar de qualquer suporte, nossa equipe está à disposição.
      </p>
    `;

    return this.enviarEmail(
      destinatario,
      'Pagamento confirmado — Stellar Syntec',
      this.montarTemplate('Pagamento confirmado', corpo),
    );
  }

  /** Aviso de fatura gerada/disponível. */
  async enviarFaturaGerada(
    destinatario: string,
    nome: string,
    valor: string,
    vencimento: string,
    linkFatura: string,
  ): Promise<boolean> {
    const corpo = `
      <p style="margin:0 0 16px 0;">Prezado(a) <strong>${nome}</strong>,</p>
      <p style="margin:0 0 16px 0;">
        A fatura da sua mensalidade já está disponível para pagamento.
      </p>
      <p style="margin:0 0 8px 0;"><strong>Vencimento:</strong> ${vencimento}</p>
      <p style="margin:0 0 20px 0;"><strong>Valor:</strong>
        <span style="color:#22d3ee;">R$ ${valor}</span></p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center" style="padding: 8px 0 4px 0;">
          <a href="${linkFatura}" target="_blank"
             style="display:inline-block; background:#22d3ee; color:#0b1020;
                    font-weight:700; text-decoration:none; padding:14px 28px;
                    border-radius:10px; font-family:'Space Grotesk',Arial,sans-serif;">
            Acessar fatura
          </a>
        </td></tr>
      </table>
    `;

    return this.enviarEmail(
      destinatario,
      'Sua fatura está disponível — Stellar Syntec',
      this.montarTemplate('Fatura disponível', corpo),
    );
  }

  /** Código de verificação em duas etapas (MFA). */
  async enviarCodigoMfa(
    destinatario: string,
    nome: string,
    codigo: string,
  ): Promise<boolean> {
    const corpo = `
      <p style="margin:0 0 16px 0;">Olá, <strong>${nome}</strong>!</p>
      <p style="margin:0 0 20px 0;">
        Use o código abaixo para concluir o seu login. Ele expira em 5 minutos.
      </p>
      <div style="text-align:center; margin:8px 0 20px 0;">
        <span style="display:inline-block; font-size:34px; font-weight:700;
                     letter-spacing:10px; color:#22d3ee; background:#0b1020;
                     border:1px solid #1f2937; border-radius:12px; padding:16px 24px;">
          ${codigo}
        </span>
      </div>
      <p style="margin:0; color:#94a3b8; font-size:13px;">
        Se você não tentou entrar, ignore este e-mail e troque a sua senha por precaução.
      </p>
    `;
    return this.enviarEmail(
      destinatario,
      'Seu código de acesso — Stellar Syntec',
      this.montarTemplate('Verificação em duas etapas', corpo),
    );
  }

  /** Wrapper dark com a identidade visual da Stellar (cyan neon / Space Grotesk). */
  private montarTemplate(titulo: string, corpoHtml: string): string {
    const ano = new Date().getFullYear();
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background:#0b1020;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1020; padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px; width:100%; background:#111827; border:1px solid #1f2937;
                    border-radius:16px; overflow:hidden;
                    font-family:'Space Grotesk',Segoe UI,Arial,sans-serif; color:#e5e7eb;">
        <tr><td style="padding:28px 32px; border-bottom:1px solid #1f2937;">
          <span style="font-size:20px; font-weight:700; letter-spacing:0.5px; color:#ffffff;">
            STELLAR <span style="color:#22d3ee;">SYNTEC</span>
          </span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 20px 0; font-size:22px; color:#ffffff;">${titulo}</h1>
          <div style="font-size:15px; line-height:1.6; color:#e5e7eb;">${corpoHtml}</div>
        </td></tr>
        <tr><td style="padding:20px 32px; border-top:1px solid #1f2937; color:#64748b; font-size:12px;">
          © ${ano} Stellar Syntec — mensagem automática, não responda este e-mail.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}
