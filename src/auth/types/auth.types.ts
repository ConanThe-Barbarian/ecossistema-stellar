// Define os dois níveis de poder no sistema
export type UserScope = 'global' | 'local';

// Extende a requisição do Express para incluir o escopo
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    empresa_id: string;
    email: string;
  };
  userScope: UserScope;
}