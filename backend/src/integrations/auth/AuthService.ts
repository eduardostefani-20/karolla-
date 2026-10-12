/**
 * AuthService — IDENTIDADE dos usuários (equipe e clientes).
 *
 * Só responde "quem é" (e-mail/senha, tokens, recuperação de senha). O que cada um pode fazer é
 * decidido depois: equipe → tabela `admins` (perfil + permissões); clientes → `customers.user_id`.
 *
 * Implementações:
 *  - MockAuthService     (DEMO/testes: usuários em memória, senha com scrypt, token HMAC)
 *  - SupabaseAuthService (PRODUÇÃO: Supabase Auth — senhas com bcrypt no Supabase)
 */
export interface AuthIdentity {
  userId: string;
  email: string;
  /** Nome informado no cadastro (metadados). */
  name: string;
}

export interface AuthTokens {
  token: string;
  refreshToken?: string;
  expiresAt: string;
}

export interface SignUpResult {
  identity: AuthIdentity;
  /** true = o Supabase enviou e-mail de confirmação; o login só funciona depois de confirmar. */
  needsConfirmation: boolean;
  tokens: AuthTokens | null;
}

export interface AuthService {
  readonly provider: 'mock' | 'supabase';
  /** Lança UnauthorizedError com mensagem genérica (não revela se o e-mail existe). */
  signIn(email: string, password: string): Promise<{ identity: AuthIdentity; tokens: AuthTokens }>;
  /** Token válido → identidade; inválido/expirado → null. */
  verify(token: string): Promise<AuthIdentity | null>;
  refresh(refreshToken: string): Promise<{ identity: AuthIdentity; tokens: AuthTokens }>;
  signOut(token: string): Promise<void>;
  /** Cadastro feito pelo próprio usuário (portal do cliente). */
  signUp(input: { email: string; password: string; name: string; metadata?: Record<string, string>; redirectTo: string }): Promise<SignUpResult>;
  /** Conta criada pela administradora (e-mail já confirmado). */
  createUser(input: { email: string; password: string; name: string }): Promise<AuthIdentity>;
  /** Busca por e-mail (sem diferenciar maiúsculas). Uso interno do servidor. */
  findUserByEmail(email: string): Promise<AuthIdentity | null>;
  setPassword(userId: string, password: string): Promise<void>;
  /** Confere a senha atual (troca de senha pelo próprio usuário). */
  checkPassword(email: string, password: string): Promise<boolean>;
  /** Envia o link de redefinição. Nunca revela se o e-mail existe. */
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  /** Conclui a redefinição com o token recebido no link. */
  completePasswordReset(recoveryToken: string, newPassword: string): Promise<void>;
  /** Encerra todas as sessões do usuário (desativação/revogação). */
  revokeSessions(userId: string): Promise<void>;
  updateProfile(userId: string, data: { name?: string; email?: string }): Promise<void>;
}
