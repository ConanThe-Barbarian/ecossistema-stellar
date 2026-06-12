import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const { data } = await api.post('/auth/login', { email, password: senha });
      localStorage.setItem('stellar_token', data.access_token);
      localStorage.setItem('stellar_user', JSON.stringify(data.user));
      navigate('/');
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

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={entrar}>
        <div className="logo">✦ Stellar</div>
        <div className="sub">Portal do Cliente — Ecossistema Stellar</div>

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
    </div>
  );
}
