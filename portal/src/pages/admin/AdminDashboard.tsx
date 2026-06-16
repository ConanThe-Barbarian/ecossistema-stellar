import { useEffect, useState } from 'react';
import { api, desembrulhar, mensagemDeErro } from '../../api';

interface Executivo {
  mes_referencia: string;
  financeiro: {
    mrr: number;
    arr_projetado: number;
    clientes_ativos: number;
    contratos_ativos: number;
    novos_contratos_no_mes: number;
    contratos_cancelados_no_mes: number;
    churn_percentual: number;
    faturas_pendentes: { quantidade: number; valor_total: number };
    faturas_vencidas: { quantidade: number; valor_total: number };
  };
  operacional: {
    chamados_abertos_agora: number;
    chamados_novos_no_mes: number;
    chamados_resolvidos_no_mes: number;
    tempo_medio_resolucao_horas: number;
    chamados_com_sla_estourado: number;
  };
}

interface PontoMrr {
  mes: string;
  mrr: number;
  novos_contratos: number;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AdminDashboard() {
  const [dados, setDados] = useState<Executivo | null>(null);
  const [evolucao, setEvolucao] = useState<PontoMrr[]>([]);
  const [erro, setErro] = useState('');
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    api
      .get(`/dashboard/executivo?mes=${mes}`)
      .then(({ data }) => setDados(desembrulhar<Executivo>(data)))
      .catch((err) => setErro(mensagemDeErro(err, 'Erro ao carregar o dashboard')));
  }, [mes]);

  useEffect(() => {
    api
      .get('/dashboard/evolucao-mrr?meses=6')
      .then(({ data }) => setEvolucao(desembrulhar<PontoMrr[]>(data) ?? []))
      .catch(() => {});
  }, []);

  if (erro) return <div className="erro">{erro}</div>;
  if (!dados) return <p className="muted">Carregando…</p>;

  const f = dados.financeiro;
  const o = dados.operacional;
  const maxMrr = Math.max(...evolucao.map((p) => p.mrr), 1);

  return (
    <>
      <h1>
        Torre de Controle
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          style={{ width: 'auto', float: 'right' }}
        />
      </h1>

      <div className="grid grid-3">
        <div className="card">
          <h3>MRR</h3>
          <div className="big">{brl(f.mrr)}</div>
          <p className="muted">ARR projetado: {brl(f.arr_projetado)}</p>
        </div>
        <div className="card">
          <h3>Clientes Ativos</h3>
          <div className="big">{f.clientes_ativos}</div>
          <p className="muted">{f.contratos_ativos} contrato(s) · +{f.novos_contratos_no_mes} no mês</p>
        </div>
        <div className="card">
          <h3>Churn do Mês</h3>
          <div className="big">{f.churn_percentual}%</div>
          <p className="muted">{f.contratos_cancelados_no_mes} cancelamento(s)</p>
        </div>
        <div className="card">
          <h3>A Receber</h3>
          <div className="big">{brl(f.faturas_pendentes.valor_total)}</div>
          <p className="muted">
            {f.faturas_pendentes.quantidade} fatura(s) pendente(s) ·{' '}
            <span style={{ color: 'var(--danger)' }}>
              {f.faturas_vencidas.quantidade} vencida(s) ({brl(f.faturas_vencidas.valor_total)})
            </span>
          </p>
        </div>
        <div className="card">
          <h3>Chamados</h3>
          <div className="big">{o.chamados_abertos_agora}</div>
          <p className="muted">
            abertos agora · {o.chamados_novos_no_mes} novos / {o.chamados_resolvidos_no_mes} resolvidos no mês
          </p>
        </div>
        <div className="card">
          <h3>Operação</h3>
          <div className="big">{o.tempo_medio_resolucao_horas}h</div>
          <p className="muted">
            tempo médio de resolução ·{' '}
            <span style={{ color: o.chamados_com_sla_estourado > 0 ? 'var(--danger)' : 'var(--ok)' }}>
              {o.chamados_com_sla_estourado} SLA(s) estourado(s)
            </span>
          </p>
        </div>
      </div>

      <h1 style={{ fontSize: '1.2rem', marginTop: '2.5rem' }}>Evolução do MRR (6 meses)</h1>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', height: 180 }}>
          {evolucao.map((p) => (
            <div key={p.mes} style={{ flex: 1, textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: '0.7rem' }}>{brl(p.mrr)}</div>
              <div
                title={`${p.novos_contratos} novo(s) contrato(s)`}
                style={{
                  height: Math.max((p.mrr / maxMrr) * 130, 4),
                  borderRadius: '6px 6px 0 0',
                  background: 'linear-gradient(180deg, var(--accent), var(--accent-2))',
                  marginTop: 4,
                }}
              />
              <div className="muted" style={{ fontSize: '0.72rem', marginTop: 6 }}>{p.mes}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
