import { useCallback, useEffect, useState } from 'react';
import { api, desembrulhar, mensagemDeErro } from '../../api';
import { useConfirm } from '../../components/ConfirmProvider';

interface Contrato {
  id: string;
  valor_mensalidade: number | string;
  dia_vencimento: number;
  status: string;
  empresas?: { razao_social: string } | null;
  planos?: { nome: string } | null;
}
interface Empresa { id: string; razao_social?: string; nome?: string }
interface Plano { id: string; nome: string; valor_base: number | string }

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FORM_VAZIO = { empresa_id: '', plano_id: '', valor_mensalidade: '', dia_vencimento: '10' };

export default function AdminContratos() {
  const [contratos, setContratos] = useState<Contrato[] | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [erro, setErro] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ ...FORM_VAZIO });
  const [salvando, setSalvando] = useState(false);
  const { confirm } = useConfirm();

  const carregar = useCallback(() => {
    api
      .get('/financeiro/contratos')
      .then(({ data }) => setContratos(desembrulhar<Contrato[]>(data) ?? []))
      .catch((err) => setErro(mensagemDeErro(err, 'Erro ao carregar contratos')));
  }, []);

  useEffect(() => {
    carregar();
    api.get('/empresas').then(({ data }) => setEmpresas(desembrulhar<Empresa[]>(data) ?? [])).catch(() => {});
    api.get('/financeiro/planos').then(({ data }) => setPlanos(desembrulhar<Plano[]>(data) ?? [])).catch(() => {});
  }, [carregar]);

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
        <button className="btn" style={{ float: 'right', fontSize: '0.85rem' }} onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Fechar' : '+ Novo contrato'}
        </button>
      </h1>

      {mostrarForm && (
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
    </>
  );
}
