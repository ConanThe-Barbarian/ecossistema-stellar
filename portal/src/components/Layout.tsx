import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Home,
  Wrench,
  CreditCard,
  Ticket,
  Lock,
  LayoutDashboard,
  DollarSign,
  Zap,
  Building2,
  FileText,
  Briefcase,
  Users,
  KanbanSquare,
  ClipboardList,
} from 'lucide-react';
import { usuarioLogado, ehFundador } from '../api';
import NotificationBell from './NotificationBell';

const linkClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`;
const ICON = 18;

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
        <div className="brand">
          <img
            className="brand-logo"
            src="https://stellarsyntec.com.br/assets/logo-BezJfNUT.png"
            alt="Stellar Syntec"
          />
        </div>
        {!ehFundador() && (
          <>
            <NavLink to="/" end className={linkClass}>
              <Home size={ICON} /> Início
            </NavLink>
            <NavLink to="/ferramentas" className={linkClass}>
              <Wrench size={ICON} /> Minhas Ferramentas
            </NavLink>
            <NavLink to="/faturas" className={linkClass}>
              <CreditCard size={ICON} /> Financeiro
            </NavLink>
          </>
        )}
        <NavLink to="/chamados" className={linkClass}>
          <Ticket size={ICON} /> Chamados
        </NavLink>
        <NavLink to="/conta" className={linkClass}>
          <Lock size={ICON} /> Conta
        </NavLink>
        {ehFundador() && (
          <>
            <div className="muted" style={{ fontSize: '0.7rem', letterSpacing: '0.1em', padding: '1rem 0.9rem 0.3rem', textTransform: 'uppercase' }}>
              Torre de Controle
            </div>
            <NavLink to="/admin" end className={linkClass}>
              <LayoutDashboard size={ICON} /> Dashboard
            </NavLink>
            <NavLink to="/admin/resumo-clientes" className={linkClass}>
              <ClipboardList size={ICON} /> Resumo de Clientes
            </NavLink>
            <NavLink to="/admin/dre" className={linkClass}>
              <DollarSign size={ICON} /> Margem &amp; Rentabilidade
            </NavLink>
            <NavLink to="/admin/consumo" className={linkClass}>
              <Zap size={ICON} /> Consumo
            </NavLink>
            <NavLink to="/admin/clientes" className={linkClass}>
              <Building2 size={ICON} /> Clientes
            </NavLink>
            <NavLink to="/admin/contratos" className={linkClass}>
              <FileText size={ICON} /> Contratos
            </NavLink>
            <NavLink to="/admin/planos" className={linkClass}>
              <Briefcase size={ICON} /> Planos
            </NavLink>
            <NavLink to="/admin/usuarios" className={linkClass}>
              <Users size={ICON} /> Usuários
            </NavLink>
            <NavLink to="/admin/kanban" className={linkClass}>
              <KanbanSquare size={ICON} /> Kanban
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
        <div className="topbar">
          <NotificationBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
