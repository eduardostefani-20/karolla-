import {
  hasPermission,
  resolvePermissions,
  type AdminUser,
  type AuthSession,
  type Permission,
  type PermissionSet,
  type StaffCreateInput,
  type StaffMember,
  type StaffUpdateInput,
} from '@karolla/shared';
import type { AuthIdentity, AuthService, AuthTokens } from '../integrations/auth/AuthService';
import type { AdminRecord, DatabaseService } from '../repositories/types';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors';
import type { Clock } from '../utils/clock';
import { errorMeta, logger } from '../utils/logger';

/**
 * Contas da equipe (painel): login, permissões efetivas e gestão das contas pela administradora.
 * Regras de segurança:
 *  - a conta principal (owner) tem tudo, não pode ser desativada nem ter permissões reduzidas;
 *  - ninguém concede a outra pessoa uma permissão que não tem;
 *  - ninguém desativa ou rebaixa a própria conta (evita ficar trancado para fora);
 *  - conta desativada é recusada em TODA requisição (não depende do token expirar).
 */
export class StaffService {
  private cache = new Map<string, { user: AdminUser | null; until: number }>();

  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthService,
    private readonly clock: Clock,
  ) {}

  private toUser(record: AdminRecord): AdminUser {
    return {
      id: record.userId,
      email: record.email,
      name: record.name,
      role: record.role,
      permissions: resolvePermissions(record.role, record.customPermissions),
      professionalId: record.professionalId,
    };
  }

  private toMember(record: AdminRecord): StaffMember {
    return {
      id: record.userId,
      email: record.email,
      name: record.name,
      role: record.role,
      active: record.active,
      customPermissions: record.role === 'owner' ? null : record.customPermissions,
      permissions: resolvePermissions(record.role, record.customPermissions),
      professionalId: record.professionalId,
      lastLoginAt: record.lastLoginAt,
      createdAt: record.createdAt,
    };
  }

  /** Identidade autenticada → usuário da equipe ativo (ou null). Cache curto para não consultar o banco a cada requisição. */
  async resolve(identity: AuthIdentity): Promise<AdminUser | null> {
    const cached = this.cache.get(identity.userId);
    if (cached && cached.until > Date.now()) return cached.user;
    const record = await this.db.admins.findByUserId(identity.userId);
    const user = record && record.active ? this.toUser(record) : null;
    this.cache.set(identity.userId, { user, until: Date.now() + 15_000 });
    return user;
  }

  private forget(userId: string) {
    this.cache.delete(userId);
  }

  private async session(identity: AuthIdentity, tokens: AuthTokens): Promise<AuthSession> {
    this.forget(identity.userId);
    const user = await this.resolve(identity);
    if (!user) throw new UnauthorizedError('Este usuário não tem acesso ao painel administrativo.');
    return { token: tokens.token, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt, user };
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const { identity, tokens } = await this.auth.signIn(email, password);
    const session = await this.session(identity, tokens);
    // Registro de último acesso/auditoria nunca impede o login.
    await Promise.allSettled([
      this.db.admins.touchLogin(identity.userId, this.clock.now().toISOString()),
      this.db.audit.create({ actorId: identity.userId, actorEmail: identity.email, action: 'login', entity: 'auth', entityId: null, status: 200 }),
    ]).then((results) => results.forEach((r) => r.status === 'rejected' && logger.warn('Falha ao registrar login', errorMeta(r.reason))));
    return session;
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const { identity, tokens } = await this.auth.refresh(refreshToken);
    return this.session(identity, tokens);
  }

  // ---------------------------------------------------------------- gestão da equipe

  async list(): Promise<StaffMember[]> {
    return (await this.db.admins.list()).map((r) => this.toMember(r));
  }

  /** Impede conceder permissão que quem está concedendo não tem. */
  private assertCanGrant(actor: AdminUser, set: PermissionSet | null, role: AdminRecord['role']) {
    const effective = resolvePermissions(role, set);
    const missing = effective.grants.filter((p) => !hasPermission(actor.permissions, p as Permission));
    if (missing.length) throw new ForbiddenError(`Você não pode conceder permissões que não tem: ${missing.join(', ')}.`);
  }

  private async assertProfessional(professionalId: string | null | undefined) {
    if (professionalId && !(await this.db.professionals.findById(professionalId))) throw new NotFoundError('Profissional não encontrado.');
  }

  async create(input: StaffCreateInput, actor: AdminUser): Promise<StaffMember> {
    const customPermissions: PermissionSet | null = input.customPermissions;
    this.assertCanGrant(actor, customPermissions, input.role);
    await this.assertProfessional(input.professionalId);
    const existing = await this.auth.findUserByEmail(input.email);
    if (existing && (await this.db.admins.findByUserId(existing.userId))) {
      throw new ValidationError('Já existe uma conta da equipe com este e-mail.', { email: 'E-mail já cadastrado na equipe.' });
    }
    // Se a pessoa já tem login (ex.: também é cliente), reaproveita a identidade e define a senha informada.
    const identity = existing ?? (await this.auth.createUser({ email: input.email, password: input.password, name: input.name }));
    if (existing) await this.auth.setPassword(existing.userId, input.password);
    const record = await this.db.admins.create({
      userId: identity.userId,
      email: identity.email,
      name: input.name,
      role: input.role,
      active: true,
      customPermissions,
      professionalId: input.professionalId,
    });
    return this.toMember(record);
  }

  async update(userId: string, input: StaffUpdateInput, actor: AdminUser): Promise<StaffMember> {
    const current = await this.db.admins.findByUserId(userId);
    if (!current) throw new NotFoundError('Conta não encontrada.');
    const touchesAccess = input.role !== undefined || input.active !== undefined || input.customPermissions !== undefined;
    if (current.role === 'owner' && touchesAccess) {
      throw new ForbiddenError('A conta principal sempre tem acesso completo e não pode ser desativada.');
    }
    if (userId === actor.id && touchesAccess) throw new ForbiddenError('Você não pode alterar o próprio perfil, permissões ou situação.');
    const role = input.role ?? current.role;
    if (input.role !== undefined || input.customPermissions !== undefined) {
      const custom = input.customPermissions !== undefined ? input.customPermissions : current.customPermissions;
      this.assertCanGrant(actor, custom, role);
    }
    await this.assertProfessional(input.professionalId);
    const updated = await this.db.admins.update(userId, {
      name: input.name,
      role: input.role,
      active: input.active,
      customPermissions: input.customPermissions,
      professionalId: input.professionalId,
    });
    if (input.active === false) await this.auth.revokeSessions(userId);
    if (input.name) await this.auth.updateProfile(userId, { name: input.name }).catch(() => undefined);
    this.forget(userId);
    return this.toMember(updated);
  }

  async setPassword(userId: string, password: string, actor: AdminUser): Promise<void> {
    const current = await this.db.admins.findByUserId(userId);
    if (!current) throw new NotFoundError('Conta não encontrada.');
    if (current.role === 'owner' && actor.id !== userId) throw new ForbiddenError('Só a própria administradora principal troca a senha dela.');
    await this.auth.setPassword(userId, password);
    await this.auth.revokeSessions(userId);
    this.forget(userId);
  }

  async sendPasswordReset(userId: string, redirectTo: string): Promise<void> {
    const current = await this.db.admins.findByUserId(userId);
    if (!current) throw new NotFoundError('Conta não encontrada.');
    await this.auth.requestPasswordReset(current.email, redirectTo);
  }

  /** Troca de senha pelo próprio usuário (exige a senha atual). */
  async changeOwnPassword(user: AdminUser, currentPassword: string, newPassword: string): Promise<void> {
    if (!(await this.auth.checkPassword(user.email, currentPassword))) {
      throw new ValidationError('Senha atual incorreta.', { currentPassword: 'Senha atual incorreta.' });
    }
    await this.auth.setPassword(user.id, newPassword);
  }
}
