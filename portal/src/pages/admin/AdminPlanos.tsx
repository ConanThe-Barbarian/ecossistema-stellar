import { useCallback, useEffect, useState } from 'react';
import { api, desembrulhar, mensagemDeErro } from '../../api';
import { useConfirm } from '../../components/ConfirmProvider';

interface Plano {
  id: string;
  nome: string;
  tipo_preco: string;
  valor_base: number | string;
}
interface Servico {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  icone_url: string | null;
  status: string;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AdminPlanos() {
  const [planos, setPlanos] = useState<Plano[] | null>(null);
  const [erro, setErro] = useState('');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('FIXO');
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [novoServ, setNovoServ] = useState({ nome: '', descricao: '', tipo: 'SERVICO' });
  const { confirm } = useConfirm();

  const carregar = useCallback(() => {
    api
      .get('/financeiro/planos')
      .then(({ data }) => setPlanos(desembrulhar<Plano[]>(data) ?? []))
      .catch((err) => setErro(mensagemDeErro(err, 'Erro ao carregar planos')));
  }, []);

  const carregarServicos = useCallback(() => {
    api
      .get('/servicos')
      .then(({ data }) => setServicos(desembrulhar<Servico[]>(data) ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    carregar();
    carregarServicos();
  }, [carregar, carregarServicos]);

  async function salvarServico(s: Servico, patch: Partial<Servico>) {
    try {
      await api.patch(`/servicos/${s.id}`, patch);
      carregarServicos();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao salvar serviço'));
    }
  }

  async function criarServico() {
    if (!novoServ.nome) return;
    try {
      await api.post('/servicos', {
        nome: novoServ.nome,
        descricao: novoServ.descricao || undefined,
        tipo: novoServ.tipo,
      });
      setNovoServ({ nome: '', descricao: '', tipo: 'SERVICO' });
      carregarServicos();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao criar serviço'));
    }
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await api.post('/financeiro/planos', {
        nome,
        tipo_preco: tipo,
        valor_base: Number(valor),
      });
      setNome('');
      setValor('');
      carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao criar plano'));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(p: Plano) {
    const ok = await confirm({
      titulo: 'Remover plano',
      mensagem: `Remover o plano "${p.nome}"?`,
      confirmar: 'Remover',
      perigo: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/financeiro/planos/${p.id}`);
      carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível remover o plano'));
    }
  }

  if (erro && !planos) return <div className="erro">{erro}</div>;
  if (!planos) return <p className="muted">Carregando…</p>;

  return (
    <>
      <h1>Planos</h1>

      <form className="card" style={{ maxWidth: 620, marginBottom: '1.25rem' }} onSubmit={criar}>
        <div className="grid grid-2">
          <div>
            <label>Nome do plano</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div>
            <label>Tipo de preço</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="FIXO">FIXO</option>
              <option value="VARIAVEL">VARIAVEL</option>
            </select>
          </div>
          <div>
            <label>Valor base (R$)</label>
            <input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} required />
          </div>
        </div>
        {erro && <div className="erro">{erro}</div>}
        <button className="btn mt" type="submit" disabled={salvando || !nome || !valor}>
          {salvando ? 'Salvando…' : 'Criar plano'}
        </button>
      </form>

      <div className="card">
        {planos.length === 0 ? (
          <p className="muted">Nenhum plano cadastrado.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Plano</th>
                <th>Tipo</th>
                <th>Valor base</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {planos.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.nome}</strong></td>
                  <td>{p.tipo_preco}</td>
                  <td>{brl(Number(p.valor_base))}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => remover(p)}
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

      <h1 style={{ marginTop: '2rem' }}>Catálogo de Serviços</h1>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        Soluções vendidas pela Stellar. <strong>Acesso</strong> = tem login/plataforma (ex.: GalaxIA).
        <strong> Serviço</strong> = recorrente/projeto, sem login (ex.: Infraestrutura, Suporte Técnico).
      </p>
      <div className="card">
        <table>
          <thead>
            <tr><th>Nome</th><th>Descrição</th><th>Tipo</th><th>Ícone (URL)</th><th>Status</th></tr>
          </thead>
          <tbody>
            {servicos.map((s) => (
              <tr key={s.id}>
                <td>
                  <input defaultValue={s.nome} style={{ minWidth: 130 }}
                    onBlur={(e) => e.target.value !== s.nome && salvarServico(s, { nome: e.target.value })} />
                </td>
                <td>
                  <input defaultValue={s.descricao ?? ''} style={{ minWidth: 200 }}
                    onBlur={(e) => e.target.value !== (s.descricao ?? '') && salvarServico(s, { descricao: e.target.value })} />
                </td>
                <td>
                  <select defaultValue={s.tipo} onChange={(e) => salvarServico(s, { tipo: e.target.value })}>
                    <option value="ACESSO">Acesso (login)</option>
                    <option value="SERVICO">Serviço</option>
                  </select>
                </td>
                <td>
                  <input defaultValue={s.icone_url ?? ''} placeholder="opcional" style={{ minWidth: 140 }}
                    onBlur={(e) => e.target.value !== (s.icone_url ?? '') && salvarServico(s, { icone_url: e.target.value })} />
                </td>
                <td>
                  <select defaultValue={s.status} onChange={(e) => salvarServico(s, { status: e.target.value })}>
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </td>
              </tr>
            ))}
            <tr>
              <td><input placeholder="Nova solução" value={novoServ.nome} onChange={(e) => setNovoServ((n) => ({ ...n, nome: e.target.value }))} /></td>
              <td><input placeholder="Descrição" value={novoServ.descricao} onChange={(e) => setNovoServ((n) => ({ ...n, descricao: e.target.value }))} /></td>
              <td>
                <select value={novoServ.tipo} onChange={(e) => setNovoServ((n) => ({ ...n, tipo: e.target.value }))}>
                  <option value="ACESSO">Acesso (login)</option>
                  <option value="SERVICO">Serviço</option>
                </select>
              </td>
              <td></td>
              <td><button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={criarServico}>Adicionar</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
