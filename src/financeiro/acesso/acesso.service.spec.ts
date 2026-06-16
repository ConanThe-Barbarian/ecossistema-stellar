import { AcessoService } from './acesso.service';

describe('AcessoService — automação de acesso por pagamento', () => {
  function montar(opts: { faturasVencidas?: number; updateCount?: number }) {
    const updateMany = jest.fn(async () => ({ count: opts.updateCount ?? 0 }));
    const prisma: any = {
      ferramentas_contratadas: { updateMany, findMany: jest.fn(async () => []) },
      faturas: { count: jest.fn(async () => opts.faturasVencidas ?? 0) },
    };
    return { svc: new AcessoService(prisma), updateMany };
  }

  beforeEach(() => {
    delete process.env.CHATWOOT_PLATFORM_URL;
    delete process.env.CHATWOOT_PLATFORM_TOKEN;
  });

  it('bloquear: marca ferramentas como BLOQUEADO e retorna a quantidade', async () => {
    const { svc, updateMany } = montar({ updateCount: 2 });
    const n = await svc.bloquearAcessoEmpresa('e1', 'inadimplência');
    expect(n).toBe(2);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status_acesso: 'BLOQUEADO' } }),
    );
  });

  it('liberar: NÃO libera se houver fatura vencida (retorna 0)', async () => {
    const { svc, updateMany } = montar({ faturasVencidas: 1 });
    const n = await svc.liberarAcessoEmpresa('e1');
    expect(n).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('liberar: libera quando não há fatura vencida', async () => {
    const { svc, updateMany } = montar({ faturasVencidas: 0, updateCount: 3 });
    const n = await svc.liberarAcessoEmpresa('e1');
    expect(n).toBe(3);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status_acesso: 'LIBERADO' } }),
    );
  });
});
