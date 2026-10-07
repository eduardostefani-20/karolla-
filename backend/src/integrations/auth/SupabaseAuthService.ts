import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AdminUser, AuthSession } from '@karolla/shared';
import { UnauthorizedError } from '../../utils/errors';
import type { AdminRepository } from '../../repositories/types';
import type { AuthService } from './AuthService';

/**
 * PRODUÇÃO — Supabase Auth.
 *  1. Login com e-mail/senha no Supabase Auth (chave ANON, no servidor).
 *  2. Autorização: o usuário precisa existir em `public.admins` com `active = true`.
 *  3. Cada requisição valida o access token no Supabase (`auth.getUser`).
 * Veja docs/SUPABASE.md → "Como criar administrador".
 */
export class SupabaseAuthService implements AuthService {
  readonly provider = 'supabase' as const;
  private readonly client: SupabaseClient;
  private cache = new Map<string, { user: AdminUser; until: number }>();

  constructor(
    url: string,
    anonKey: string,
    private readonly admins: AdminRepository,
  ) {
    this.client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private async toAdmin(userId: string): Promise<AdminUser | null> {
    const record = await this.admins.findByUserId(userId);
    if (!record || !record.active) return null;
    return { id: record.userId, email: record.email, name: record.name, role: record.role };
  }

  async signIn(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) throw new UnauthorizedError('E-mail ou senha incorretos.');
    const admin = await this.toAdmin(data.user.id);
    if (!admin) throw new UnauthorizedError('Este usuário não tem acesso ao painel administrativo.');
    return {
      token: data.session.access_token,
      expiresAt: new Date((data.session.expires_at ?? 0) * 1000).toISOString(),
      user: admin,
    };
  }

  async verify(token: string): Promise<AdminUser | null> {
    const cached = this.cache.get(token);
    if (cached && cached.until > Date.now()) return cached.user;
    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data.user) return null;
    const admin = await this.toAdmin(data.user.id);
    if (admin) this.cache.set(token, { user: admin, until: Date.now() + 60_000 });
    return admin;
  }

  async signOut(token: string): Promise<void> {
    this.cache.delete(token);
  }
}
