import { useCallback, useEffect, useState } from 'react';
import { api, desembrulhar, mensagemDeErro } from '../../api';

interface Card {
  id: string;
  titulo: string;
  prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
  categoria: string;
  status: string;
  cliente: string | null;
  requerente: string | null;
  tecnico: string | null;
  tempo_gasto_minutos: number;
  sla_violado: boolean;
}
interface Coluna {
  status: string;
  chamados: Card[];
}

const TITULOS: Record<string, string> = {
  NOVO: 'Novo',
  EM_ATENDIMENTO: 'Em atendimento',
  PENDENTE_CLIENTE: 'Pendente cliente',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
};

const corPrioridade: Record<Card['prioridade'], string> = {
  URGENTE: '#ef4444',
  ALTA: '#f59e0b',
  MEDIA: '#22d3ee',
  BAIXA: '#64748b',
};

function formatarHoras(min: number) {
  if (!min) return '0min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${m}min` : ''}` : `${m}min`;
}

export default function AdminKanban() {
  const [colunas, setColunas] = useState<Coluna[]>([]);
  const [erro, setErro] = useState('');
  const [arrastando, setArrastando] = useState<string | null>(null);

  const carregar = useCallback(() => {
    api
      .get('/chamados/kanban')
      .then(({ data }) => setColunas(desembrulhar<{ colunas: Coluna[] }>(data).colunas ?? []))
      .catch((err) => setErro(mensagemDeErro(err, 'Erro ao carregar o Kanban')));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function mover(cardId: string, novoStatus: string, statusAtual: string) {
    if (novoStatus === statusAtual) return;
    // Atualização otimista
    setColunas((prev) => {
      const copia = prev.map((c) => ({ ...c, chamados: [...c.chamados] }));
      let card: Card | undefined;
      for (const c of copia) {
        const i = c.chamados.findIndex((x) => x.id === cardId);
        if (i >= 0) { card = c.chamados.splice(i, 1)[0]; break; }
      }
      if (card) {
        card.status = novoStatus;
        copia.find((c) => c.status === novoStatus)?.chamados.unshift(card);
      }
      return copia;
    });
    try {
      await api.patch(`/chamados/${cardId}`, { status: novoStatus });
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao mover o chamado'));
      carregar(); // reverte para o estado real
    }
  }

  async function apontar(cardId: string) {
    const entrada = window.prompt('Quantos minutos apontar neste chamado?');
    if (!entrada) return;
    const minutos = parseInt(entrada, 10);
    if (!minutos || minutos <= 0) return;
    try {
      await api.post(`/chamados/${cardId}/apontar-horas`, { minutos });
      carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao apontar horas'));
    }
  }

  return (
    <>
      <h1>🗂️ Kanban dos Técnicos</h1>
      {erro && <div className="erro">{erro}</div>}
      <p className="muted" style={{ marginBottom: '1rem' }}>
        Arraste os cartões entre as colunas para mudar o status. Clique em ⏱️ para apontar horas.
      </p>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
        {colunas.map((col) => (
          <div
            key={col.status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => arrastando && mover(arrastando, col.status, '')}
            style={{
              flex: '0 0 260px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: 10,
              minHeight: 200,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontWeight: 700 }}>
              <span>{TITULOS[col.status] ?? col.status}</span>
              <span className="muted">{col.chamados.length}</span>
            </div>

            {col.chamados.map((card) => (
              <div
                key={card.id}
                draggable
                onDragStart={() => setArrastando(card.id)}
                onDragEnd={() => setArrastando(null)}
                style={{
                  background: '#111827',
                  border: `1px solid ${card.sla_violado ? '#ef4444' : 'rgba(255,255,255,0.08)'}`,
                  borderLeft: `4px solid ${corPrioridade[card.prioridade]}`,
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 8,
                  cursor: 'grab',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{card.titulo}</div>
                <div className="muted" style={{ fontSize: 12 }}>{card.cliente ?? '—'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 12 }}>
                  <span className="muted">{card.tecnico ?? 'Sem técnico'}</span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {card.sla_violado && <span title="SLA violado">🚨</span>}
                    <span className="muted">{formatarHoras(card.tempo_gasto_minutos)}</span>
                    <button
                      onClick={() => apontar(card.id)}
                      title="Apontar horas"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14 }}
                    >
                      ⏱️
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
