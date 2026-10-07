import type { RequestHandler } from 'express';
import type { AdminRole } from '@karolla/shared';
import type { AuthService } from '../integrations/auth/AuthService';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';

export function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** Exige um administrador autenticado (token Bearer válido). */
export function requireAuth(auth: AuthService): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const token = bearerToken(req.headers.authorization);
    if (!token) throw new UnauthorizedError('Faça login para acessar o painel.');
    const admin = await auth.verify(token);
    if (!admin) throw new UnauthorizedError();
    req.admin = admin;
    next();
  });
}

const RANK: Record<AdminRole, number> = { staff: 1, admin: 2, owner: 3 };

/** Autorização por perfil: owner ⊇ admin ⊇ staff. */
export function requireRole(minimum: AdminRole): RequestHandler {
  return (req, _res, next) => {
    if (!req.admin) return next(new UnauthorizedError());
    if (RANK[req.admin.role] < RANK[minimum]) return next(new ForbiddenError());
    next();
  };
}
