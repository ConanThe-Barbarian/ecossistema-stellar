import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import Ferramentas from './pages/Ferramentas';
import Faturas from './pages/Faturas';
import Chamados from './pages/Chamados';
import NovoChamado from './pages/NovoChamado';
import ChamadoDetalhe from './pages/ChamadoDetalhe';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const logado = !!localStorage.getItem('stellar_token');
  return logado ? <>{children}</> : <Navigate to="/login" replace />;
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
