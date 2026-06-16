import { useCallback, useEffect, useState } from 'react';
import { api, desembrulhar, mensagemDeErro } from '../../api';

interface LinhaDre {
  empresa_id: string;
  empresa: string;
  planos: string[];
  receita: number;
  custo_fixo_direto: number;
  custo_fixo_rateado: number;
  custo_variavel: number;
  custo_total: number;
  lucro_liquido: number;
  margem_percentual: number;
  rateio_por_socio: number;
}

interface Dre {
  mes_referencia: string;
  consolidado: {
    receita_total: number;
    custo_total: number;
    lucro_liquido_total: number;
    margem_percentual: number;
    divisao_por_socio: number;
    clientes_ativos: number;
  };
  clientes: LinhaDre[];
}

interface CustoFixo {
  id: string;
  descricao: string;
  valor_mensal: number | string;
  empresa_id: string | null;
  empresas?: { razao_social: string } | null;
  status: string;
}

interface EmpresaOpt {
  id: string;
  razao_social: string;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AdminDre() {
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [dre, setDre] = useState<Dre | null>(null);
  const [custos, setCustos] = useState<CustoFixo[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOpt[]>([]);
  const [erro, setErro] = useState('');
  // form custo fixo
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    api
      .get(`/financeiro/dre?mes=${mes}`)
      .then(({ data }) => setDre(desembrulhar<Dre>(data)))
      .catch((err) => setErro(mensagemDeErro(err, 'Erro ao carregar o DRE')));
    api
      .get('/financeiro/custos-fixos')
      .then(({ data }) => setCustos(desembrulhar<CustoFixo[]>(data) ?? []))
      .catch(() => {});
  }, [mes]);

  useEffect(() => {
    carregar();
    api
      .get('/empresas')
      .then(({ data }) => setEmpresas(desembrulhar<EmpresaOpt[]>(data) ?? []))
      .catch(() => {});
  }, [carregar]);

  async function adicionarCusto(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await api.post('/financeiro/custos-fixos', {
        descricao,
        valor_mensal: Number(valor),
        ...(empresaId ? { empresa_id: empresaId } : {}),
      });
      setDescricao('');
      setValor('');
      setEmpresaId('');
      carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao cadastrar custo'));
    } finally {
      setSalvando(false);
    }
  }

  async function removerCusto(id: string) {
    try {
      await api.delete(`/financeiro/custos-fixos/${id}`);
      carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao remover custo'));
    }
  }

  return (
    <>
      <h1>
        Margem &amp; Rentabilidade
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          style={{ width: 'auto', float: 'right' }}
        />
      </h1>
      {erro && <div className="erro">{erro}</div>}

      {dre && (
        <>
          <div className="grid grid-3">
            <div className="card">
              <h3>Receita Total</h3>
              <div className="big">{brl(dre.consolidado.receita_total)}</div>
            </div>
            <div className="card">
              <h3>Lucro Líquido</h3>
              <div className="big" style={{ color: dre.consolidado.lucro_liquido_total >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
                {brl(dre.consolidado.lucro_liquido_total)}
              </div>
              <p className="muted">margem {dre.consolidado.margem_percentual}%</p>
            </div>
            <div className="card">
              <h3>Por Sócio (÷3)</h3>
              <div className="big">{brl(dre.consolidado.divisao_por_socio)}</div>
              <p className="muted">{dre.consolidado.clientes_ativos} cliente(s) ativo(s)</p>
            </div>
          </div>

          <div className="card mt">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Receita</th>
                  <th>Fixo</th>
                  <th>Rateado</th>
                  <th>Variável</th>
                  <th>Lucro</th>
                  <th>Margem</th>
                  <th>÷ Sócio</th>
                </tr>
              </thead>
              <tbody>
                {dre.clientes.map((c) => (
                  <tr key={c.empresa_id}>
                    <td>
                      {c.empresa}
                      <div className="muted" style={{ fontSize: '0.75rem' }}>{c.planos.join(', ')}</div>
                    </td>
                    <td>{brl(c.receita)}</td>
                    <td>{brl(c.custo_fixo_direto)}</td>
                    <td>{brl(c.custo_fixo_rateado)}</td>
                    <td>{brl(c.custo_variavel)}</td>
                    <td style={{ color: c.lucro_liquido >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
                      {brl(c.lucro_liquido)}
                    </td>
                    <td>{c.margem_percentual}%</td>
                    <td>{brl(c.rateio_por_socio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h1 style={{ fontSize: '1.2rem', marginTop: '2.5rem' }}>Custos Fixos Cadastrados</h1>
      <div className="grid grid-2">
        <div className="card">
          {custos.length === 0 ? (
            <p className="muted">Nenhum custo cadastrado ainda.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Descrição</th><th>Valor/mês</th><th>Cliente</th><th></th></tr>
              </thead>
              <tbody>
                {custos.map((c) => (
                  <tr key={c.id}>
                    <td>{c.descricao}</td>
                    <td>{brl(Number(c.valor_mensal))}</td>
                    <td className="muted">{c.empresas?.razao_social ?? 'GERAL (rateado)'}</td>
                    <td>
                      <button className="btn btn-ghost" onClick={() => removerCusto(c.id)} title="Remover">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <form className="card" onSubmit={adicionarCusto}>
          <h3>Novo Custo Fixo</h3>
          <label htmlFor="cf-desc">Descrição</label>
          <input id="cf-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} required placeholder="VPS Hostinger, Docker, assinatura..." />
          <label htmlFor="cf-valor">Valor mensal (R$)</label>
          <input id="cf-valor" type="number" step="0.01" min="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required />
          <label htmlFor="cf-emp">Cliente (vazio = custo geral, rateado entre todos)</label>
          <select id="cf-emp" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
            <option value="">— Custo geral da operação —</option>
            {empresas.map((e2) => (
              <option key={e2.id} value={e2.id}>{e2.razao_social}</option>
            ))}
          </select>
          <button className="btn mt" type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Cadastrar custo'}
          </button>
        </form>
      </div>
    </>
  );
}
