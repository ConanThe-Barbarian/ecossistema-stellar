import { useCallback, useEffect, useState } from 'react';
import { api, desembrulhar, mensagemDeErro } from '../../api';
import { useConfirm } from '../../components/ConfirmProvider';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  status?: string;
  perfis_acesso?: { nome: string } | null;
  empresas?: { razao_social: string } | null;
}
interface Opt { id: string; nome?: string; razao_social?: string }

const FORM_VAZIO = { nome: '', email: '', senha: '', empresa_id: '', perfil_id: '', telefone_whatsapp: '' };

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [empresas, setEmpresas] = useState<Opt[]>([]);
  const [perfis, setPerfis] = useState<Opt[]>([]);
  const [erro, setErro] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ ...FORM_VAZIO });
  const [salvando, setSalvando] = useState(false);
  const { confirm } = useConfirm();

  const carregar = useCallback(() => {
    api
      .get('/usuarios')
      .then(({ data }) => setUsuarios(desembrulhar<Usuario[]>(data) ?? []))
      .catch((err) => setErro(mensagemDeErro(err, 'Erro ao carregar usuários')));
  }, []);

  useEffect(() => {
    carregar();
    api.get('/empresas').then(({ data }) => setEmpresas(desembrulhar<Opt[]>(data) ?? [])).catch(() => {});
    api.get('/usuarios/perfis').then(({ data }) => setPerfis(desembrulhar<Opt[]>(data) ?? [])).catch(() => {});
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
        nome: form.nome,
        email: form.email,
        senha: form.senha,
        empresa_id: form.empresa_id,
        perfil_id: form.perfil_id,
      };
      if (form.telefone_whatsapp) payload.telefone_whatsapp = form.telefone_whatsapp;
      await api.post('/usuarios', payload);
      setForm({ ...FORM_VAZIO });
      setMostrarForm(false);
      carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao criar usuário'));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(u: Usuario) {
    const ok = await confirm({
      titulo: 'Remover usuário',
      mensagem: `Remover o usuário "${u.nome}" (${u.email})?`,
      confirmar: 'Remover',
      perigo: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/usuarios/${u.id}`);
      carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível remover o usuário'));
    }
  }

  if (erro && !usuarios) return <div className="erro">{erro}</div>;
  if (!usuarios) return <p className="muted">Carregando…</p>;

  return (
    <>
      <h1>
        Usuários
        <button className="btn" style={{ float: 'right', fontSize: '0.85rem' }} onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Fechar' : '+ Novo usuário'}
        </button>
      </h1>

      {mostrarForm && (
        <form className="card" style={{ marginBottom: '1.25rem', maxWidth: 720 }} onSubmit={criar}>
          <div className="grid grid-2">
            <div>
              <label>Nome *</label>
              <input value={form.nome} onChange={(e) => campo('nome', e.target.value)} required />
            </div>
            <div>
              <label>E-mail *</label>
              <input type="email" value={form.email} onChange={(e) => campo('email', e.target.value)} required />
            </div>
            <div>
              <label>Senha inicial * (mín. 8)</label>
              <input type="password" value={form.senha} onChange={(e) => campo('senha', e.target.value)} required />
            </div>
            <div>
              <label>Telefone (WhatsApp)</label>
              <input value={form.telefone_whatsapp} onChange={(e) => campo('telefone_whatsapp', e.target.value)} />
            </div>
            <div>
              <label>Empresa *</label>
              <select value={form.empresa_id} onChange={(e) => campo('empresa_id', e.target.value)} required>
                <option value="">Selecione…</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.razao_social ?? emp.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Perfil de acesso *</label>
              <select value={form.perfil_id} onChange={(e) => campo('perfil_id', e.target.value)} required>
                <option value="">Selecione…</option>
                {perfis.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>
          {erro && <div className="erro">{erro}</div>}
          <button
            className="btn mt"
            type="submit"
            disabled={salvando || !form.nome || !form.email || form.senha.length < 8 || !form.empresa_id || !form.perfil_id}
          >
            {salvando ? 'Salvando…' : 'Cadastrar usuário'}
          </button>
        </form>
      )}

      <div className="card">
        {usuarios.length === 0 ? (
          <p className="muted">Nenhum usuário cadastrado.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Empresa</th>
                <th>Perfil</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.nome}</strong></td>
                  <td className="muted">{u.email}</td>
                  <td>{u.empresas?.razao_social ?? '—'}</td>
                  <td>{u.perfis_acesso?.nome ?? '—'}</td>
                  <td>
                    <span className={`badge ${u.status === 'ATIVO' ? 'ok' : 'warn'}`}>{u.status ?? '—'}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => remover(u)}
                    >
                      Remover
                    </button>
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
