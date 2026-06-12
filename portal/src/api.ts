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
