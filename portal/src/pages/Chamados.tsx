import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, desembrulhar, mensagemDeErro } from '../api';

interface Chamado {
  id: string;
  titulo: string;
  categoria: string;
  prioridade: string;
  status: string;
  created_at: string;
  interno?: boolean;
  empresas_chamados_empresa_origem_idToempresas?: { razao_social: string } | null;
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
  const navigate = useNavigate();
  const [chamados, setChamados] = useState<Chamado[] | null>(null);
  const [erro, setErro] = useState('');
  const [filtroEmpresa, setFiltroEmpresa] = useState('');

  useEffect(() => {
    api
      .get('/chamados')
      .then(({ data }) => setChamados(desembrulhar<Chamado[]>(data) ?? []))
      .catch((err) => setErro(mensagemDeErro(err, 'Não foi possível carregar seus chamados')));
  }, []);

  const empresas = useMemo(() => {
    const set = new Set<string>();
    (chamados ?? []).forEach((c) => {
      const nome = c.empresas_chamados_empresa_origem_idToempresas?.razao_social;
      if (nome) set.add(nome);
    });
    return [...set].sort();
  }, [chamados]);

  if (erro) return <div className="erro">{erro}</div>;
  if (!chamados) return <p className="muted">Carregando…</p>;

  const visiveis = filtroEmpresa
    ? chamados.filter((c) => c.empresas_chamados_empresa_origem_idToempresas?.razao_social === filtroEmpresa)
    : chamados;

  return (
    <>
      <h1>
        Meus Chamados{' '}
        <Link to="/chamados/novo" className="btn" style={{ float: 'right', fontSize: '0.85rem' }}>
          + Novo chamado
        </Link>
      </h1>

      {empresas.length > 1 && (
        <select
          value={filtroEmpresa}
          onChange={(e) => setFiltroEmpresa(e.target.value)}
          style={{ marginBottom: '1.25rem', maxWidth: 360 }}
        >
          <option value="">Todas as empresas</option>
          {empresas.map((nome) => (
            <option key={nome} value={nome}>{nome}</option>
          ))}
        </select>
      )}

      <div className="card">
        {visiveis.length === 0 ? (
          <p className="muted">Nenhum chamado por aqui. Tudo tranquilo na galáxia.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Título</th>
                <th>Empresa</th>
                <th>Tipo</th>
                <th>Prioridade</th>
                <th>Status</th>
                <th>Aberto em</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/chamados/${c.id}`)}>
                  <td>{c.titulo}</td>
                  <td className="muted">{c.empresas_chamados_empresa_origem_idToempresas?.razao_social ?? '—'}</td>
                  <td>
                    <span className={`badge ${c.interno ? 'info' : 'ok'}`}>
                      {c.interno ? 'Interno' : 'Stellar'}
                    </span>
                  </td>
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
