import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, desembrulhar, mensagemDeErro, usuarioLogado, ehFundador } from '../api';

interface Interacao {
  id: string;
  mensagem: string;
  is_nota_interna: boolean;
  created_at: string;
  usuarios: { nome: string };
  anexos?: { id: string; nome_arquivo: string }[];
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
  const [iaCarregando, setIaCarregando] = useState('');
  const [iaResultado, setIaResultado] = useState<{ tipo: string; texto: string } | null>(null);
  const [notaInterna, setNotaInterna] = useState(false);
  const [colegas, setColegas] = useState<string[]>([]);
  const eu = usuarioLogado();

  async function rodarIa(tipo: 'resumo' | 'sentimento' | 'sugestao') {
    setIaCarregando(tipo);
    setErro('');
    try {
      const { data } = await api.get(`/chamados/${id}/ia/${tipo}`);
      const texto = data.disponivel
        ? data.resumo || data.analise || data.sugestao || ''
        : data.mensagem || 'IA não configurada.';
      setIaResultado({ tipo, texto });
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao consultar a IA'));
    } finally {
      setIaCarregando('');
    }
  }

  const carregar = useCallback(() => {
    api
      .get(`/chamados/${id}`)
      .then(({ data }) => setChamado(desembrulhar<ChamadoDetalhado>(data)))
      .catch((err) => setErro(mensagemDeErro(err, 'Não foi possível carregar o chamado')));
  }, [id]);

  useEffect(() => {
    carregar();
    // auto-refresh do chat a cada 15s
    const t = setInterval(carregar, 15000);
    return () => clearInterval(t);
  }, [carregar]);

  // Colegas da Stellar para @menção em notas internas (só para usuários Stellar)
  useEffect(() => {
    if (!ehFundador()) return;
    api
      .get('/usuarios')
      .then(({ data }) => {
        const lista = desembrulhar<any[]>(data) ?? [];
        setColegas(
          lista
            .filter((u) => u.empresas?.razao_social === eu?.empresa && u.nome !== eu?.nome)
            .map((u) => u.nome),
        );
      })
      .catch(() => {});
  }, []);

  async function abrirAnexo(nome: string) {
    try {
      const resp = await api.get(`/chamados/anexo/${nome}`, { responseType: 'blob' });
      const url = URL.createObjectURL(resp.data);
      window.open(url, '_blank');
    } catch {
      setErro('Não foi possível abrir o anexo.');
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!mensagem.trim()) return;
    setEnviando(true);
    setErro('');
    try {
      await api.post(`/chamados/${id}/interacoes`, { mensagem, is_nota_interna: notaInterna });
      setMensagem('');
      setNotaInterna(false);
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

      {ehFundador() && (
        <div className="card mt">
          <h3>🤖 Assistente IA</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" type="button" disabled={!!iaCarregando} onClick={() => rodarIa('resumo')}>
              {iaCarregando === 'resumo' ? '…' : 'Resumir'}
            </button>
            <button className="btn" type="button" disabled={!!iaCarregando} onClick={() => rodarIa('sentimento')}>
              {iaCarregando === 'sentimento' ? '…' : 'Sentimento'}
            </button>
            <button className="btn" type="button" disabled={!!iaCarregando} onClick={() => rodarIa('sugestao')}>
              {iaCarregando === 'sugestao' ? '…' : 'Sugerir resposta'}
            </button>
          </div>
          {iaResultado && (
            <div
              style={{
                marginTop: 12,
                padding: '0.75rem 1rem',
                borderRadius: 12,
                background: 'rgba(34,211,238,0.08)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {iaResultado.texto}
              {iaResultado.tipo === 'sugestao' && iaResultado.texto && (
                <div>
                  <button className="btn mt" type="button" onClick={() => setMensagem(iaResultado.texto)}>
                    Usar como resposta
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
              {i.anexos && i.anexos.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {i.anexos.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => abrirAnexo(a.nome_arquivo)}
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                    >
                      📎 {a.nome_arquivo}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <form onSubmit={enviar}>
          {ehFundador() && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={notaInterna}
                  onChange={(e) => setNotaInterna(e.target.checked)}
                />
                Nota interna (visível só para a Stellar)
              </label>
              {notaInterna && colegas.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setMensagem((m) => `${m}@${e.target.value} `);
                  }}
                  style={{ width: 'auto' }}
                >
                  <option value="">@ marcar colega…</option>
                  {colegas.map((nome) => (
                    <option key={nome} value={nome}>{nome}</option>
                  ))}
                </select>
              )}
            </div>
          )}
          <label htmlFor="mensagem">{notaInterna ? 'Nota interna' : 'Responder'}</label>
          <textarea
            id="mensagem"
            rows={3}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder={notaInterna ? 'Anotação interna da equipe Stellar…' : 'Escreva sua mensagem para a equipe…'}
            style={notaInterna ? { borderColor: 'var(--warn)', background: 'rgba(251,191,36,0.06)' } : undefined}
          />
          {erro && <div className="erro">{erro}</div>}
          <button className="btn mt" type="submit" disabled={enviando || !mensagem.trim()}>
            {enviando ? 'Enviando…' : notaInterna ? 'Salvar nota interna' : 'Enviar mensagem'}
          </button>
        </form>
      </div>
    </>
  );
}
