import type { AdminRole, AdminUser, AuthSession } from '@karolla/shared';
import { UnauthorizedError } from '../../utils/errors';
import type { AuthService } from './AuthService';
import { safeEqual, signToken, verifyToken } from './signedToken';

/**
 * ⚠️ AUTENTICAÇÃO MOCK — apenas MODO DEMO / desenvolvimento.
 * As credenciais vêm de DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD (.env). Nada fica no código.
 * A configuração impede o uso deste provider com APP_MODE=production.
 */
export class MockAuthService implements AuthService {
  readonly provider = 'mock' as const;

  constructor(
    private readonly opts: {
      email: string;
      password: string;
      secret: string;
      ttlHours: number;
      name?: string;
      role?: AdminRole;
    },
  ) {}

  private get user(): AdminUser {
    return { id: 'demo-admin', email: this.opts.email, name: this.opts.name ?? 'Administradora (demo)', role: this.opts.role ?? 'owner' };
  }

  async signIn(email: string, password: string): Promise<AuthSession> {
    const ok = safeEqual(email.trim().toLowerCase(), this.opts.email.toLowerCase()) && safeEqual(password, this.opts.password);
    if (!ok) throw new UnauthorizedError('E-mail ou senha incorretos.');
    const exp = Math.floor(Date.now() / 1000) + Math.round(this.opts.ttlHours * 3600);
    const user = this.user;
    const token = signToken({ sub: user.id, email: user.email, name: user.name, role: user.role, exp }, this.opts.secret);
    return { token, expiresAt: new Date(exp * 1000).toISOString(), user };
  }

  async verify(token: string): Promise<AdminUser | null> {
    const payload = verifyToken(token, this.opts.secret);
    if (!payload) return null;
    return { id: payload.sub, email: payload.email, name: payload.name, role: payload.role as AdminRole };
  }

  async signOut(): Promise<void> {
    /* tokens stateless expiram sozinhos; o front-end descarta o token */
  }
}
