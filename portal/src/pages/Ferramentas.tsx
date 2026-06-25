import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, desembrulhar, mensagemDeErro } from '../api';

interface Ferramenta {
  servico_id: string;
  nome: string;
  descricao: string | null;
  icone_url: string | null;
  tipo: 'ACESSO' | 'SERVICO';
  contratado: boolean;
  status_acesso: 'LIBERADO' | 'BLOQUEADO' | null;
  url_acesso: string | null;
  token_sso: string | null;
}

type Campo = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select';
  options?: string[];
  req?: boolean;
};

// Campos específicos por solução — cada uma pede o que importa pra montar a proposta.
const CAMPOS_POR_SERVICO: Record<string, Campo[]> = {
  'Automações': [
    { name: 'processo', label: 'Que processo você quer automatizar?', type: 'textarea', req: true },
    { name: 'ferramentas', label: 'Sistemas/ferramentas envolvidos (ex.: WhatsApp, Planilhas, ERP)', type: 'text' },
    { name: 'volume', label: 'Volume/frequência (ex.: 200 pedidos/dia)', type: 'text' },
    { name: 'resultado', label: 'Resultado esperado', type: 'textarea' },
  ],
  'Desenvolvimento': [
    { name: 'tipo', label: 'Tipo de projeto', type: 'select', options: ['Site', 'Aplicativo', 'Sistema web', 'API/Integração', 'Outro'], req: true },
    { name: 'descricao', label: 'Descreva o projeto', type: 'textarea', req: true },
    { name: 'integracoes', label: 'Integrações necessárias (pagamentos, CRM, etc.)', type: 'text' },
    { name: 'prazo', label: 'Prazo desejado', type: 'text' },
  ],
  'GalaxIA': [
    { name: 'canais', label: 'Canais de atendimento (WhatsApp, Instagram, etc.)', type: 'text', req: true },
    { name: 'atendentes', label: 'Quantos atendentes?', type: 'number' },
    { name: 'volume', label: 'Volume de mensagens por mês (aprox.)', type: 'text' },
    { name: 'ia', label: 'Quer bot/IA no atendimento?', type: 'select', options: ['Sim', 'Não', 'Não sei'] },
    { name: 'integracoes', label: 'Integrações (CRM, agenda, ERP...)', type: 'text' },
  ],
  'Infraestrutura': [
    { name: 'tipo', label: 'O que você precisa?', type: 'select', options: ['Servidores', 'Redes', 'Computadores/Notebooks', 'Cloud', 'Outro'], req: true },
    { name: 'quantidade', label: 'Quantidade aproximada', type: 'text' },
    { name: 'local', label: 'Local / cidade', type: 'text' },
    { name: 'urgencia', label: 'Urgência', type: 'select', options: ['Baixa', 'Média', 'Alta'] },
  ],
  'Suporte Técnico': [
    { name: 'estacoes', label: 'Nº de usuários/estações a atender', type: 'number', req: true },
    { name: 'cobertura', label: 'Horário de cobertura', type: 'select', options: ['Comercial (8x5)', 'Estendido', '24x7'] },
    { name: 'sistemas', label: 'Principais sistemas/ferramentas usados', type: 'text' },
    { name: 'sla', label: 'Expectativa de tempo de resposta (SLA)', type: 'text' },
  ],
};
const CAMPOS_PADRAO: Campo[] = [
  { name: 'necessidade', label: 'Descreva sua necessidade', type: 'textarea', req: true },
  { name: 'prazo', label: 'Prazo desejado', type: 'text' },
  { name: 'orcamento', label: 'Orçamento estimado (opcional)', type: 'text' },
];

export default function Ferramentas() {
  const [ferramentas, setFerramentas] = useState<Ferramenta[] | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [formServico, setFormServico] = useState<Ferramenta | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  function carregar() {
    api
      .get('/portal/ferramentas')
      .then(({ data }) => setFerramentas(desembrulhar<Ferramenta[]>(data) ?? []))
      .catch((err) => setErro(mensagemDeErro(err, 'Não foi possível carregar suas ferramentas')));
  }
  useEffect(() => { carregar(); }, []);

  function acessar(f: Ferramenta) {
    if (!f.url_acesso) return;
    const url = f.token_sso
      ? `${f.url_acesso}${f.url_acesso.includes('?') ? '&' : '?'}sso_token=${encodeURIComponent(f.token_sso)}`
      : f.url_acesso;
    window.open(url, '_blank', 'noopener');
  }

  function abrirForm(f: Ferramenta) {
    setValores({});
    setFormServico(f);
  }

  const campos = formServico ? (CAMPOS_POR_SERVICO[formServico.nome] ?? CAMPOS_PADRAO) : [];
  const faltaObrigatorio = campos.some((c) => c.req && !valores[c.name]?.trim());

  async function enviarSolicitacao() {
    if (!formServico) return;
    setEnviando(true);
    setErro('');
    setAviso('');
    try {
      const respostas = campos
        .filter((c) => valores[c.name]?.trim())
        .map((c) => ({ label: c.label, valor: valores[c.name] }));
      const { data } = await api.post(`/portal/contratar/${formServico.servico_id}`, { respostas });
      const r = desembrulhar<{ ja_solicitado?: boolean }>(data);
      setAviso(
        r?.ja_solicitado
          ? `Você já tem uma solicitação aberta para "${formServico.nome}". A Stellar está cuidando disso.`
          : `Solicitação de "${formServico.nome}" enviada! A Stellar vai analisar e retornar com uma proposta.`,
      );
      setFormServico(null);
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível enviar a solicitação'));
    } finally {
      setEnviando(false);
    }
  }

  if (erro && !ferramentas) return <div className="erro">{erro}</div>;
  if (!ferramentas) return <p className="muted">Carregando…</p>;

  return (
    <>
      <h1>Minhas Ferramentas</h1>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        Soluções da Stellar Syntec. As contratadas você acessa direto; as demais, é só solicitar a contratação.
      </p>
      {aviso && <div className="card" style={{ borderLeft: '3px solid var(--accent)', marginBottom: '1rem' }}>{aviso}</div>}
      {erro && <div className="erro">{erro}</div>}

      <div className="grid grid-2">
        {ferramentas.map((f) => (
          <div className="card" key={f.servico_id} style={{ opacity: f.contratado ? 1 : 0.92 }}>
            <h3>
              {f.icone_url && (
                <img src={f.icone_url} alt="" style={{ height: 20, verticalAlign: 'middle', marginRight: 8 }} />
              )}
              {f.nome}
            </h3>
            <p className="muted">{f.descricao ?? 'Solução do Ecossistema Stellar.'}</p>
            <div className="mt">
              {!f.contratado ? (
                <button className="btn btn-ghost" onClick={() => abrirForm(f)}>Contratar</button>
              ) : f.tipo === 'SERVICO' ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={`badge ${f.status_acesso === 'BLOQUEADO' ? 'warn' : 'ok'}`}>
                    {f.status_acesso === 'BLOQUEADO' ? 'Pausado' : 'Serviço ativo'}
                  </span>
                  <button className="btn btn-ghost" onClick={() => navigate('/chamados/novo')}>
                    Abrir chamado
                  </button>
                </div>
              ) : f.status_acesso === 'LIBERADO' ? (
                <button className="btn" onClick={() => acessar(f)} disabled={!f.url_acesso}>
                  Acessar {f.token_sso ? '(login automático)' : ''}
                </button>
              ) : (
                <span className="badge danger">ACESSO BLOQUEADO</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {formServico && (
        <div className="modal-overlay" onClick={() => !enviando && setFormServico(null)}>
          <div className="modal-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3>Contratar: {formServico.nome}</h3>
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              Conte pra gente o que você precisa — assim montamos a proposta certa.
            </p>
            {campos.map((c) => (
              <div key={c.name} style={{ marginBottom: 10 }}>
                <label>{c.label}{c.req ? ' *' : ''}</label>
                {c.type === 'textarea' ? (
                  <textarea rows={3} value={valores[c.name] ?? ''} onChange={(e) => setValores((v) => ({ ...v, [c.name]: e.target.value }))} />
                ) : c.type === 'select' ? (
                  <select value={valores[c.name] ?? ''} onChange={(e) => setValores((v) => ({ ...v, [c.name]: e.target.value }))}>
                    <option value="">Selecione…</option>
                    {c.options?.map((o) => (<option key={o} value={o}>{o}</option>))}
                  </select>
                ) : (
                  <input type={c.type} value={valores[c.name] ?? ''} onChange={(e) => setValores((v) => ({ ...v, [c.name]: e.target.value }))} />
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn" onClick={enviarSolicitacao} disabled={enviando || faltaObrigatorio}>
                {enviando ? 'Enviando…' : 'Enviar solicitação'}
              </button>
              <button className="btn btn-ghost" onClick={() => setFormServico(null)} disabled={enviando}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
