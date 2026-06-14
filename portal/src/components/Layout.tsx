import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { usuarioLogado, ehFundador } from '../api';

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
        <NavLink to="/conta" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          🔒 Conta
        </NavLink>
        {ehFundador() && (
          <>
            <div className="muted" style={{ fontSize: '0.7rem', letterSpacing: '0.1em', padding: '1rem 0.9rem 0.3rem', textTransform: 'uppercase' }}>
              Torre de Controle
            </div>
            <NavLink to="/admin" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              📊 Dashboard
            </NavLink>
            <NavLink to="/admin/dre" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              💰 DRE & Rateio
            </NavLink>
            <NavLink to="/admin/consumo" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              ⚡ Consumo
            </NavLink>
            <NavLink to="/admin/clientes" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              🏢 Clientes
            </NavLink>
            <NavLink to="/admin/kanban" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              🗂️ Kanban
            </NavLink>
          </>
        )}
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
