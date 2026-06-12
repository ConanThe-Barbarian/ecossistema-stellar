import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, desembrulhar, mensagemDeErro } from '../api';

interface Chamado {
  id: string;
  titulo: string;
  categoria: string;
  prioridade: string;
  status: string;
  created_at: string;
}

function badgeStatus(status: string) {
  const mapa: Record<string, string> = {
    NOVO: 'info',
    EM_ATENDIMENTO: 'warn',
    PENDENTE_CLIENTE: 'warn',
    RESOLVIDO: 'ok',
    FECHADO: 'ok',
  };
  return <span className={`badge ${mapa[status] ?? 'info'}`}>{status.replace(/_/g, ' ')}</span>;
}

export default function Chamados() {
  const [chamados, setChamados] = useState<Chamado[] | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .get('/chamados')
      .then(({ data }) => setChamados(desembrulhar<Chamado[]>(data) ?? []))
      .catch((err) => setErro(mensagemDeErro(err, 'Não foi possível carregar seus chamados')));
  }, []);

  if (erro) return <div className="erro">{erro}</div>;
  if (!chamados) return <p className="muted">Carregando…</p>;

  return (
    <>
      <h1>
        Meus Chamados{' '}
        <Link to="/chamados/novo" className="btn" style={{ float: 'right', fontSize: '0.85rem' }}>
          + Novo chamado
        </Link>
      </h1>
      <div className="card">
        {chamados.length === 0 ? (
          <p className="muted">Nenhum chamado aberto. Tudo tranquilo na galáxia ✦</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Título</th>
                <th>Categoria</th>
                <th>Prioridade</th>
                <th>Status</th>
                <th>Aberto em</th>
              </tr>
            </thead>
            <tbody>
              {chamados.map((c) => (
                <tr key={c.id}>
                  <td>{c.titulo}</td>
                  <td>{c.categoria}</td>
                  <td>{c.prioridade}</td>
                  <td>{badgeStatus(c.status)}</td>
                  <td>{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
