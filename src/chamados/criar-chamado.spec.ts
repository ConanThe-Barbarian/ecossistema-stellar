import { ChamadosService } from './chamados.service';

describe('ChamadosService.criarChamado — destino e limite de treinamento', () => {
  const STELLAR = 'stellar1';
  const CLIENTE = 'cli1';

  function montar(opts: { treinosNoMes?: number } = {}) {
    const criados: any[] = [];
    const prisma: any = {
      empresas: { findFirst: async () => ({ id: STELLAR }) }, // getStellarId
      contratos: { findFirst: async () => null }, // calcularPrazosSla usa defaults
      chamados: {
        count: async () => opts.treinosNoMes ?? 0,
        create: async ({ data }: any) => {
          criados.push(data);
          return { id: 'novo', ...data };
        },
      },
    };
    const svc = new ChamadosService(prisma, {} as any);
    return { svc, criados };
  }

  const baseUser = {
    empresa_id: CLIENTE,
    userId: 'u1',
    permissoes: { can_open_stellar_ticket: true },
  };
  const baseDados = {
    titulo: 'T',
    descricao: 'D',
    prioridade: 'MEDIA' as any,
    categoria: 'SUPORTE',
    empresa_responsavel_id: CLIENTE, // interno por padrão
  };

  it('bloqueia treinamento quando já há 2 no mês', async () => {
    const { svc } = montar({ treinosNoMes: 2 });
    await expect(
      svc.criarChamado({ ...baseDados, categoria: 'TREINAMENTO' }, baseUser),
    ).rejects.toThrow();
  });

  it('permite treinamento quando há menos de 2 no mês', async () => {
    const { svc, criados } = montar({ treinosNoMes: 1 });
    await svc.criarChamado({ ...baseDados, categoria: 'TREINAMENTO' }, baseUser);
    expect(criados).toHaveLength(1);
    expect(criados[0].categoria).toBe('TREINAMENTO');
  });

  it('rejeita destino inválido (nem própria empresa nem Stellar)', async () => {
    const { svc } = montar();
    await expect(
      svc.criarChamado({ ...baseDados, empresa_responsavel_id: 'outra-empresa' }, baseUser),
    ).rejects.toThrow();
  });

  it('rejeita chamado para a Stellar sem permissão de chamado externo', async () => {
    const { svc } = montar();
    const semPermissao = { ...baseUser, permissoes: { can_open_stellar_ticket: false } };
    await expect(
      svc.criarChamado({ ...baseDados, empresa_responsavel_id: STELLAR }, semPermissao),
    ).rejects.toThrow();
  });

  it('cria chamado interno normal', async () => {
    const { svc, criados } = montar();
    await svc.criarChamado(baseDados, baseUser);
    expect(criados).toHaveLength(1);
    expect(criados[0].empresa_origem_id).toBe(CLIENTE);
    expect(criados[0].empresa_responsavel_id).toBe(CLIENTE);
  });
});
