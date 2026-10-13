import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { AppError, InvalidCredentialsError, UnauthorizedError, ValidationError } from '../../utils/errors';
import { errorMeta, logger } from '../../utils/logger';
import type { AuthIdentity, AuthService, AuthTokens, SignUpResult } from './AuthService';

/**
 * PRODUÇÃO — Supabase Auth (senhas com hash bcrypt no Supabase; o servidor nunca guarda senhas).
 *  - Chave ANON: login, cadastro, renovação, envio do link de redefinição.
 *  - Chave SERVICE ROLE (só no servidor): contas criadas pela administradora, troca de senha, encerrar sessão.
 */
export class SupabaseAuthService implements AuthService {
  readonly provider = 'supabase' as const;
  private readonly anon: SupabaseClient;
  private readonly admin: SupabaseClient;
  private cache = new Map<string, { identity: AuthIdentity; until: number }>();

  constructor(
    private readonly url: string,
    private readonly anonKey: string,
    serviceRoleKey: string,
  ) {
    const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    this.anon = createClient(url, anonKey, opts);
    this.admin = createClient(url, serviceRoleKey, opts);
  }

  private identity(user: User): AuthIdentity {
    const whatsapp = typeof user.user_metadata?.whatsapp === 'string' ? user.user_metadata.whatsapp : undefined;
    return {
      userId: user.id,
      email: user.email ?? '',
      name: String(user.user_metadata?.name ?? ''),
      emailConfirmed: confirmedByLink(user),
      ...(whatsapp ? { whatsapp } : {}),
    };
  }

  private tokens(session: { access_token: string; refresh_token: string; expires_at?: number }): AuthTokens {
    return {
      token: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: new Date((session.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000).toISOString(),
    };
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.anon.auth.signInWithPassword({ email, password });
    if (error?.message?.toLowerCase().includes('not confirmed')) {
      throw new UnauthorizedError('Confirme seu e-mail pelo link que enviamos antes de entrar.');
    }
    if (error || !data.session || !data.user) throw new InvalidCredentialsError();
    return { identity: this.identity(data.user), tokens: this.tokens(data.session) };
  }

  async verify(token: string): Promise<AuthIdentity | null> {
    const cached = this.cache.get(token);
    if (cached && cached.until > Date.now()) return cached.identity;
    const { data, error } = await this.anon.auth.getUser(token);
    if (error || !data.user) return null;
    const identity = this.identity(data.user);
    this.cache.set(token, { identity, until: Date.now() + 60_000 });
    if (this.cache.size > 5000) this.cache.clear();
    return identity;
  }

  async refresh(refreshToken: string) {
    const { data, error } = await this.anon.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) throw new UnauthorizedError('Sessão expirada. Entre novamente.');
    return { identity: this.identity(data.user), tokens: this.tokens(data.session) };
  }

  async signOut(token: string) {
    this.cache.delete(token);
    const { error } = await this.admin.auth.admin.signOut(token, 'local');
    if (error) logger.warn('Falha ao encerrar sessão no Supabase', errorMeta(error));
  }

  async signUp(input: { email: string; password: string; name: string; metadata?: Record<string, string>; redirectTo: string }): Promise<SignUpResult> {
    const { data, error } = await this.anon.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { name: input.name, ...(input.metadata ?? {}) }, emailRedirectTo: input.redirectTo },
    });
    if (error) {
      const msg = error.message?.toLowerCase() ?? '';
      if (msg.includes('registered')) {
        throw new ValidationError('Este e-mail já tem cadastro. Entre ou recupere a senha.', { email: 'E-mail já cadastrado.' });
      }
      if (msg.includes('password')) throw new ValidationError('Senha fraca. Use pelo menos 8 caracteres, com letras e números.', { password: 'Senha fraca.' });
      // Ex.: SMTP não configurado no Supabase (o envio padrão só aceita e-mails da equipe do projeto) ou limite de envios.
      logger.warn('Cadastro de cliente recusado pelo Supabase Auth', { status: error.status, code: error.code, message: error.message });
      if (msg.includes('rate limit')) throw new AppError(429, 'EMAIL_RATE_LIMIT', 'Muitos cadastros em pouco tempo. Aguarde alguns minutos e tente de novo.');
      if (msg.includes('email') && (msg.includes('send') || msg.includes('authorized') || msg.includes('smtp'))) {
        throw new AppError(503, 'EMAIL_NOT_SENT', 'Não conseguimos enviar o e-mail de confirmação agora. Tente mais tarde ou fale com a gente pelo WhatsApp.');
      }
      throw new ValidationError('Não foi possível criar a conta agora. Tente novamente.');
    }
    if (!data.user) throw new ValidationError('Não foi possível criar a conta agora. Tente novamente.');
    return {
      identity: this.identity(data.user),
      needsConfirmation: !data.session,
      tokens: data.session ? this.tokens(data.session) : null,
    };
  }

  async createUser(input: { email: string; password: string; name: string }) {
    const { data, error } = await this.admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name },
    });
    if (error || !data.user) {
      if (error?.message?.toLowerCase().includes('already')) throw new ValidationError('Já existe uma conta com este e-mail.', { email: 'E-mail já cadastrado.' });
      throw new ValidationError('Não foi possível criar a conta. Confira o e-mail e a senha.');
    }
    return this.identity(data.user);
  }

  async findUserById(userId: string) {
    const { data, error } = await this.admin.auth.admin.getUserById(userId);
    return error || !data.user ? null : this.identity(data.user);
  }

  async findUserByEmail(email: string) {
    const { data, error } = await this.admin.from('users').select('id, email, name').ilike('email', email.trim()).maybeSingle();
    if (error || !data) return null;
    const { data: full } = await this.admin.auth.admin.getUserById(String(data.id));
    return full.user ? this.identity(full.user) : null;
  }

  async setPassword(userId: string, password: string) {
    const { error } = await this.admin.auth.admin.updateUserById(userId, { password });
    if (error) throw new ValidationError('Não foi possível trocar a senha. Use letras e números (8+ caracteres).', { password: 'Senha recusada.' });
  }

  async checkPassword(email: string, password: string) {
    const probe = createClient(this.url, this.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await probe.auth.signInWithPassword({ email, password });
    if (data.session) await this.admin.auth.admin.signOut(data.session.access_token, 'local').catch(() => undefined);
    return !error && Boolean(data.user);
  }

  async requestPasswordReset(email: string, redirectTo: string) {
    const { error } = await this.anon.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) logger.warn('Falha ao pedir redefinição de senha', errorMeta(error));
  }

  async completePasswordReset(recoveryToken: string, newPassword: string) {
    const { data, error } = await this.anon.auth.getUser(recoveryToken);
    if (error || !data.user || !isRecoveryToken(recoveryToken)) {
      throw new UnauthorizedError('O link de redefinição expirou ou já foi usado. Peça um novo.');
    }
    await this.setPassword(data.user.id, newPassword);
    await this.admin.auth.admin.signOut(recoveryToken, 'global').catch(() => undefined);
  }

  async revokeSessions(userId: string) {
    // Contas desativadas já são recusadas em toda requisição (tabela admins). Limpa o cache local.
    for (const [token, entry] of this.cache) if (entry.identity.userId === userId) this.cache.delete(token);
  }

  async requestEmailChange(token: string, newEmail: string, redirectTo: string) {
    // Feito com o token do próprio usuário: o Supabase envia o link de confirmação ao novo e-mail.
    const res = await fetch(`${this.url.replace(/\/$/, '')}/auth/v1/user?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'PUT',
      headers: { apikey: this.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail }),
    }).catch(() => null);
    if (!res?.ok) throw new ValidationError('Não foi possível trocar o e-mail agora. Confira o endereço e tente novamente.', { email: 'E-mail recusado.' });
    this.cache.clear();
  }

  async updateProfile(userId: string, data: { name?: string; email?: string }) {
    const { error } = await this.admin.auth.admin.updateUserById(userId, {
      ...(data.email ? { email: data.email } : {}),
      ...(data.name ? { user_metadata: { name: data.name } } : {}),
    });
    if (error) throw new ValidationError('Não foi possível atualizar a conta.');
    const patch: Record<string, string> = {};
    if (data.name) patch.name = data.name;
    if (data.email) patch.email = data.email;
    if (Object.keys(patch).length) await this.admin.from('users').update(patch).eq('id', userId);
  }
}

/**
 * E-mail confirmado PELO LINK. Se a confirmação de e-mail do Supabase estiver desligada, o login nasce
 * "confirmado" no mesmo instante do cadastro — nesse caso NÃO tratamos como confirmado, para que ninguém
 * crie uma conta com o e-mail de outra pessoa e veja o cadastro dela.
 */
function confirmedByLink(user: User): boolean {
  if (!user.email_confirmed_at) return false;
  return Date.parse(user.email_confirmed_at) - Date.parse(user.created_at) > 5_000;
}

/**
 * O token do link de redefinição tem `amr` = recovery/otp. Isso impede que um token de sessão comum
 * (de um login normal) seja usado para trocar a senha sem a senha atual.
 */
function isRecoveryToken(token: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { amr?: { method?: string }[] };
    return Boolean(payload.amr?.some((a) => a.method === 'recovery' || a.method === 'otp' || a.method === 'magiclink'));
  } catch {
    return false;
  }
}
