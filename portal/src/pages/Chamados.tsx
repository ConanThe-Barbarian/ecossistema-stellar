import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, desembrulhar, mensagemDeErro, usuarioLogado, ehFundador } from '../api';

interface Chamado {
  id: string;
  titulo: string;
  categoria: string;
  prioridade: string;
  status: string;
  created_at: string;
  interno?: boolean;
  tecnico_atribuido_id?: string | null;
  empresas_chamados_empresa_origem_idToempresas?: { razao_social: string } | null;
  usuarios_chamados_tecnico_atribuido_idTousuarios?: { nome: string } | null;
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
  const [aba, setAba] = useState<'GERAIS' | 'MEUS'>('GERAIS');
  const eu = usuarioLogado();
  const stellar = ehFundador();

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

  let visiveis = chamados;
  if (stellar && aba === 'MEUS') {
    visiveis = visiveis.filter((c) => c.tecnico_atribuido_id === eu?.id);
  }
  if (filtroEmpresa) {
    visiveis = visiveis.filter(
      (c) => c.empresas_chamados_empresa_origem_idToempresas?.razao_social === filtroEmpresa,
    );
  }

  return (
    <>
      <h1>
        {stellar ? 'Chamados' : 'Meus Chamados'}{' '}
        <Link to="/chamados/novo" className="btn" style={{ float: 'right', fontSize: '0.85rem' }}>
          + Novo chamado
        </Link>
      </h1>

      {stellar && (
        <div className="composer-tabs" style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className={`composer-tab${aba === 'GERAIS' ? ' active' : ''}`}
            onClick={() => setAba('GERAIS')}
          >
            Chamados Gerais
          </button>
          <button
            type="button"
            className={`composer-tab${aba === 'MEUS' ? ' active' : ''}`}
            onClick={() => setAba('MEUS')}
          >
            Meus Chamados
          </button>
        </div>
      )}

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
          <p className="muted">
            {stellar && aba === 'MEUS'
              ? 'Nenhum chamado atribuído a você.'
              : 'Nenhum chamado por aqui. Tudo tranquilo na galáxia.'}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Título</th>
                <th>Empresa</th>
                <th>Tipo</th>
                {stellar && <th>Técnico</th>}
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
                  {stellar && (
                    <td className="muted">
                      {c.usuarios_chamados_tecnico_atribuido_idTousuarios?.nome ?? 'Não atribuído'}
                    </td>
                  )}
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
