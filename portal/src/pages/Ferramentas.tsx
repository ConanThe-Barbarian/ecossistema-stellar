import { useEffect, useState } from 'react';
import { api, desembrulhar, mensagemDeErro } from '../api';

interface Ferramenta {
  servico_id: string;
  nome: string;
  descricao: string | null;
  icone_url: string | null;
  status_acesso: 'LIBERADO' | 'BLOQUEADO';
  url_acesso: string | null;
  token_sso: string | null;
}

export default function Ferramentas() {
  const [ferramentas, setFerramentas] = useState<Ferramenta[] | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .get('/portal/ferramentas')
      .then(({ data }) => setFerramentas(desembrulhar<Ferramenta[]>(data) ?? []))
      .catch((err) => setErro(mensagemDeErro(err, 'Não foi possível carregar suas ferramentas')));
  }, []);

  function acessar(f: Ferramenta) {
    if (!f.url_acesso) return;
    // SSO: anexa o token na URL para login automático na ferramenta
    const url = f.token_sso
      ? `${f.url_acesso}${f.url_acesso.includes('?') ? '&' : '?'}sso_token=${encodeURIComponent(f.token_sso)}`
      : f.url_acesso;
    window.open(url, '_blank', 'noopener');
  }

  if (erro) return <div className="erro">{erro}</div>;
  if (!ferramentas) return <p className="muted">Carregando…</p>;

  return (
    <>
      <h1>Minhas Ferramentas</h1>
      {ferramentas.length === 0 && (
        <p className="muted">Nenhuma ferramenta contratada ainda. Fale com a Stellar! ✦</p>
      )}
      <div className="grid grid-2">
        {ferramentas.map((f) => (
          <div className="card" key={f.servico_id}>
            <h3>
              {f.icone_url && (
                <img src={f.icone_url} alt="" style={{ height: 20, verticalAlign: 'middle', marginRight: 8 }} />
              )}
              {f.nome}
            </h3>
            <p className="muted">{f.descricao ?? 'Ferramenta do Ecossistema Stellar.'}</p>
            <div className="mt">
              {f.status_acesso === 'LIBERADO' ? (
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
    </>
  );
}
