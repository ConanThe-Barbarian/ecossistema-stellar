import { useCallback, useEffect, useState } from 'react';
import { api, desembrulhar, mensagemDeErro } from '../../api';

type Gran = 'dia' | 'semana' | 'mes' | 'detalhado';

interface SerieItem { periodo: string; tokens: number; custo: number; chamadas: number; }
interface EmpresaItem { empresa_id: string; empresa: string; tokens: number; custo: number; chamadas: number; }
interface AgenteItem { agente: string; tokens: number; custo: number; chamadas: number; }
interface DetalheItem {
  id: string; empresa: string; agente: string | null; modelo: string | null; origem: string;
  tokens_prompt: number; tokens_resposta: number; tokens_total: number; custo_reais: number;
  referencia: string | null; ocorrido_em: string;
}
interface Resp {
  granularidade: Gran;
  totais: { tokens: number; custo: number; chamadas: number };
  series: SerieItem[];
  por_empresa: EmpresaItem[];
  por_agente: AgenteItem[];
  detalhe?: DetalheItem[];
}
interface TetoLinha {
  empresa_id: string; empresa: string; plano_reais: number; teto_reais: number;
  custo_ia_reais: number; tokens: number; percentual: number; excedente_reais: number;
  situacao: 'NORMAL' | 'ATENCAO' | 'EXCEDIDO';
}
interface TetosResp { mes_referencia: string; total_excedente_reais: number; clientes: TetoLinha[]; }
interface Modelo {
  id: string; nome: string; slug: string; preco_entrada_usd: number; preco_saida_usd: number; ativo: boolean; padrao: boolean;
}
interface AgenteModelo {
  id: string; agente: string; modelo_id: string | null; modelo_nome: string | null;
  tokens: number; custo: number; execucoes: number;
}
interface Cliente { id: string; razao_social: string; }

const GRANS: { v: Gran; label: string }[] = [
  { v: 'dia', label: 'Diário' },
  { v: 'semana', label: 'Semanal' },
  { v: 'mes', label: 'Mensal' },
  { v: 'detalhado', label: 'Detalhado' },
];
const LABEL_PERIODO: Record<Gran, string> = { dia: 'Dia', semana: 'Semana', mes: 'Mês', detalhado: 'Dia' };

const fmtNum = (n: number) => n.toLocaleString('pt-BR');
const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const isoHaDias = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

export default function AdminConsumoIa() {
  const [gran, setGran] = useState<Gran>('dia');
  const [de, setDe] = useState(isoHaDias(30));
  const [ate, setAte] = useState(isoHaDias(0));
  const [clienteId, setClienteId] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [agentes, setAgentes] = useState<{ agentes: AgenteModelo[]; totais: { tokens: number; custo: number; execucoes: number } } | null>(null);
  const [dados, setDados] = useState<Resp | null>(null);
  const [tetos, setTetos] = useState<TetosResp | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mostrarModelos, setMostrarModelos] = useState(false);

  const carregarTetos = useCallback(() => {
    api.get('/consumo-ia/tetos').then(({ data }) => setTetos(desembrulhar<TetosResp>(data))).catch(() => {});
  }, []);
  const carregarModelos = useCallback(() => {
    api.get('/consumo-ia/modelos').then(({ data }) => setModelos(desembrulhar<Modelo[]>(data) ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/consumo-ia/clientes').then(({ data }) => setClientes(desembrulhar<Cliente[]>(data) ?? [])).catch(() => {});
    carregarModelos();
    carregarTetos();
  }, [carregarModelos, carregarTetos]);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro('');
    api
      .get('/consumo-ia', { params: { granularidade: gran, de, ate, ...(clienteId ? { empresa_id: clienteId } : {}) } })
      .then(({ data }) => setDados(desembrulhar<Resp>(data)))
      .catch((err) => setErro(mensagemDeErro(err, 'Erro ao carregar o consumo de IA')))
      .finally(() => setCarregando(false));
  }, [gran, de, ate, clienteId]);

  const carregarAgentes = useCallback(() => {
    if (!clienteId) { setAgentes(null); return; }
    api
      .get('/consumo-ia/agentes', { params: { empresa_id: clienteId, mes: ate.slice(0, 7) } })
      .then(({ data }) => setAgentes(desembrulhar(data)))
      .catch(() => setAgentes(null));
  }, [clienteId, ate]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { carregarAgentes(); }, [carregarAgentes]);

  async function recalcular() {
    setErro('');
    try {
      await api.post('/consumo-ia/recalcular-custos');
      carregar(); carregarTetos(); carregarAgentes();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao recalcular custos'));
    }
  }

  async function trocarModeloAgente(agenteId: string, modeloId: string) {
    try {
      await api.patch(`/consumo-ia/agentes/${agenteId}`, { modelo_id: modeloId || null });
      carregarAgentes();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao trocar o modelo do agente'));
    }
  }

  async function salvarModelo(m: Modelo) {
    try {
      await api.patch(`/consumo-ia/modelos/${m.id}`, {
        nome: m.nome, preco_entrada_usd: m.preco_entrada_usd, preco_saida_usd: m.preco_saida_usd,
        ativo: m.ativo, padrao: m.padrao,
      });
      carregarModelos();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao salvar modelo'));
    }
  }

  const [novo, setNovo] = useState({ nome: '', preco_entrada_usd: '', preco_saida_usd: '' });
  async function criarModelo() {
    if (!novo.nome) return;
    try {
      await api.post('/consumo-ia/modelos', {
        nome: novo.nome,
        preco_entrada_usd: Number(novo.preco_entrada_usd || 0),
        preco_saida_usd: Number(novo.preco_saida_usd || 0),
      });
      setNovo({ nome: '', preco_entrada_usd: '', preco_saida_usd: '' });
      carregarModelos();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao criar modelo'));
    }
  }

  const maxTokens = dados ? Math.max(1, ...dados.series.map((s) => s.tokens)) : 1;

  return (
    <>
      <h1>
        Consumo de IA
        <button className="btn btn-ghost" style={{ float: 'right', fontSize: '0.8rem' }} onClick={recalcular}>
          Recalcular custos
        </button>
      </h1>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        Tokens e custo dos agentes de IA (n8n), por período, cliente e agente. O custo é calculado pelo modelo definido em cada agente.
      </p>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem' }} className="muted">Visão</label>
            <div className="composer-tabs" style={{ marginTop: 4, marginBottom: 0 }}>
              {GRANS.map((g) => (
                <button key={g.v} type="button" className={`composer-tab${gran === g.v ? ' active' : ''}`} onClick={() => setGran(g.v)}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem' }} className="muted">Cliente</label>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={{ minWidth: 240 }}>
              <option value="">Todos os clientes</option>
              {clientes.map((c) => (<option key={c.id} value={c.id}>{c.razao_social}</option>))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem' }} className="muted">De</label>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={{ width: 'auto' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem' }} className="muted">Até</label>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={{ width: 'auto' }} />
          </div>
        </div>
      </div>

      {tetos && tetos.clientes.length > 0 && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <h3>Consumo de IA vs Teto · {tetos.mes_referencia}</h3>
            <span className="muted">Excedente total: <strong>{fmtBRL(tetos.total_excedente_reais)}</strong></span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Cliente</th><th style={{ textAlign: 'right' }}>Plano</th><th style={{ textAlign: 'right' }}>Teto IA</th>
                <th style={{ textAlign: 'right' }}>Gasto IA</th><th>Uso</th><th style={{ textAlign: 'right' }}>Excedente</th><th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {tetos.clientes.map((c) => {
                const cor = c.situacao === 'EXCEDIDO' ? 'danger' : c.situacao === 'ATENCAO' ? 'warn' : 'ok';
                const barra = c.situacao === 'EXCEDIDO' ? '#ef4444' : c.situacao === 'ATENCAO' ? '#f59e0b' : '#22d3ee';
                return (
                  <tr key={c.empresa_id}>
                    <td>{c.empresa}</td>
                    <td style={{ textAlign: 'right' }} className="muted">{fmtBRL(c.plano_reais)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtBRL(c.teto_reais)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtBRL(c.custo_ia_reais)}</td>
                    <td style={{ width: '20%' }}>
                      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, height: 8 }}>
                        <div style={{ width: `${Math.min(100, c.percentual)}%`, height: 8, borderRadius: 6, background: barra }} />
                      </div>
                      <small className="muted">{c.percentual}%</small>
                    </td>
                    <td style={{ textAlign: 'right' }}>{c.excedente_reais > 0 ? fmtBRL(c.excedente_reais) : '—'}</td>
                    <td><span className={`badge ${cor}`}>{c.situacao}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <small className="muted">Quando o gasto passa do teto, o excedente é lançado automaticamente no Consumo Variável do cliente.</small>
        </div>
      )}

      {erro && <div className="erro">{erro}</div>}
      {carregando && <p className="muted">Carregando…</p>}

      {dados && !carregando && (
        <>
          <div className="grid grid-3" style={{ marginBottom: '1.25rem' }}>
            <div className="card"><h3>Tokens no período</h3><div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{fmtNum(dados.totais.tokens)}</div></div>
            <div className="card"><h3>Custo estimado</h3><div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{fmtBRL(dados.totais.custo)}</div></div>
            <div className="card"><h3>Execuções</h3><div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{fmtNum(dados.totais.chamadas)}</div></div>
          </div>

          {gran === 'detalhado' ? (
            <div className="card">
              <h3>Histórico detalhado</h3>
              {(!dados.detalhe || dados.detalhe.length === 0) ? <p className="muted">Sem registros no período.</p> : (
                <table>
                  <thead><tr><th>Data/hora</th><th>Cliente</th><th>Agente</th><th>Modelo</th><th style={{ textAlign: 'right' }}>Tokens</th><th style={{ textAlign: 'right' }}>Custo</th></tr></thead>
                  <tbody>
                    {dados.detalhe.map((d) => (
                      <tr key={d.id}>
                        <td>{new Date(d.ocorrido_em).toLocaleString('pt-BR')}</td>
                        <td>{d.empresa}</td>
                        <td className="muted">{d.agente ?? '—'}</td>
                        <td className="muted">{d.modelo ?? '—'}</td>
                        <td style={{ textAlign: 'right' }}>{fmtNum(d.tokens_total)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtBRL(d.custo_reais)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="card">
              <h3>Por {LABEL_PERIODO[gran].toLowerCase()}</h3>
              {dados.series.length === 0 ? <p className="muted">Sem registros no período.</p> : (
                <table>
                  <thead><tr><th>{LABEL_PERIODO[gran]}</th><th>Volume</th><th style={{ textAlign: 'right' }}>Tokens</th><th style={{ textAlign: 'right' }}>Custo</th><th style={{ textAlign: 'right' }}>Execuções</th></tr></thead>
                  <tbody>
                    {dados.series.map((s) => (
                      <tr key={s.periodo}>
                        <td>{s.periodo}</td>
                        <td style={{ width: '40%' }}><div style={{ background: 'rgba(0,212,255,0.18)', height: 10, borderRadius: 6, width: `${Math.round((s.tokens / maxTokens) * 100)}%`, minWidth: 4 }} /></td>
                        <td style={{ textAlign: 'right' }}>{fmtNum(s.tokens)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtBRL(s.custo)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtNum(s.chamadas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <div className="grid grid-2" style={{ marginTop: '1.25rem' }}>
            <div className="card">
              <h3>Por cliente</h3>
              {dados.por_empresa.length === 0 ? <p className="muted">Sem dados.</p> : (
                <table>
                  <thead><tr><th>Cliente</th><th style={{ textAlign: 'right' }}>Tokens</th><th style={{ textAlign: 'right' }}>Custo</th></tr></thead>
                  <tbody>{dados.por_empresa.map((e) => (<tr key={e.empresa_id}><td>{e.empresa}</td><td style={{ textAlign: 'right' }}>{fmtNum(e.tokens)}</td><td style={{ textAlign: 'right' }}>{fmtBRL(e.custo)}</td></tr>))}</tbody>
                </table>
              )}
            </div>

            <div className="card">
              <h3>Por agente {clienteId && agentes ? '(modelo editável)' : ''}</h3>
              {clienteId && agentes ? (
                agentes.agentes.length === 0 ? <p className="muted">Este cliente ainda não tem agentes com consumo.</p> : (
                  <table>
                    <thead><tr><th>Agente</th><th>Modelo</th><th style={{ textAlign: 'right' }}>Tokens</th><th style={{ textAlign: 'right' }}>Custo</th><th style={{ textAlign: 'right' }}>Exec.</th></tr></thead>
                    <tbody>
                      {agentes.agentes.map((a) => (
                        <tr key={a.id}>
                          <td>{a.agente}</td>
                          <td>
                            <select value={a.modelo_id ?? ''} onChange={(e) => trocarModeloAgente(a.id, e.target.value)} style={{ minWidth: 150 }}>
                              <option value="">— sem modelo —</option>
                              {modelos.filter((m) => m.ativo || m.id === a.modelo_id).map((m) => (<option key={m.id} value={m.id}>{m.nome}</option>))}
                            </select>
                          </td>
                          <td style={{ textAlign: 'right' }}>{fmtNum(a.tokens)}</td>
                          <td style={{ textAlign: 'right' }}>{fmtBRL(a.custo)}</td>
                          <td style={{ textAlign: 'right' }}>{fmtNum(a.execucoes)}</td>
                        </tr>
                      ))}
                      <tr style={{ fontWeight: 700, borderTop: '1px solid var(--border-soft)' }}>
                        <td>Total</td><td></td>
                        <td style={{ textAlign: 'right' }}>{fmtNum(agentes.totais.tokens)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtBRL(agentes.totais.custo)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtNum(agentes.totais.execucoes)}</td>
                      </tr>
                    </tbody>
                  </table>
                )
              ) : dados.por_agente.length === 0 ? <p className="muted">Selecione um cliente para editar o modelo por agente.</p> : (
                <table>
                  <thead><tr><th>Agente</th><th style={{ textAlign: 'right' }}>Tokens</th><th style={{ textAlign: 'right' }}>Custo</th></tr></thead>
                  <tbody>{dados.por_agente.map((a) => (<tr key={a.agente}><td>{a.agente}</td><td style={{ textAlign: 'right' }}>{fmtNum(a.tokens)}</td><td style={{ textAlign: 'right' }}>{fmtBRL(a.custo)}</td></tr>))}</tbody>
                </table>
              )}
              {!clienteId && <small className="muted">Dica: filtre por um cliente acima para escolher o modelo de cada agente.</small>}
            </div>
          </div>
        </>
      )}

      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Modelos de IA e preços</h3>
          <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => setMostrarModelos((v) => !v)}>
            {mostrarModelos ? 'Ocultar' : 'Gerenciar'}
          </button>
        </div>
        {mostrarModelos && (
          <>
            <p className="muted" style={{ fontSize: '0.82rem' }}>Preços em USD por 1.000.000 de tokens. O custo é convertido por câmbio (USD_BRL).</p>
            <table>
              <thead><tr><th>Modelo</th><th style={{ textAlign: 'right' }}>Entrada (US$/1M)</th><th style={{ textAlign: 'right' }}>Saída (US$/1M)</th><th>Padrão</th><th></th></tr></thead>
              <tbody>
                {modelos.map((m) => (
                  <tr key={m.id} style={{ opacity: m.ativo ? 1 : 0.5 }}>
                    <td>{m.nome}{!m.ativo && <span className="muted"> (inativo)</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input type="number" step="0.001" defaultValue={m.preco_entrada_usd} onChange={(e) => (m.preco_entrada_usd = Number(e.target.value))} style={{ width: 90, textAlign: 'right' }} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input type="number" step="0.001" defaultValue={m.preco_saida_usd} onChange={(e) => (m.preco_saida_usd = Number(e.target.value))} style={{ width: 90, textAlign: 'right' }} />
                    </td>
                    <td><input type="radio" name="padrao" defaultChecked={m.padrao} onChange={() => { m.padrao = true; salvarModelo(m); }} /></td>
                    <td><button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => salvarModelo(m)}>Salvar</button></td>
                  </tr>
                ))}
                <tr>
                  <td><input placeholder="Novo modelo" value={novo.nome} onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))} /></td>
                  <td><input type="number" step="0.001" placeholder="0" value={novo.preco_entrada_usd} onChange={(e) => setNovo((n) => ({ ...n, preco_entrada_usd: e.target.value }))} style={{ width: 90, textAlign: 'right' }} /></td>
                  <td><input type="number" step="0.001" placeholder="0" value={novo.preco_saida_usd} onChange={(e) => setNovo((n) => ({ ...n, preco_saida_usd: e.target.value }))} style={{ width: 90, textAlign: 'right' }} /></td>
                  <td></td>
                  <td><button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={criarModelo}>Adicionar</button></td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}
