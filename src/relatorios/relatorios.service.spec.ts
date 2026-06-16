import { RelatoriosService } from './relatorios.service';

describe('RelatoriosService — resumoClientes', () => {
  function montar() {
    const prisma: any = {
      empresas: {
        findMany: async () => [
          { id: 'e1', razao_social: 'Cliente A' },
          { id: 'e2', razao_social: 'Cliente B' },
        ],
      },
      contratos: {
        findFirst: async ({ where }: any) =>
          where.empresa_id === 'e1'
            ? { valor_mensalidade: 1000, planos: { nome: 'Scale' } }
            : null,
      },
      faturas: {
        findMany: async ({ where }: any) =>
          where.empresa_id === 'e1'
            ? [{ valor: 1000, status: 'PAGO', data_vencimento: new Date('2026-06-10') }]
            : [{ valor: 500, status: 'PENDENTE', data_vencimento: new Date('2020-01-01') }], // vencida
      },
      chamados: {
        findMany: async ({ where }: any) =>
          where.empresa_origem_id === 'e1'
            ? [{ status: 'RESOLVIDO' }, { status: 'NOVO' }]
            : [],
      },
    };
    return new RelatoriosService(prisma, {} as any);
  }

  it('agrega faturado/recebido/em aberto/situação por cliente + totais', async () => {
    const r: any = await montar().resumoClientes('2026-06');
    expect(r.mes).toBe('2026-06');
    expect(r.totais.clientes).toBe(2);

    const a = r.clientes.find((c: any) => c.empresa === 'Cliente A');
    const b = r.clientes.find((c: any) => c.empresa === 'Cliente B');

    expect(a.plano).toBe('Scale');
    expect(a.mensalidade).toBe(1000);
    expect(a.faturado).toBe(1000);
    expect(a.recebido).toBe(1000);
    expect(a.em_aberto).toBe(0);
    expect(a.situacao).toBe('EM_DIA');
    expect(a.chamados_total).toBe(2);
    expect(a.chamados_resolvidos).toBe(1);

    expect(b.situacao).toBe('EM_DEBITO'); // fatura PENDENTE vencida
    expect(b.em_aberto).toBe(500);

    expect(r.totais.recebido).toBe(1000);
    expect(r.totais.em_aberto).toBe(500);
    expect(r.totais.inadimplentes).toBe(1);
  });
});
