import { useCallback, useEffect, useState } from 'react';
import { api, desembrulhar, mensagemDeErro } from '../../api';

interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj_cpf: string;
  tipo_empresa: string;
  status: string;
  email_financeiro: string | null;
  telefone_principal: string | null;
  _count?: { usuarios: number; contratos: number };
}

function fmtDoc(doc: string) {
  if (doc.length === 14)
    return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (doc.length === 11) return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return doc;
}

const FORM_VAZIO = {
  razao_social: '',
  nome_fantasia: '',
  cnpj_cpf: '',
  tipo_empresa: 'CLIENTE',
  email_financeiro: '',
  telefone_principal: '',
};

export default function AdminClientes() {
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ ...FORM_VAZIO });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    api
      .get('/empresas')
      .then(({ data }) => setEmpresas(desembrulhar<Empresa[]>(data) ?? []))
      .catch((err) => setErro(mensagemDeErro(err, 'Erro ao carregar clientes')));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function campo(k: keyof typeof FORM_VAZIO, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      const payload: any = {
        razao_social: form.razao_social,
        cnpj_cpf: form.cnpj_cpf.replace(/\D/g, ''),
        tipo_empresa: form.tipo_empresa,
      };
      if (form.nome_fantasia) payload.nome_fantasia = form.nome_fantasia;
      if (form.email_financeiro) payload.email_financeiro = form.email_financeiro;
      if (form.telefone_principal) payload.telefone_principal = form.telefone_principal;
      await api.post('/empresas', payload);
      setForm({ ...FORM_VAZIO });
      setMostrarForm(false);
      carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao criar a empresa'));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(emp: Empresa) {
    if (!window.confirm(`Remover a empresa "${emp.razao_social}"? Esta ação não pode ser desfeita.`)) return;
    setErro('');
    try {
      await api.delete(`/empresas/${emp.id}`);
      carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível remover (verifique se há contrato ativo)'));
    }
  }

  if (erro && !empresas) return <div className="erro">{erro}</div>;
  if (!empresas) return <p className="muted">Carregando…</p>;

  const visiveis = empresas.filter(
    (e) =>
      !filtro ||
      e.razao_social.toLowerCase().includes(filtro.toLowerCase()) ||
      e.cnpj_cpf.includes(filtro.replace(/\D/g, '') || '∅'),
  );

  return (
    <>
      <h1>
        🏢 Clientes & Empresas
        <button
          className="btn"
          style={{ float: 'right', fontSize: '0.85rem' }}
          onClick={() => setMostrarForm((v) => !v)}
        >
          {mostrarForm ? 'Fechar' : '+ Novo cliente'}
        </button>
      </h1>

      {mostrarForm && (
        <form className="card" style={{ marginBottom: '1.25rem', maxWidth: 720 }} onSubmit={criar}>
          <div className="grid grid-2">
            <div>
              <label>Razão social *</label>
              <input value={form.razao_social} onChange={(e) => campo('razao_social', e.target.value)} required />
            </div>
            <div>
              <label>Nome fantasia</label>
              <input value={form.nome_fantasia} onChange={(e) => campo('nome_fantasia', e.target.value)} />
            </div>
            <div>
              <label>CNPJ / CPF *</label>
              <input value={form.cnpj_cpf} onChange={(e) => campo('cnpj_cpf', e.target.value)} required />
            </div>
            <div>
              <label>Tipo</label>
              <select value={form.tipo_empresa} onChange={(e) => campo('tipo_empresa', e.target.value)}>
                <option value="CLIENTE">CLIENTE</option>
                <option value="FORNECEDOR">FORNECEDOR</option>
                <option value="PARCEIRO">PARCEIRO</option>
                <option value="INTERNA">INTERNA</option>
              </select>
            </div>
            <div>
              <label>E-mail financeiro</label>
              <input type="email" value={form.email_financeiro} onChange={(e) => campo('email_financeiro', e.target.value)} />
            </div>
            <div>
              <label>Telefone (WhatsApp)</label>
              <input value={form.telefone_principal} onChange={(e) => campo('telefone_principal', e.target.value)} />
            </div>
          </div>
          {erro && <div className="erro">{erro}</div>}
          <button className="btn mt" type="submit" disabled={salvando || !form.razao_social || !form.cnpj_cpf}>
            {salvando ? 'Salvando…' : 'Cadastrar empresa'}
          </button>
        </form>
      )}

      <input
        placeholder="Buscar por nome ou CNPJ/CPF…"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        style={{ marginBottom: '1.25rem', maxWidth: 420 }}
      />
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>CNPJ/CPF</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Contratos</th>
              <th>Usuários</th>
              <th>Contato</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((e) => (
              <tr key={e.id}>
                <td>
                  <strong>{e.nome_fantasia || e.razao_social}</strong>
                  {e.nome_fantasia && (
                    <div className="muted" style={{ fontSize: '0.75rem' }}>{e.razao_social}</div>
                  )}
                </td>
                <td className="muted">{fmtDoc(e.cnpj_cpf)}</td>
                <td>{e.tipo_empresa}</td>
                <td>
                  <span className={`badge ${e.status === 'ATIVO' ? 'ok' : 'danger'}`}>{e.status}</span>
                </td>
                <td>{e._count?.contratos ?? '—'}</td>
                <td>{e._count?.usuarios ?? '—'}</td>
                <td className="muted" style={{ fontSize: '0.82rem' }}>
                  {e.email_financeiro ?? ''}
                  {e.telefone_principal ? <div>{e.telefone_principal}</div> : null}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => remover(e)}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visiveis.length === 0 && <p className="muted mt">Nenhuma empresa encontrada.</p>}
      </div>
    </>
  );
}
