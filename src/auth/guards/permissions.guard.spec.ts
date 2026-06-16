import { PermissionsGuard } from './permissions.guard';

function makeCtx(user: any): any {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
}
function makeReflector(perm: string | undefined): any {
  return { getAllAndOverride: () => perm };
}

describe('PermissionsGuard', () => {
  it('libera quando a rota não exige permissão', () => {
    const guard = new PermissionsGuard(makeReflector(undefined));
    expect(guard.canActivate(makeCtx({ perfil: 'CLIENTE', permissoes: {} }))).toBe(true);
  });

  it('Super Admin tem bypass total', () => {
    const guard = new PermissionsGuard(makeReflector('financeiro:gerar'));
    expect(guard.canActivate(makeCtx({ perfil: 'Super Admin', permissoes: {} }))).toBe(true);
  });

  it('libera quando o usuário tem a permissão exigida', () => {
    const guard = new PermissionsGuard(makeReflector('financeiro:gerar'));
    expect(
      guard.canActivate(makeCtx({ perfil: 'GESTOR', permissoes: { 'financeiro:gerar': true } })),
    ).toBe(true);
  });

  it('bloqueia (403) quem não tem a permissão', () => {
    const guard = new PermissionsGuard(makeReflector('financeiro:gerar'));
    expect(() =>
      guard.canActivate(makeCtx({ perfil: 'CLIENTE', permissoes: { can_manage_users: false } })),
    ).toThrow();
  });
});
