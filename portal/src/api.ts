import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

// Injeta o token JWT em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('stellar_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Sessão expirada → volta para o login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && location.pathname !== '/login') {
      localStorage.removeItem('stellar_token');
      localStorage.removeItem('stellar_user');
      location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil?: string;
  empresa?: string;
}

export function usuarioLogado(): Usuario | null {
  const raw = localStorage.getItem('stellar_user');
  return raw ? JSON.parse(raw) : null;
}

// Alguns endpoints respondem o dado puro, outros embrulham em { message, dados }.
// Este helper aceita os dois formatos.
export function desembrulhar<T>(data: any): T {
  if (data && typeof data === 'object' && 'dados' in data) return data.dados as T;
  return data as T;
}

// Extrai a mensagem real de erro do backend (status + detalhe)
export function mensagemDeErro(err: any, contexto: string): string {
  if (!err.response) {
    return `${contexto}: servidor não respondeu. A API está rodando? (npm run start:dev) ` +
      'Se o banco estava ocioso, aguarde alguns segundos e tente de novo.';
  }
  const { status, data } = err.response;
  const detalhe = Array.isArray(data?.message)
    ? data.message.join('; ')
    : data?.message ?? data?.error ?? '';
  return `${contexto} (HTTP ${status})${detalhe ? `: ${detalhe}` : ''}`;
}

// Fundadores da Stellar (Torre de Controle)
export function ehFundador(): boolean {
  const u = usuarioLogado();
  if (!u) return false;
  return u.perfil === 'Super Admin' || (u.empresa ?? '').toUpperCase().includes('STELLAR');
}
