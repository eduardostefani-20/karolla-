import type { RequestHandler } from 'express';
import { hasPermission, redactFinance, type Permission } from '@karolla/shared';
import type { AuthService } from '../integrations/auth/AuthService';
import type { DatabaseService } from '../repositories/types';
import type { StaffService } from '../services/StaffService';
import { AppError, ForbiddenError, UnauthorizedError } from '../utils/errors';
import { PENDING_MESSAGE, type CustomerAccountService } from '../services/CustomerAccountService';
import { asyncHandler } from '../utils/asyncHandler';
import { errorMeta, logger } from '../utils/logger';

export function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Exige um usuário da EQUIPE autenticado e ativo. O token só prova a identidade; o acesso vem da
 * tabela `admins` (conta desativada é recusada na hora, mesmo com token ainda válido).
 */
export function requireStaff(auth: AuthService, staff: StaffService): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const token = bearerToken(req.headers.authorization);
    if (!token) throw new UnauthorizedError('Faça login para acessar o painel.');
    const identity = await auth.verify(token);
    if (!identity) throw new UnauthorizedError();
    const admin = await staff.resolve(identity);
    if (!admin) throw new UnauthorizedError('Sua conta não tem acesso ao painel ou foi desativada.');
    req.admin = admin;
    next();
  });
}

/** Exige TODAS as permissões informadas (validação no servidor — o menu escondido é só conveniência). */
export function can(...permissions: Permission[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.admin) return next(new UnauthorizedError());
    if (!permissions.every((p) => hasPermission(req.admin!.permissions, p))) return next(new ForbiddenError());
    next();
  };
}

/** Exige PELO MENOS UMA das permissões. */
export function canAny(...permissions: Permission[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.admin) return next(new UnauthorizedError());
    if (!permissions.some((p) => hasPermission(req.admin!.permissions, p))) return next(new ForbiddenError());
    next();
  };
}

const CONTACT_FIELDS = ['whatsapp', 'email', 'address'] as const;

/** Remove contato e endereço dos tutores (objetos de cliente: têm `whatsapp` e `address`). */
export function redactContacts<T>(value: T): T {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      const isCustomer = 'whatsapp' in obj && 'address' in obj;
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(obj)) {
        if (isCustomer && (CONTACT_FIELDS as readonly string[]).includes(k)) continue;
        out[k] = strip(val);
      }
      return out;
    }
    return v;
  };
  return strip(value) as T;
}

/**
 * Filtra as respostas do painel conforme as permissões: sem "finance.view" os valores (preços, totais,
 * receitas) NÃO são enviados ao navegador; sem "customers.view" o contato/endereço do tutor também não.
 */
export function redactResponses(): RequestHandler {
  return (req, res, next) => {
    const json = res.json.bind(res);
    res.json = (body: unknown) => {
      const perms = req.admin?.permissions;
      let out = body;
      if (perms && res.statusCode < 400) {
        if (!hasPermission(perms, 'finance.view')) out = redactFinance(out);
        if (!hasPermission(perms, 'customers.view')) out = redactContacts(out);
      }
      return json(out);
    };
    next();
  };
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Registro de auditoria das ações do painel (quem, o quê, quando, resultado). Guarda só método, área e
 * id do registro — nunca o conteúdo enviado (evita dados pessoais e senhas no log).
 */
export function auditTrail(db: DatabaseService): RequestHandler {
  return (req, res, next) => {
    if (!MUTATING.has(req.method)) return next();
    res.on('finish', () => {
      const admin = req.admin;
      if (!admin || res.statusCode >= 500) return;
      const segments = req.originalUrl.split('?')[0]!.split('/').filter(Boolean);
      const at = segments.indexOf('admin');
      const inAdmin = at >= 0;
      // fora de /admin (ex.: /auth/change-password) registra o caminho sem id
      const rest = inAdmin ? segments.slice(at + 1) : segments.slice(Math.max(0, segments.indexOf('auth')));
      const entity = rest[0] ?? 'admin';
      const second = rest[1];
      const entityId = inAdmin && second && second !== 'reorder' ? decodeURIComponent(second).slice(0, 80) : null;
      const action = `${req.method} /${rest.map((s, i) => (i === 1 && entityId ? ':id' : s)).join('/')}`.slice(0, 120);
      db.audit
        .create({ actorId: admin.id, actorEmail: admin.email, action, entity, entityId, status: res.statusCode })
        .catch((error) => logger.warn('Falha ao gravar auditoria', errorMeta(error)));
    });
    next();
  };
}

/** Portal do cliente: exige login; `req.customer` é o cadastro vinculado (ou null = pendente). */
export function requireCustomer(auth: AuthService, account: CustomerAccountService): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const token = bearerToken(req.headers.authorization);
    if (!token) throw new UnauthorizedError('Entre na sua conta para continuar.');
    const identity = await auth.verify(token);
    if (!identity) throw new UnauthorizedError('Sua sessão expirou. Entre novamente.');
    req.identity = identity;
    req.customer = await account.resolve(identity);
    next();
  });
}

/** Rotas que precisam do cadastro já vinculado. */
export const linkedCustomer: RequestHandler = (req, _res, next) => {
  if (!req.customer) return next(new AppError(403, 'ACCOUNT_PENDING', PENDING_MESSAGE));
  next();
};

/** Recursos que dependem da migração mais recente do banco: até ela ser aplicada, respondem "em ativação". */
export function requireFeatures(db: DatabaseService): RequestHandler {
  return asyncHandler(async (_req, _res, next) => {
    if (!(await db.featuresReady())) {
      throw new AppError(503, 'SETUP_PENDING', 'Este recurso está sendo ativado. Tente novamente mais tarde ou fale com a Karolla Pet pelo WhatsApp.');
    }
    next();
  });
}
