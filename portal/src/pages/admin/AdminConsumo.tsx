import { useCallback, useEffect, useState } from 'react';
import { api, desembrulhar, mensagemDeErro } from '../../api';

interface Alerta {
  empresa_id: string;
  empresa: string;
  consumo_mes_reais: number;
  qtd_tokens_mes: number;
  media_historica_reais: number | null;
  meses_de_historico: number;
  desvio_percentual: number | null;
  situacao: 'CRITICO' | 'ATENCAO' | 'NORMAL' | 'SEM_HISTORICO';
}

interface RespostaAlertas {
  mes_referencia: string;
  total_em_alerta: number;
  alertas: Alerta[];
}

interface EmpresaOpt {
  id: string;
  razao_social: string;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function badgeSituacao(s: Alerta['situacao']) {
  const mapa = { CRITICO: 'danger', ATENCAO: 'warn', NORMAL: 'ok', SEM_HISTORICO: 'info' } as const;
  return <span className={`badge ${mapa[s]}`}>{s.replace('_', ' ')}</span>;
}

export default function AdminConsumo() {
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [dados, setDados] = useState<RespostaAlertas | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaOpt[]>([]);
  const [erro, setErro] = useState('');
  // form
  const [empresaId, setEmpresaId] = useState('');
  const [tokens, setTokens] = useState('');
  const [custo, setCusto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    api
      .get(`/financeiro/consumo/alertas?mes=${mes}`)
      .then(({ data }) => setDados(desembrulhar<RespostaAlertas>(data)))
      .catch((err) => setErro(mensagemDeErro(err, 'Erro ao carregar alertas')));
  }, [mes]);

  useEffect(() => {
    carregar();
    api
      .get('/empresas')
      .then(({ data }) => setEmpresas(desembrulhar<EmpresaOpt[]>(data) ?? []))
      .catch(() => {});
  }, [carregar]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await api.post('/financeiro/consumo', {
        empresa_id: empresaId,
        mes_referencia: mes,
        qtd_tokens: Number(tokens) || 0,
        custo_gerado_reais: Number(custo),
      });
      setTokens('');
      setCusto('');
      carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao registrar consumo'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <h1>
        Consumo Variável
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          style={{ width: 'auto', float: 'right' }}
        />
      </h1>
      {erro && <div className="erro">{erro}</div>}

      {dados && (
        <div className="card">
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            Régua: desvio ≥30% = ATENÇÃO · ≥60% = CRÍTICO ·{' '}
            <strong style={{ color: dados.total_em_alerta > 0 ? 'var(--warn)' : 'var(--ok)' }}>
              {dados.total_em_alerta} cliente(s) em alerta
            </strong>
          </p>
          {dados.alertas.length === 0 ? (
            <p className="muted">Nenhum consumo registrado em {dados.mes_referencia}.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Consumo no mês</th>
                  <th>Tokens</th>
                  <th>Média histórica</th>
                  <th>Desvio</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {dados.alertas.map((a) => (
                  <tr key={a.empresa_id}>
                    <td>{a.empresa}</td>
                    <td>{brl(a.consumo_mes_reais)}</td>
                    <td>{a.qtd_tokens_mes.toLocaleString('pt-BR')}</td>
                    <td className="muted">
                      {a.media_historica_reais !== null
                        ? `${brl(a.media_historica_reais)} (${a.meses_de_historico}m)`
                        : '—'}
                    </td>
                    <td style={{ color: (a.desvio_percentual ?? 0) >= 30 ? 'var(--danger)' : 'inherit' }}>
                      {a.desvio_percentual !== null ? `${a.desvio_percentual > 0 ? '+' : ''}${a.desvio_percentual}%` : '—'}
                    </td>
                    <td>{badgeSituacao(a.situacao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <h1 style={{ fontSize: '1.2rem', marginTop: '2.5rem' }}>Registrar Consumo do Mês</h1>
      <form className="card" style={{ maxWidth: 560 }} onSubmit={registrar}>
        <label htmlFor="cv-emp">Cliente</label>
        <select id="cv-emp" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} required>
          <option value="">Selecione…</option>
          {empresas.map((e2) => (
            <option key={e2.id} value={e2.id}>{e2.razao_social}</option>
          ))}
        </select>
        <label htmlFor="cv-tokens">Quantidade de tokens</label>
        <input id="cv-tokens" type="number" min="0" value={tokens} onChange={(e) => setTokens(e.target.value)} />
        <label htmlFor="cv-custo">Custo gerado (R$)</label>
        <input id="cv-custo" type="number" step="0.01" min="0" value={custo} onChange={(e) => setCusto(e.target.value)} required />
        <button className="btn mt" type="submit" disabled={salvando || !empresaId}>
          {salvando ? 'Registrando…' : `Registrar em ${mes}`}
        </button>
      </form>
    </>
  );
}
