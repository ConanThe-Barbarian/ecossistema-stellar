import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { usuarioLogado } from '../api';

export default function Layout() {
  const navigate = useNavigate();
  const user = usuarioLogado();

  function sair() {
    localStorage.removeItem('stellar_token');
    localStorage.removeItem('stellar_user');
    navigate('/login');
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">✦ Stellar</div>
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          🏠 Início
        </NavLink>
        <NavLink to="/ferramentas" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          🛠️ Minhas Ferramentas
        </NavLink>
        <NavLink to="/faturas" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          💳 Financeiro
        </NavLink>
        <NavLink to="/chamados" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          🎫 Chamados
        </NavLink>
        <div className="spacer" />
        <div className="user-box">
          <strong>{user?.nome ?? 'Usuário'}</strong>
          {user?.empresa ?? ''}
          <button className="btn btn-ghost mt" style={{ width: '100%' }} onClick={sair}>
            Sair
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
