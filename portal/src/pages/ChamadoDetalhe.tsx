import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, desembrulhar, mensagemDeErro, usuarioLogado } from '../api';

interface Interacao {
  id: string;
  mensagem: string;
  is_nota_interna: boolean;
  created_at: string;
  usuarios: { nome: string };
}

interface ChamadoDetalhado {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: string;
  status: string;
  created_at: string;
  data_limite_solucao: string | null;
  usuarios_chamados_requerente_idTousuarios: { nome: string; email: string };
  usuarios_chamados_tecnico_atribuido_idTousuarios: { nome: string } | null;
  interacoes: Interacao[];
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

export default function ChamadoDetalhe() {
  const { id } = useParams();
  const [chamado, setChamado] = useState<ChamadoDetalhado | null>(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const eu = usuarioLogado();

  const carregar = useCallback(() => {
    api
      .get(`/chamados/${id}`)
      .then(({ data }) => setChamado(desembrulhar<ChamadoDetalhado>(data)))
      .catch((err) => setErro(mensagemDeErro(err, 'Não foi possível carregar o chamado')));
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!mensagem.trim()) return;
    setEnviando(true);
    setErro('');
    try {
      await api.post(`/chamados/${id}/interacoes`, { mensagem });
      setMensagem('');
      carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao enviar a mensagem'));
    } finally {
      setEnviando(false);
    }
  }

  if (erro && !chamado) return <div className="erro">{erro}</div>;
  if (!chamado) return <p className="muted">Carregando…</p>;

  return (
    <>
      <p>
        <Link to="/chamados" className="muted">← Voltar aos chamados</Link>
      </p>
      <h1>{chamado.titulo}</h1>

      <div className="grid grid-3">
        <div className="card">
          <h3>Status</h3>
          <div>{badgeStatus(chamado.status)}</div>
          <p className="muted mt">
            Prioridade: <strong>{chamado.prioridade}</strong> · {chamado.categoria}
          </p>
        </div>
        <div className="card">
          <h3>Atendimento</h3>
          <p className="muted">
            Técnico:{' '}
            <strong>
              {chamado.usuarios_chamados_tecnico_atribuido_idTousuarios?.nome ?? 'Aguardando atribuição'}
            </strong>
          </p>
          {chamado.data_limite_solucao && (
            <p className="muted">
              Prazo de solução:{' '}
              {new Date(chamado.data_limite_solucao).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
        <div className="card">
          <h3>Abertura</h3>
          <p className="muted">
            Por <strong>{chamado.usuarios_chamados_requerente_idTousuarios?.nome}</strong>
            <br />
            em {new Date(chamado.created_at).toLocaleString('pt-BR')}
          </p>
        </div>
      </div>

      <div className="card mt">
        <h3>Descrição</h3>
        <p style={{ whiteSpace: 'pre-wrap' }}>{chamado.descricao}</p>
      </div>

      <h1 style={{ fontSize: '1.2rem', marginTop: '2rem' }}>Conversa</h1>
      <div className="card">
        {chamado.interacoes.length === 0 && (
          <p className="muted">Nenhuma mensagem ainda. Nossa equipe responderá em breve ✦</p>
        )}
        {chamado.interacoes.map((i) => {
          const minha = i.usuarios?.nome === eu?.nome;
          return (
            <div
              key={i.id}
              style={{
                margin: '0.75rem 0',
                padding: '0.75rem 1rem',
                borderRadius: 12,
                background: i.is_nota_interna
                  ? 'rgba(251,191,36,0.08)'
                  : minha
                    ? 'rgba(124,108,255,0.12)'
                    : 'rgba(255,255,255,0.04)',
                borderLeft: i.is_nota_interna ? '3px solid var(--warn)' : 'none',
              }}
            >
              <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
                <strong>{i.usuarios?.nome}</strong>
                {i.is_nota_interna && ' · 🔒 nota interna'} ·{' '}
                {new Date(i.created_at).toLocaleString('pt-BR')}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{i.mensagem}</div>
            </div>
          );
        })}

        <form onSubmit={enviar}>
          <label htmlFor="mensagem">Responder</label>
          <textarea
            id="mensagem"
            rows={3}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Escreva sua mensagem para a equipe…"
          />
          {erro && <div className="erro">{erro}</div>}
          <button className="btn mt" type="submit" disabled={enviando || !mensagem.trim()}>
            {enviando ? 'Enviando…' : 'Enviar mensagem'}
          </button>
        </form>
      </div>
    </>
  );
}
