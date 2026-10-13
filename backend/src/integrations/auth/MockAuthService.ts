import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { InvalidCredentialsError, UnauthorizedError, ValidationError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import type { AuthIdentity, AuthService, AuthTokens, SignUpResult } from './AuthService';
import { signToken, verifyToken } from './signedToken';

/**
 * ⚠️ AUTENTICAÇÃO DE DEMONSTRAÇÃO — apenas MODO DEMO e testes automatizados.
 * Usuários em memória, senhas com scrypt (sal aleatório), tokens assinados com HMAC.
 * A configuração impede o uso deste provider com APP_MODE=production.
 */
interface MockUser {
  id: string;
  email: string;
  name: string;
  salt: string;
  hash: string;
  /** Incrementado ao revogar sessões: tokens antigos deixam de valer. */
  epoch: number;
  whatsapp?: string;
}

const hashPassword = (password: string, salt: string) => scryptSync(password, salt, 32).toString('hex');

export class MockAuthService implements AuthService {
  readonly provider = 'mock' as const;
  private users = new Map<string, MockUser>();
  private refreshTokens = new Map<string, { userId: string; epoch: number }>();
  /** Último link de redefinição gerado (o modo demo não envia e-mail; usado em testes). */
  lastRecoveryLink: string | null = null;

  constructor(
    private readonly opts: {
      secret: string;
      ttlHours: number;
      /** Conta principal criada a partir das variáveis DEMO_ADMIN_* (id fixo 'demo-admin'). */
      owner?: { email: string; password: string; name?: string };
    },
  ) {
    if (opts.owner) this.addUser('demo-admin', opts.owner.email, opts.owner.password, opts.owner.name ?? 'Administradora (demo)');
  }

  private addUser(id: string, email: string, password: string, name: string): MockUser {
    const salt = randomBytes(16).toString('hex');
    const user = { id, email: email.trim().toLowerCase(), name, salt, hash: hashPassword(password, salt), epoch: 0 };
    this.users.set(id, user);
    return user;
  }

  private byEmail(email: string) {
    const e = email.trim().toLowerCase();
    return [...this.users.values()].find((u) => u.email === e) ?? null;
  }

  private passwordMatches(user: MockUser, password: string) {
    const given = Buffer.from(hashPassword(password, user.salt), 'hex');
    return timingSafeEqual(given, Buffer.from(user.hash, 'hex'));
  }

  private identity(u: MockUser): AuthIdentity {
    return { userId: u.id, email: u.email, name: u.name, emailConfirmed: true, ...(u.whatsapp ? { whatsapp: u.whatsapp } : {}) };
  }

  private issue(u: MockUser): AuthTokens {
    const exp = Math.floor(Date.now() / 1000) + Math.round(this.opts.ttlHours * 3600);
    const token = signToken({ sub: u.id, email: u.email, name: u.name, role: `access:${u.epoch}`, exp }, this.opts.secret);
    const refreshToken = randomBytes(24).toString('base64url');
    this.refreshTokens.set(refreshToken, { userId: u.id, epoch: u.epoch });
    return { token, refreshToken, expiresAt: new Date(exp * 1000).toISOString() };
  }

  async signIn(email: string, password: string) {
    const user = this.byEmail(email);
    // compara mesmo sem usuário (tempo parecido; não revela se o e-mail existe)
    const ok = user ? this.passwordMatches(user, password) : (hashPassword(password, 'x'), false);
    if (!user || !ok) throw new InvalidCredentialsError();
    return { identity: this.identity(user), tokens: this.issue(user) };
  }

  async verify(token: string): Promise<AuthIdentity | null> {
    const payload = verifyToken(token, this.opts.secret);
    if (!payload || !payload.role.startsWith('access:')) return null;
    const user = this.users.get(payload.sub);
    if (!user || payload.role !== `access:${user.epoch}`) return null;
    return this.identity(user);
  }

  async refresh(refreshToken: string) {
    const entry = this.refreshTokens.get(refreshToken);
    const user = entry ? this.users.get(entry.userId) : undefined;
    if (!entry || !user || entry.epoch !== user.epoch) throw new UnauthorizedError('Sessão expirada. Entre novamente.');
    this.refreshTokens.delete(refreshToken); // rotação: cada refresh token vale uma vez
    return { identity: this.identity(user), tokens: this.issue(user) };
  }

  async signOut(token: string) {
    const payload = verifyToken(token, this.opts.secret);
    const user = payload ? this.users.get(payload.sub) : undefined;
    if (user) await this.revokeSessions(user.id);
  }

  async signUp(input: { email: string; password: string; name: string; metadata?: Record<string, string> }): Promise<SignUpResult> {
    if (this.byEmail(input.email)) throw new ValidationError('Este e-mail já tem cadastro. Entre ou recupere a senha.', { email: 'E-mail já cadastrado.' });
    const user = this.addUser(randomUUID(), input.email, input.password, input.name);
    if (input.metadata?.whatsapp) user.whatsapp = input.metadata.whatsapp;
    return { identity: this.identity(user), needsConfirmation: false, tokens: this.issue(user) };
  }

  async createUser(input: { email: string; password: string; name: string }) {
    if (this.byEmail(input.email)) throw new ValidationError('Já existe uma conta com este e-mail.', { email: 'E-mail já cadastrado.' });
    return this.identity(this.addUser(randomUUID(), input.email, input.password, input.name));
  }

  async findUserById(userId: string) {
    const user = this.users.get(userId);
    return user ? this.identity(user) : null;
  }

  async findUserByEmail(email: string) {
    const user = this.byEmail(email);
    return user ? this.identity(user) : null;
  }

  async setPassword(userId: string, password: string) {
    const user = this.users.get(userId);
    if (!user) throw new UnauthorizedError();
    user.salt = randomBytes(16).toString('hex');
    user.hash = hashPassword(password, user.salt);
    user.epoch += 1; // troca de senha encerra as outras sessões
  }

  async checkPassword(email: string, password: string) {
    const user = this.byEmail(email);
    return Boolean(user && this.passwordMatches(user, password));
  }

  async requestPasswordReset(email: string, redirectTo: string) {
    const user = this.byEmail(email);
    if (!user) return;
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = signToken({ sub: user.id, email: user.email, name: user.name, role: `recovery:${user.epoch}`, exp }, this.opts.secret);
    this.lastRecoveryLink = `${redirectTo}#type=recovery&access_token=${token}`;
    logger.info('[DEMO] Link de redefinição de senha (o modo demo não envia e-mail)', { email: user.email });
  }

  async completePasswordReset(recoveryToken: string, newPassword: string) {
    const payload = verifyToken(recoveryToken, this.opts.secret);
    const user = payload ? this.users.get(payload.sub) : undefined;
    if (!payload || !user || payload.role !== `recovery:${user.epoch}`) {
      throw new UnauthorizedError('O link de redefinição expirou ou já foi usado. Peça um novo.');
    }
    await this.setPassword(user.id, newPassword);
  }

  async revokeSessions(userId: string) {
    const user = this.users.get(userId);
    if (user) user.epoch += 1;
  }

  /** DEMO: não há e-mail; a troca vale na hora. */
  async requestEmailChange(token: string, newEmail: string) {
    const payload = verifyToken(token, this.opts.secret);
    const user = payload ? this.users.get(payload.sub) : undefined;
    if (!user) throw new UnauthorizedError();
    if (this.byEmail(newEmail)) throw new ValidationError('Este e-mail já está em uso.', { email: 'E-mail já cadastrado.' });
    user.email = newEmail.trim().toLowerCase();
  }

  async updateProfile(userId: string, data: { name?: string; email?: string }) {
    const user = this.users.get(userId);
    if (!user) return;
    if (data.name) user.name = data.name;
    if (data.email) user.email = data.email.trim().toLowerCase();
  }
}
