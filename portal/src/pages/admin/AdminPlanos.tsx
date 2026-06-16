import { useCallback, useEffect, useState } from 'react';
import { api, desembrulhar, mensagemDeErro } from '../../api';
import { useConfirm } from '../../components/ConfirmProvider';

interface Plano {
  id: string;
  nome: string;
  tipo_preco: string;
  valor_base: number | string;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AdminPlanos() {
  const [planos, setPlanos] = useState<Plano[] | null>(null);
  const [erro, setErro] = useState('');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('FIXO');
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const { confirm } = useConfirm();

  const carregar = useCallback(() => {
    api
      .get('/financeiro/planos')
      .then(({ data }) => setPlanos(desembrulhar<Plano[]>(data) ?? []))
      .catch((err) => setErro(mensagemDeErro(err, 'Erro ao carregar planos')));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

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
    </>
  );
}
