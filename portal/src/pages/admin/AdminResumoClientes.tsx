import { useCallback, useEffect, useState } from 'react';
import { api, desembrulhar, mensagemDeErro } from '../../api';

interface ClienteResumo {
  empresa_id: string;
  empresa: string;
  plano: string | null;
  mensalidade: number;
  faturado: number;
  recebido: number;
  em_aberto: number;
  situacao: 'EM_DIA' | 'EM_DEBITO';
  chamados_total: number;
  chamados_resolvidos: number;
}
interface Resumo {
  mes: string;
  totais: { clientes: number; faturado: number; recebido: number; em_aberto: number; chamados: number; inadimplentes: number };
  clientes: ClienteResumo[];
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AdminResumoClientes() {
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [dados, setDados] = useState<Resumo | null>(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(() => {
    setErro('');
    api
      .get(`/relatorios/resumo-clientes?mes=${mes}`)
      .then(({ data }) => setDados(desembrulhar<Resumo>(data)))
      .catch((err) => setErro(mensagemDeErro(err, 'Erro ao carregar o resumo de clientes')));
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <>
      <h1>
        Resumo de Clientes
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          style={{ width: 'auto', float: 'right' }}
        />
      </h1>
      {erro && <div className="erro">{erro}</div>}

      {dados && (
        <>
          <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
            <div className="card">
              <h3>Recebido no mês</h3>
              <div className="big" style={{ color: 'var(--ok)' }}>{brl(dados.totais.recebido)}</div>
              <p className="muted">de {brl(dados.totais.faturado)} faturados</p>
            </div>
            <div className="card">
              <h3>Em aberto</h3>
              <div className="big" style={{ color: dados.totais.em_aberto > 0 ? 'var(--warn)' : 'var(--ok)' }}>
                {brl(dados.totais.em_aberto)}
              </div>
              <p className="muted">{dados.totais.inadimplentes} cliente(s) inadimplente(s)</p>
            </div>
            <div className="card">
              <h3>Clientes / Chamados</h3>
              <div className="big">{dados.totais.clientes}</div>
              <p className="muted">{dados.totais.chamados} chamado(s) no mês</p>
            </div>
          </div>

          <div className="card">
            {dados.clientes.length === 0 ? (
              <p className="muted">Nenhum cliente cadastrado.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Plano</th>
                    <th>Faturado</th>
                    <th>Recebido</th>
                    <th>Em aberto</th>
                    <th>Situação</th>
                    <th>Chamados</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.clientes.map((c) => (
                    <tr key={c.empresa_id}>
                      <td><strong>{c.empresa}</strong></td>
                      <td className="muted">{c.plano ?? '—'}</td>
                      <td>{brl(c.faturado)}</td>
                      <td>{brl(c.recebido)}</td>
                      <td>{c.em_aberto > 0 ? brl(c.em_aberto) : '—'}</td>
                      <td>
                        <span className={`badge ${c.situacao === 'EM_DIA' ? 'ok' : 'danger'}`}>
                          {c.situacao === 'EM_DIA' ? 'EM DIA' : 'EM DÉBITO'}
                        </span>
                      </td>
                      <td className="muted">{c.chamados_resolvidos}/{c.chamados_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
