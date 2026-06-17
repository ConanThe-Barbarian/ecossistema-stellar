import { useCallback, useEffect, useState } from 'react';
import { api, desembrulhar, mensagemDeErro } from '../api';

interface Fatura {
  id: string;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  url_fatura: string | null;
  linha_digitavel: string | null;
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function badgeDe(f: Fatura) {
  if (f.status === 'PAGO' || f.status === 'RECEBIDO') return <span className="badge ok">PAGO</span>;
  const vencida = new Date(f.data_vencimento) < new Date() && f.status === 'PENDENTE';
  if (vencida) return <span className="badge danger">VENCIDA</span>;
  if (f.status === 'PENDENTE') return <span className="badge warn">PENDENTE</span>;
  return <span className="badge info">{f.status}</span>;
}

export default function Faturas() {
  const [faturas, setFaturas] = useState<Fatura[] | null>(null);
  const [erro, setErro] = useState('');
  const [gerando, setGerando] = useState(false);
  const [pagandoId, setPagandoId] = useState<string | null>(null);
  const [verificandoId, setVerificandoId] = useState<string | null>(null);

  async function gerarRelatorio() {
    const empresaId = localStorage.getItem('stellar_empresa_id');
    if (!empresaId) {
      setErro('Visite a página Início uma vez antes de gerar o relatório.');
      return;
    }
    setGerando(true);
    setErro('');
    try {
      const agora = new Date();
      const { data } = await api.get(
        `/relatorios/exportar/cliente/${empresaId}?mes=${agora.getMonth() + 1}&ano=${agora.getFullYear()}`,
      );
      const nome = desembrulhar<any>(data)?.nome_arquivo ?? data?.nome_arquivo;
      const resp = await api.get(`/relatorios/meu-download/${nome}`, { responseType: 'blob' });
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-stellar-${agora.getMonth() + 1}-${agora.getFullYear()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao gerar o relatório'));
    } finally {
      setGerando(false);
    }
  }

  const carregar = useCallback(() => {
    api
      .get('/portal/faturas')
      .then(({ data }) => setFaturas(desembrulhar<Fatura[]>(data) ?? []))
      .catch((err) => setErro(mensagemDeErro(err, 'Não foi possível carregar suas faturas')));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function pagar(f: Fatura) {
    setErro('');
    try {
      let url = f.url_fatura;
      if (!url) {
        setPagandoId(f.id);
        const { data } = await api.post(`/financeiro/faturas/${f.id}/cobranca`);
        url = (desembrulhar<any>(data)?.url_fatura ?? data?.url_fatura) || null;
        carregar();
      }
      if (url) window.open(url, '_blank');
      else setErro('Não foi possível obter o link de pagamento.');
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao gerar a cobrança'));
    } finally {
      setPagandoId(null);
    }
  }

  async function verificar(f: Fatura) {
    setErro('');
    setVerificandoId(f.id);
    try {
      const { data } = await api.post(`/financeiro/faturas/${f.id}/verificar-pagamento`);
      const r: any = desembrulhar<any>(data) ?? data;
      if (r?.pago) {
        carregar();
      } else {
        setErro(r?.message || `Pagamento ainda não confirmado (status: ${r?.status ?? 'pendente'}).`);
      }
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao verificar o pagamento'));
    } finally {
      setVerificandoId(null);
    }
  }

  if (erro) return <div className="erro">{erro}</div>;
  if (!faturas) return <p className="muted">Carregando…</p>;

  return (
    <>
      <h1>
        Financeiro{' '}
        <button className="btn" style={{ float: 'right', fontSize: '0.85rem' }} onClick={gerarRelatorio} disabled={gerando}>
          {gerando ? 'Gerando PDF…' : 'Relatório Mensal'}
        </button>
      </h1>
      <div className="card">
        {faturas.length === 0 ? (
          <p className="muted">Nenhuma fatura emitida ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Pagamento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {faturas.map((f) => (
                <tr key={f.id}>
                  <td>{new Date(f.data_vencimento).toLocaleDateString('pt-BR')}</td>
                  <td>{brl(f.valor)}</td>
                  <td>{badgeDe(f)}</td>
                  <td>
                    {f.data_pagamento
                      ? new Date(f.data_pagamento).toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {f.status !== 'PAGO' && f.status !== 'RECEBIDO' && (
                        <button
                          type="button"
                          className="btn"
                          style={{ fontSize: 12, padding: '4px 10px' }}
                          disabled={pagandoId === f.id}
                          onClick={() => pagar(f)}
                        >
                          {pagandoId === f.id ? 'Gerando…' : f.url_fatura ? 'Pagar (Boleto/PIX)' : 'Gerar pagamento'}
                        </button>
                      )}
                      {f.status !== 'PAGO' && f.status !== 'RECEBIDO' && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: '4px 10px' }}
                          disabled={verificandoId === f.id}
                          onClick={() => verificar(f)}
                        >
                          {verificandoId === f.id ? 'Verificando…' : 'Verificar pagamento'}
                        </button>
                      )}
                      {f.linha_digitavel && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() => navigator.clipboard.writeText(f.linha_digitavel!)}
                        >
                          Copiar código
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
