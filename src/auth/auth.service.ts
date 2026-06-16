import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

interface DesafioMfa {
  userId: string;
  codigoHash: string;
  expiraEm: number;
  tentativas: number;
}

@Injectable()
export class AuthService {
  // Store em memória dos desafios de MFA (sem necessidade de tabela no banco).
  // Chave = mfaToken opaco; some quando expira ou quando o login é concluído.
  private desafiosMfa = new Map<string, DesafioMfa>();
  private readonly MFA_TTL_MS = 5 * 60 * 1000; // 5 minutos
  private readonly MFA_MAX_TENTATIVAS = 5;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private email: EmailService,
  ) {}

  // 1. Valida usuário, mas agora traz os "poderes" junto!
  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.usuarios.findUnique({
      where: { email },
      include: {
        perfis_acesso: true, // Puxa os dados da tabela perfis_acesso
        empresas: true       // Aproveitamos para trazer a empresa, será útil nos chamados!
      }
    });

    if (user && (await bcrypt.compare(pass, user.senha_hash))) {
      const { senha_hash, ...result } = user;
      return result;
    }
    return null;
  }

  // Monta o objeto de permissões a partir do perfil de acesso (tabela perfis_acesso).
  // É este objeto que o PermissionsGuard valida em cada rota protegida.
  private buildPermissoes(perfil: any): Record<string, boolean> {
    const canManageUsers = perfil?.can_manage_users ?? false;
    const canGenerateInvoices = perfil?.can_generate_invoices ?? false;

    return {
      can_open_internal_ticket: perfil?.can_open_internal_ticket ?? false,
      can_open_stellar_ticket: perfil?.can_open_stellar_ticket ?? false,
      can_manage_users: canManageUsers,
      can_generate_invoices: canGenerateInvoices,
      // Permissões derivadas (usadas pelos controllers de gestão)
      'financeiro:planos': canGenerateInvoices,
      'financeiro:gerar': canGenerateInvoices,
      'gestao:empresas': canManageUsers,
      'gestao:contratos': canGenerateInvoices || canManageUsers,
    };
  }

  // Emissão do token final (extraído para ser reusado pós-MFA).
  private emitirToken(user: any) {
    // 🛡️ Blindagem Vortex: Verificamos se o objeto existe antes de ler as propriedades
    const payload = {
      sub: user.id,
      email: user.email,
      nome: user.nome,
      // Usamos ?. para não quebrar o código se o perfil ou empresa vierem nulos
      perfil: user.perfis_acesso?.nome || 'PERFIL_NAO_DEFINIDO',
      empresa_id: user.empresa_id,
      empresa_nome: user.empresas?.razao_social || 'EMPRESA_NAO_DEFINIDA',
      // 🔑 CORREÇÃO: sem isso o PermissionsGuard negava TODAS as rotas protegidas (403)
      permissoes: this.buildPermissoes(user.perfis_acesso)
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfis_acesso?.nome,
        empresa: user.empresas?.razao_social
      }
    };
  }

  // 2. Login: se o usuário tiver MFA ativo, dispara o desafio por e-mail
  //    em vez de emitir o token direto.
  async login(user: any) {
    if (user?.mfa_enabled) {
      return this.iniciarDesafioMfa(user);
    }
    return this.emitirToken(user);
  }

  // ---- MFA (2FA por código de e-mail) ----

  private gerarCodigo(): string {
    // 6 dígitos, criptograficamente seguro (000000–999999)
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private async iniciarDesafioMfa(user: any) {
    if (!user.email) {
      // Sem e-mail não há como entregar o código — falha segura.
      throw new UnauthorizedException(
        'MFA ativo, mas o usuário não possui e-mail cadastrado. Contate o suporte.',
      );
    }

    this.limparDesafiosExpirados();

    const codigo = this.gerarCodigo();
    const codigoHash = await bcrypt.hash(codigo, 10);
    const mfaToken = crypto.randomUUID();

    this.desafiosMfa.set(mfaToken, {
      userId: user.id,
      codigoHash,
      expiraEm: Date.now() + this.MFA_TTL_MS,
      tentativas: 0,
    });

    await this.email.enviarCodigoMfa(user.email, user.nome || 'cliente', codigo);

    // E-mail mascarado para feedback no front, sem vazar o endereço completo.
    return {
      mfaRequired: true,
      mfaToken,
      email: this.mascararEmail(user.email),
      message: 'Enviamos um código de verificação para o seu e-mail.',
    };
  }

  async verificarMfa(mfaToken: string, codigo: string) {
    const desafio = mfaToken ? this.desafiosMfa.get(mfaToken) : undefined;

    if (!desafio || desafio.expiraEm < Date.now()) {
      if (mfaToken) this.desafiosMfa.delete(mfaToken);
      throw new UnauthorizedException('Código expirado ou inválido. Faça o login novamente.');
    }

    if (desafio.tentativas >= this.MFA_MAX_TENTATIVAS) {
      this.desafiosMfa.delete(mfaToken);
      throw new UnauthorizedException('Número máximo de tentativas excedido. Faça o login novamente.');
    }

    const ok = await bcrypt.compare(codigo || '', desafio.codigoHash);
    if (!ok) {
      desafio.tentativas += 1;
      throw new UnauthorizedException('Código incorreto.');
    }

    // Sucesso: consome o desafio e emite o token com dados frescos do usuário.
    this.desafiosMfa.delete(mfaToken);

    const user = await this.prisma.usuarios.findUnique({
      where: { id: desafio.userId },
      include: { perfis_acesso: true, empresas: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    const { senha_hash, ...result } = user;
    return this.emitirToken(result);
  }

  // Ativa/desativa o MFA do próprio usuário logado.
  async definirMfa(userId: string, ativar: boolean) {
    await this.prisma.usuarios.update({
      where: { id: userId },
      data: { mfa_enabled: ativar },
    });
    return { mfa_enabled: ativar };
  }

  // Status atual do MFA do usuário logado.
  async statusMfa(userId: string) {
    const user = await this.prisma.usuarios.findUnique({
      where: { id: userId },
      select: { mfa_enabled: true },
    });
    return { mfa_enabled: user?.mfa_enabled ?? false };
  }

  // Troca de senha do próprio usuário (valida a senha atual).
  async alterarSenha(userId: string, senhaAtual: string, novaSenha: string) {
    if (!novaSenha || novaSenha.length < 8) {
      throw new BadRequestException('A nova senha deve ter no mínimo 8 caracteres.');
    }
    const user = await this.prisma.usuarios.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuário não encontrado.');

    const ok = await bcrypt.compare(senhaAtual || '', user.senha_hash);
    if (!ok) throw new UnauthorizedException('Senha atual incorreta.');

    const hash = await bcrypt.hash(novaSenha, 10);
    await this.prisma.usuarios.update({
      where: { id: userId },
      data: { senha_hash: hash, updated_at: new Date() },
    });
    return { ok: true, message: 'Senha alterada com sucesso.' };
  }

  private mascararEmail(email: string): string {
    const [local, dominio] = email.split('@');
    if (!dominio) return '***';
    const visivel = local.slice(0, 2);
    return `${visivel}${'*'.repeat(Math.max(local.length - 2, 1))}@${dominio}`;
  }

  private limparDesafiosExpirados() {
    const agora = Date.now();
    for (const [token, d] of this.desafiosMfa) {
      if (d.expiraEm < agora) this.desafiosMfa.delete(token);
    }
  }

  // Mantemos o registro igualzinho
  async register(data: any) {
    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(data.password, salt);

    return this.prisma.usuarios.create({
      data: {
        nome: data.nome,
        email: data.email,
        senha_hash: hashedPass,
        empresa_id: data.empresa_id,
        perfil_id: data.perfil_id,
        status: 'ATIVO',
      },
    });
  }
}
