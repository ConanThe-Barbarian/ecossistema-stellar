import { useEffect, useState } from 'react';
import { api, mensagemDeErro, usuarioLogado } from '../api';

export default function Conta() {
  const user = usuarioLogado();
  const [mfa, setMfa] = useState<boolean | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  // troca de senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [msgSenha, setMsgSenha] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    setMsgSenha('');
    setErroSenha('');
    if (novaSenha.length < 8) {
      setErroSenha('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (novaSenha !== confirmar) {
      setErroSenha('A confirmação não confere com a nova senha.');
      return;
    }
    setSalvandoSenha(true);
    try {
      await api.post('/auth/alterar-senha', { senhaAtual, novaSenha });
      setMsgSenha('Senha alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmar('');
    } catch (err) {
      setErroSenha(mensagemDeErro(err, 'Não foi possível alterar a senha'));
    } finally {
      setSalvandoSenha(false);
    }
  }

  useEffect(() => {
    api
      .get('/auth/mfa/status')
      .then(({ data }) => setMfa(!!data.mfa_enabled))
      .catch((err) => setErro(mensagemDeErro(err, 'Erro ao carregar status do MFA')));
  }, []);

  async function alternar() {
    if (mfa === null) return;
    setSalvando(true);
    setErro('');
    try {
      const rota = mfa ? '/auth/mfa/desativar' : '/auth/mfa/ativar';
      const { data } = await api.post(rota, {});
      setMfa(!!data.mfa_enabled);
    } catch (err) {
      setErro(mensagemDeErro(err, 'Erro ao atualizar o MFA'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <h1>🔒 Minha Conta</h1>

      <div className="card" style={{ maxWidth: 560 }}>
        <div style={{ marginBottom: 12 }}>
          <strong>{user?.nome}</strong>
          <div className="muted">{user?.email}</div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '12px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600 }}>Verificação em duas etapas (2FA)</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {mfa === null
                ? 'Carregando…'
                : mfa
                ? 'Ativada — a cada login enviamos um código para o seu e-mail.'
                : 'Desativada — o login pede apenas e-mail e senha.'}
            </div>
          </div>
          <button
            className="btn"
            onClick={alternar}
            disabled={salvando || mfa === null}
            style={{ background: mfa ? 'transparent' : undefined, whiteSpace: 'nowrap' }}
          >
            {salvando ? 'Salvando…' : mfa ? 'Desativar' : 'Ativar'}
          </button>
        </div>

        {erro && <div className="erro" style={{ marginTop: 12 }}>{erro}</div>}
      </div>

      <div className="card" style={{ maxWidth: 560, marginTop: '1.25rem' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Trocar senha</div>
        <form onSubmit={trocarSenha}>
          <label htmlFor="atual">Senha atual</label>
          <input id="atual" type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} required />
          <label htmlFor="nova">Nova senha</label>
          <input id="nova" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required />
          <label htmlFor="conf">Confirmar nova senha</label>
          <input id="conf" type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required />
          {erroSenha && <div className="erro" style={{ marginTop: 10 }}>{erroSenha}</div>}
          {msgSenha && <div style={{ color: 'var(--ok)', marginTop: 10, fontSize: 14 }}>{msgSenha}</div>}
          <button className="btn mt" type="submit" disabled={salvandoSenha}>
            {salvandoSenha ? 'Salvando…' : 'Alterar senha'}
          </button>
        </form>
      </div>
    </>
  );
}
