import { useEffect, useState } from 'react';
import { api, desembrulhar, mensagemDeErro } from '../../api';

interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj_cpf: string;
  tipo_empresa: string;
  status: string;
  email_financeiro: string | null;
  telefone_principal: string | null;
  _count?: { usuarios: number; contratos: number };
}

function fmtDoc(doc: string) {
  if (doc.length === 14)
    return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (doc.length === 11) return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return doc;
}

export default function AdminClientes() {
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    api
      .get('/empresas')
      .then(({ data }) => setEmpresas(desembrulhar<Empresa[]>(data) ?? []))
      .catch((err) => setErro(mensagemDeErro(err, 'Erro ao carregar clientes')));
  }, []);

  if (erro) return <div className="erro">{erro}</div>;
  if (!empresas) return <p className="muted">Carregando…</p>;

  const visiveis = empresas.filter(
    (e) =>
      !filtro ||
      e.razao_social.toLowerCase().includes(filtro.toLowerCase()) ||
      e.cnpj_cpf.includes(filtro.replace(/\D/g, '') || '∅'),
  );

  return (
    <>
      <h1>🏢 Clientes & Empresas</h1>
      <input
        placeholder="Buscar por nome ou CNPJ/CPF…"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        style={{ marginBottom: '1.25rem', maxWidth: 420 }}
      />
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>CNPJ/CPF</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Contratos</th>
              <th>Usuários</th>
              <th>Contato</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((e) => (
              <tr key={e.id}>
                <td>
                  <strong>{e.nome_fantasia || e.razao_social}</strong>
                  {e.nome_fantasia && (
                    <div className="muted" style={{ fontSize: '0.75rem' }}>{e.razao_social}</div>
                  )}
                </td>
                <td className="muted">{fmtDoc(e.cnpj_cpf)}</td>
                <td>{e.tipo_empresa}</td>
                <td>
                  <span className={`badge ${e.status === 'ATIVO' ? 'ok' : 'danger'}`}>{e.status}</span>
                </td>
                <td>{e._count?.contratos ?? '—'}</td>
                <td>{e._count?.usuarios ?? '—'}</td>
                <td className="muted" style={{ fontSize: '0.82rem' }}>
                  {e.email_financeiro ?? ''}
                  {e.telefone_principal ? <div>{e.telefone_principal}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visiveis.length === 0 && <p className="muted mt">Nenhuma empresa encontrada.</p>}
      </div>
    </>
  );
}
