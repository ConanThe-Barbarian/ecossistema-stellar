import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import Ferramentas from './pages/Ferramentas';
import Faturas from './pages/Faturas';
import Chamados from './pages/Chamados';
import NovoChamado from './pages/NovoChamado';
import ChamadoDetalhe from './pages/ChamadoDetalhe';
import Conta from './pages/Conta';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminDre from './pages/admin/AdminDre';
import AdminConsumo from './pages/admin/AdminConsumo';
import AdminClientes from './pages/admin/AdminClientes';
import AdminKanban from './pages/admin/AdminKanban';
import { ehFundador } from './api';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const logado = !!localStorage.getItem('stellar_token');
  return logado ? <>{children}</> : <Navigate to="/login" replace />;
}

// Torre de Controle: apenas fundadores da Stellar
function AdminRoute({ children }: { children: React.ReactNode }) {
  return ehFundador() ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Inicio />} />
        <Route path="ferramentas" element={<Ferramentas />} />
        <Route path="faturas" element={<Faturas />} />
        <Route path="chamados" element={<Chamados />} />
        <Route path="chamados/novo" element={<NovoChamado />} />
        <Route path="chamados/:id" element={<ChamadoDetalhe />} />
        <Route path="conta" element={<Conta />} />
        <Route path="admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="admin/dre" element={<AdminRoute><AdminDre /></AdminRoute>} />
        <Route path="admin/consumo" element={<AdminRoute><AdminConsumo /></AdminRoute>} />
        <Route path="admin/clientes" element={<AdminRoute><AdminClientes /></AdminRoute>} />
        <Route path="admin/kanban" element={<AdminRoute><AdminKanban /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
