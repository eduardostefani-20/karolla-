import type { AdminUser, AuthSession } from '@karolla/shared';

/**
 * AuthService — contrato de autenticação do painel administrativo.
 *
 * Implementações:
 *  - MockAuthService     (DEMO: credenciais definidas em variáveis de ambiente, token assinado por HMAC)
 *  - SupabaseAuthService (PRODUÇÃO: Supabase Auth + tabela `admins` para autorização por perfil)
 */
export interface AuthService {
  readonly provider: 'mock' | 'supabase';
  /** Retorna sessão ou lança UnauthorizedError com mensagem genérica (não revela se o e-mail existe). */
  signIn(email: string, password: string): Promise<AuthSession>;
  /** Valida o token e retorna o administrador, ou null se inválido/expirado/sem permissão. */
  verify(token: string): Promise<AdminUser | null>;
  signOut(token: string): Promise<void>;
}
