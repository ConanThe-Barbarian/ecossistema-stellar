import { AuthService } from './auth.service';

describe('AuthService — MFA por e-mail', () => {
  const userMfa: any = {
    id: 'u1', email: 'maria@escola.com', nome: 'Maria', mfa_enabled: true,
    empresa_id: 'e1', perfis_acesso: { nome: 'CLIENTE' }, empresas: { razao_social: 'Escola' },
  };
  const userSemMfa: any = { ...userMfa, id: 'u2', mfa_enabled: false };

  let codigoCapturado = '';
  const email: any = {
    enviarCodigoMfa: jest.fn(async (_e: string, _n: string, codigo: string) => {
      codigoCapturado = codigo; return true;
    }),
  };
  const jwt: any = { sign: () => 'JWT_TOKEN_FAKE' };
  const prisma: any = {
    usuarios: {
      findUnique: async ({ where }: any) => (where.id === 'u1' ? userMfa : { mfa_enabled: true }),
      update: async ({ data }: any) => ({ mfa_enabled: data.mfa_enabled }),
    },
  };

  function novo() { return new AuthService(prisma, jwt, email); }

  it('login com MFA dispara desafio e não emite token', async () => {
    const r: any = await novo().login(userMfa);
    expect(r.mfaRequired).toBe(true);
    expect(typeof r.mfaToken).toBe('string');
    expect(r.access_token).toBeUndefined();
    expect(codigoCapturado).toMatch(/^\d{6}$/);
    expect(r.email).toContain('@escola.com');
  });

  it('código errado é rejeitado e código certo emite token', async () => {
    const svc = novo();
    const desafio: any = await svc.login(userMfa);
    await expect(svc.verificarMfa(desafio.mfaToken, '000000')).rejects.toThrow();
    const ok: any = await svc.verificarMfa(desafio.mfaToken, codigoCapturado);
    expect(ok.access_token).toBe('JWT_TOKEN_FAKE');
  });

  it('replay do mesmo token falha após consumido', async () => {
    const svc = novo();
    const d: any = await svc.login(userMfa);
    await svc.verificarMfa(d.mfaToken, codigoCapturado);
    await expect(svc.verificarMfa(d.mfaToken, codigoCapturado)).rejects.toThrow();
  });

  it('login sem MFA emite token direto', async () => {
    const r: any = await novo().login(userSemMfa);
    expect(r.access_token).toBe('JWT_TOKEN_FAKE');
    expect(r.mfaRequired).toBeUndefined();
  });

  it('excede limite de tentativas', async () => {
    const svc = novo();
    const d: any = await svc.login(userMfa);
    for (let i = 0; i < 5; i++) {
      await svc.verificarMfa(d.mfaToken, '111111').catch(() => undefined);
    }
    await expect(svc.verificarMfa(d.mfaToken, codigoCapturado)).rejects.toThrow();
  });

  it('toggle e status de MFA', async () => {
    const svc = novo();
    expect(await svc.definirMfa('u1', false)).toEqual({ mfa_enabled: false });
    expect(await svc.statusMfa('u1')).toEqual({ mfa_enabled: true });
  });
});
