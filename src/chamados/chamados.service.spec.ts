import { ChamadosService } from './chamados.service';

describe('ChamadosService — omnichannel WhatsApp', () => {
  function montar(opts: {
    usuario?: any;
    chamadoAberto?: any;
    stellar?: any;
  }) {
    const criados: any[] = [];
    const interacoes: any[] = [];
    const prisma: any = {
      usuarios: {
        // candidatos (include perfis_acesso) vs tecnicos (select) — atribuição
        findMany: async (args: any) => (args?.include ? (opts.usuario ? [opts.usuario] : []) : []),
        findUnique: async () => null,
      },
      chamados: {
        findFirst: async () => opts.chamadoAberto ?? null,
        create: async ({ data }: any) => { const c = { id: 'novo1', ...data }; criados.push(c); return c; },
        update: async ({ data }: any) => ({ id: 'novo1', ...data }),
        findMany: async () => [],
      },
      interacoes: { create: async ({ data }: any) => { interacoes.push(data); return data; } },
      empresas: { findFirst: async () => opts.stellar ?? null },
      contratos: { findFirst: async () => null },
    };
    const webhooks: any = { dispararEvento: jest.fn(async () => undefined) };
    return { svc: new ChamadosService(prisma, webhooks), criados, interacoes };
  }

  it('número não cadastrado', async () => {
    const { svc } = montar({ usuario: null });
    const r: any = await svc.processarMensagemWhatsApp({ telefone: '5511999999999', mensagem: 'oi' });
    expect(r.status).toBe('NAO_CADASTRADO');
  });

  it('mensagem em chamado aberto vira interação', async () => {
    const usuario = { id: 'u1', empresa_id: 'e1', telefone_whatsapp: '+55 11 99999-9999', perfis_acesso: {} };
    const { svc, interacoes } = montar({ usuario, chamadoAberto: { id: 'c1', titulo: 'Aberto' } });
    const r: any = await svc.processarMensagemWhatsApp({ telefone: '11999999999', mensagem: 'mais info' });
    expect(r.status).toBe('INTERACAO_ADICIONADA');
    expect(interacoes[0]).toMatchObject({ chamado_id: 'c1', usuario_id: 'u1', mensagem: 'mais info' });
  });

  it('sem permissão de chamado externo é bloqueado', async () => {
    const usuario = { id: 'u1', empresa_id: 'e1', telefone_whatsapp: '11999999999', perfis_acesso: { can_open_stellar_ticket: false } };
    const { svc } = montar({ usuario });
    const r: any = await svc.processarMensagemWhatsApp({ telefone: '11999999999', mensagem: 'novo problema' });
    expect(r.status).toBe('SEM_PERMISSAO');
  });

  it('com permissão abre chamado novo', async () => {
    const usuario = { id: 'u1', empresa_id: 'e1', telefone_whatsapp: '11999999999', perfis_acesso: { can_open_stellar_ticket: true } };
    const { svc, criados } = montar({ usuario, stellar: { id: 'stellar1' } });
    const r: any = await svc.processarMensagemWhatsApp({ telefone: '11999999999', mensagem: 'meu sistema caiu' });
    expect(r.status).toBe('CHAMADO_CRIADO');
    expect(criados[0]).toMatchObject({ categoria: 'WHATSAPP', empresa_responsavel_id: 'stellar1', requerente_id: 'u1' });
  });
});
