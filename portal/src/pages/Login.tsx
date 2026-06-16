import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  // Etapa de MFA (2FA por código de e-mail)
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [emailMascarado, setEmailMascarado] = useState('');
  const [codigo, setCodigo] = useState('');

  function concluirLogin(data: any) {
    localStorage.setItem('stellar_token', data.access_token);
    localStorage.setItem('stellar_user', JSON.stringify(data.user));
    navigate('/');
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const { data } = await api.post('/auth/login', { email, password: senha });
      if (data.mfaRequired) {
        // Segunda etapa: pede o código enviado por e-mail
        setMfaToken(data.mfaToken);
        setEmailMascarado(data.email || '');
        setCodigo('');
      } else {
        concluirLogin(data);
      }
    } catch (err: any) {
      setErro(
        err.response?.status === 401
          ? 'E-mail ou senha incorretos.'
          : 'Não foi possível conectar. O servidor pode estar acordando — tente de novo.',
      );
    } finally {
      setCarregando(false);
    }
  }

  async function verificarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const { data } = await api.post('/auth/mfa/verificar', { mfaToken, codigo });
      concluirLogin(data);
    } catch (err: any) {
      setErro(
        err.response?.data?.message ||
          'Código incorreto ou expirado. Tente novamente.',
      );
    } finally {
      setCarregando(false);
    }
  }

  function voltarParaLogin() {
    setMfaToken(null);
    setCodigo('');
    setErro('');
  }

  return (
    <div className="login-wrap">
      {!mfaToken ? (
        <form className="card login-card" onSubmit={entrar}>
          <div className="brand">
            <img className="brand-logo" src="https://stellarsyntec.com.br/assets/logo-BezJfNUT.png" alt="Stellar Syntec" />
          </div>
          <div className="tagline">Onde a tecnologia encontra o Infinito</div>
          <div className="sub">Portal do Cliente</div>

          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />

          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          {erro && <div className="erro">{erro}</div>}

          <button className="btn" type="submit" disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      ) : (
        <form className="card login-card" onSubmit={verificarCodigo}>
          <div className="brand">
            <img className="brand-logo" src="https://stellarsyntec.com.br/assets/logo-BezJfNUT.png" alt="Stellar Syntec" />
          </div>
          <div className="sub">Verificação em duas etapas</div>
          <p style={{ fontSize: 14, color: '#94a3b8', margin: '8px 0 16px' }}>
            Enviamos um código de 6 dígitos para <strong>{emailMascarado}</strong>.
            Ele expira em 5 minutos.
          </p>

          <label htmlFor="codigo">Código de verificação</label>
          <input
            id="codigo"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            required
            autoFocus
            style={{ letterSpacing: 8, textAlign: 'center', fontSize: 22 }}
          />

          {erro && <div className="erro">{erro}</div>}

          <button className="btn" type="submit" disabled={carregando || codigo.length !== 6}>
            {carregando ? 'Verificando...' : 'Confirmar código'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={voltarParaLogin}
            style={{ background: 'transparent', marginTop: 8 }}
          >
            Voltar
          </button>
        </form>
      )}
    </div>
  );
}
