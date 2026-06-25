import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, desembrulhar, mensagemDeErro } from '../../api';
import { useConfirm } from '../../components/ConfirmProvider';

interface Solicitacao {
  id: string; titulo: string; status: string; created_at: string;
  empresa: string | null; solicitante: string | null;
  servico_nome?: string; servico_tipo?: 'ACESSO' | 'SERVICO';
}

interface Contrato {
  id: string;
  valor_mensalidade: number | string;
  dia_vencimento: number;
  teto_ia_reais?: number | string | null;
  arquivo_contrato?: string | null;
  arquivo_nome?: string | null;
  status: string;
  empresas?: { razao_social: string } | null;
  planos?: { nome: string } | null;
}
interface Empresa { id: string; razao_social?: string; nome?: string }
interface Plano { id: string; nome: string; valor_base: number | string }

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FORM_VAZIO = { empresa_id: '', plano_id: '', valor_mensalidade: '', dia_vencimento: '10', teto_ia_reais: '' };

export default function AdminContratos() {
  const [contratos, setContratos] = useState<Contrato[] | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [erro, setErro] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ ...FORM_VAZIO });
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState<'contratos' | 'solicitacoes'>('contratos');
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const { confirm, prompt } = useConfirm();
  const navigate = useNavigate();

  async function aprovarSolicitacao(s: Solicitacao) {
    let url: string | undefined;
    if (s.servico_tipo === 'ACESSO') {
      const r = await prompt({
        titulo: `Liberar ${s.servico_nome ?? 'solução'}`,
        mensagem: 'Cole a URL de acesso (SSO) da plataforma para este cliente. Pode deixar em branco e configurar depois.',
        placeholder: 'https://...',
        confirmar: 'Aprovar e liberar',
      });
      if (r === null) return; // cancelou
      url = r || undefined;
    } else {
      const ok = await confirm({
        titulo: `Aprovar ${s.servico_nome ?? 'solicitação'}`,
        mensagem: `Confirmar a contratação e ativar o serviço para "${s.empresa ?? 'o cliente'}"?`,
        confirmar: 'Aprovar e liberar',
        cancelar: 'Voltar',
      });
      if (!ok) return;
    }
    try {
      await api.post(`/chamados/solicitacoes/${s.id}/aprovar`, url ? { url_acesso: url } : {});
      carregarSolicitacoes();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível aprovar a solicitação'));
    }
  }

  const carregar = useCallback(() => {
    api
      .get('/financeiro/contratos')
      .then(({ data }) => setContratos(desembrulhar<Contrato[]>(data) ?? []))
      .catch((err) => setErro(mensagemDeErro(err, 'Erro ao carregar contratos')));
  }, []);

  const carregarSolicitacoes = useCallback(() => {
    api
      .get('/chamados/solicitacoes')
      .then(({ data }) => setSolicitacoes(desembrulhar<Solicitacao[]>(data) ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    carregar();
    carregarSolicitacoes();
    api.get('/empresas').then(({ data }) => setEmpresas(desembrulhar<Empresa[]>(data) ?? [])).catch(() => {});
    api.get('/financeiro/planos').then(({ data }) => setPlanos(desembrulhar<Plano[]>(data) ?? [])).catch(() => {});
  }, [carregar, carregarSolicitacoes]);

  function selecionarPlano(planoId: string) {
    const p = planos.find((x) => x.id === planoId);
    setForm((f) => ({
      ...f,
      plano_id: planoId,
      valor_mensalidade: p ? String(Number(p.valor_base)) : f.valor_mensalidade,
    }));
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await api.post('/financeiro/contratos', {
        empresa_id: form.empresa_id,
        plano_id: form.plano_id,
        valor_mensalidade: Number(form.valor_mensalidade),
        dia_vencimento: Number(form.dia_vencimento),
        ...(form.teto_ia_reais ? { teto_ia_reais: Number(form.teto_ia_reais) } : {}),
      });
      setForm({ ...FORM_VAZIO });
      setMostrarForm(false);
      carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao criar contrato'));
    } finally {
      setSalvando(false);
    }
  }

  async function uploadArquivo(c: Contrato, file: File) {
    const form = new FormData();
    form.append('arquivo', file);
    try {
      await api.post(`/financeiro/contratos/${c.id}/arquivo`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível enviar o arquivo do contrato'));
    }
  }

  async function verArquivo(c: Contrato) {
    try {
      const resp = await api.get(`/financeiro/contratos/${c.id}/arquivo`, { responseType: 'blob' });
      const url = URL.createObjectURL(resp.data as Blob);
      window.open(url, '_blank');
    } catch {
      setErro('Não foi possível abrir o arquivo do contrato.');
    }
  }

  async function salvarTeto(c: Contrato, valor: string) {
    try {
      await api.patch(`/financeiro/contratos/${c.id}`, {
        teto_ia_reais: valor === '' ? 0 : Number(valor),
      });
      carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao salvar o teto de IA'));
    }
  }

  async function cancelar(c: Contrato) {
    const ok = await confirm({
      titulo: 'Cancelar contrato',
      mensagem: `Cancelar o contrato de "${c.empresas?.razao_social ?? c.id}"?`,
      confirmar: 'Cancelar contrato',
      cancelar: 'Voltar',
      perigo: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/financeiro/contratos/${c.id}`);
      carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível cancelar o contrato'));
    }
  }

  if (erro && !contratos) return <div className="erro">{erro}</div>;
  if (!contratos) return <p className="muted">Carregando…</p>;

  return (
    <>
      <h1>
        Contratos
        {aba === 'contratos' && (
          <button className="btn" style={{ float: 'right', fontSize: '0.85rem' }} onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? 'Fechar' : '+ Novo contrato'}
          </button>
        )}
      </h1>

      <div className="composer-tabs" style={{ marginBottom: '1.25rem' }}>
        <button type="button" className={`composer-tab${aba === 'contratos' ? ' active' : ''}`} onClick={() => setAba('contratos')}>
          Contratos
        </button>
        <button type="button" className={`composer-tab${aba === 'solicitacoes' ? ' active' : ''}`} onClick={() => setAba('solicitacoes')}>
          Solicitações de Contratos{solicitacoes.length ? ` (${solicitacoes.length})` : ''}
        </button>
      </div>

      {aba === 'solicitacoes' && (
        <div className="card">
          {solicitacoes.length === 0 ? (
            <p className="muted">Nenhuma solicitação de contratação no momento.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Cliente</th><th>Solução</th><th>Solicitante</th><th>Status</th><th>Recebido em</th><th></th></tr>
              </thead>
              <tbody>
                {solicitacoes.map((s) => (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/chamados/${s.id}`)}>
                    <td><strong>{s.empresa ?? '—'}</strong></td>
                    <td>{s.titulo.replace(/^Contratação:\s*/, '')}</td>
                    <td className="muted">{s.solicitante ?? '—'}</td>
                    <td><span className={`badge ${s.status === 'NOVO' ? 'info' : s.status === 'FECHADO' || s.status === 'RESOLVIDO' ? 'ok' : 'warn'}`}>{s.status.replace(/_/g, ' ')}</span></td>
                    <td>{new Date(s.created_at).toLocaleDateString('pt-BR')}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={(e) => { e.stopPropagation(); navigate(`/chamados/${s.id}`); }}>Abrir</button>
                      {s.status !== 'RESOLVIDO' && s.status !== 'FECHADO' && (
                        <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={(e) => { e.stopPropagation(); aprovarSolicitacao(s); }}>Aprovar e liberar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <small className="muted">Abra uma solicitação para ver os detalhes do formulário e responder o cliente pelo chat.</small>
        </div>
      )}

      {aba === 'contratos' && mostrarForm && (
        <form className="card" style={{ marginBottom: '1.25rem', maxWidth: 720 }} onSubmit={criar}>
          <div className="grid grid-2">
            <div>
              <label>Empresa *</label>
              <select value={form.empresa_id} onChange={(e) => setForm((f) => ({ ...f, empresa_id: e.target.value }))} required>
                <option value="">Selecione…</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.razao_social ?? emp.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Plano *</label>
              <select value={form.plano_id} onChange={(e) => selecionarPlano(e.target.value)} required>
                <option value="">Selecione…</option>
                {planos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Valor mensal (R$) *</label>
              <input type="number" step="0.01" min="0" value={form.valor_mensalidade} onChange={(e) => setForm((f) => ({ ...f, valor_mensalidade: e.target.value }))} required />
            </div>
            <div>
              <label>Dia de vencimento (1–28) *</label>
              <input type="number" min="1" max="28" value={form.dia_vencimento} onChange={(e) => setForm((f) => ({ ...f, dia_vencimento: e.target.value }))} required />
            </div>
            <div>
              <label>Teto de IA (R$/mês)</label>
              <input type="number" step="0.01" min="0" placeholder="Ex.: 400" value={form.teto_ia_reais} onChange={(e) => setForm((f) => ({ ...f, teto_ia_reais: e.target.value }))} />
              <small className="muted">Acima disso, o excedente entra no Consumo Variável do cliente.</small>
            </div>
          </div>
          {erro && <div className="erro">{erro}</div>}
          <button
            className="btn mt"
            type="submit"
            disabled={salvando || !form.empresa_id || !form.plano_id || !form.valor_mensalidade}
          >
            {salvando ? 'Salvando…' : 'Criar contrato'}
          </button>
        </form>
      )}

      {aba === 'contratos' && (
      <div className="card">
        {contratos.length === 0 ? (
          <p className="muted">Nenhum contrato cadastrado.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Plano</th>
                <th>Valor</th>
                <th>Vencimento</th>
                <th>Teto IA (R$/mês)</th>
                <th>Contrato (arquivo)</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.empresas?.razao_social ?? '—'}</strong></td>
                  <td>{c.planos?.nome ?? '—'}</td>
                  <td>{brl(Number(c.valor_mensalidade))}</td>
                  <td>dia {c.dia_vencimento}</td>
                  <td>
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={c.teto_ia_reais != null ? Number(c.teto_ia_reais) : ''}
                        placeholder="sem teto"
                        style={{ width: 100 }}
                        onBlur={(e) => {
                          const v = e.target.value;
                          const atual = c.teto_ia_reais != null ? String(Number(c.teto_ia_reais)) : '';
                          if (v !== atual) salvarTeto(c, v);
                        }}
                      />
                    </span>
                  </td>
                  <td>
                    {c.arquivo_contrato ? (
                      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => verArquivo(c)}>
                          Ver contrato
                        </button>
                        <label className="muted" style={{ fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
                          trocar
                          <input type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" style={{ display: 'none' }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadArquivo(c, f); e.target.value = ''; }} />
                        </label>
                      </span>
                    ) : (
                      <label className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px', cursor: 'pointer' }}>
                        Anexar
                        <input type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" style={{ display: 'none' }}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadArquivo(c, f); e.target.value = ''; }} />
                      </label>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${c.status === 'ATIVO' ? 'ok' : 'danger'}`}>{c.status}</span>
                  </td>
                  <td>
                    {c.status === 'ATIVO' && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => cancelar(c)}
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}
    </>
  );
}
