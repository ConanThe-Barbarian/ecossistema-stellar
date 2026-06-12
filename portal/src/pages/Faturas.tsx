import { useEffect, useState } from 'react';
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

  useEffect(() => {
    api
      .get('/portal/faturas')
      .then(({ data }) => setFaturas(desembrulhar<Fatura[]>(data) ?? []))
      .catch((err) => setErro(mensagemDeErro(err, 'Não foi possível carregar suas faturas')));
  }, []);

  if (erro) return <div className="erro">{erro}</div>;
  if (!faturas) return <p className="muted">Carregando…</p>;

  return (
    <>
      <h1>Financeiro</h1>
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
                    {f.url_fatura && (
                      <a className="btn btn-ghost" href={f.url_fatura} target="_blank" rel="noreferrer">
                        Boleto / PIX
                      </a>
                    )}
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
