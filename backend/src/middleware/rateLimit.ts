import type { RequestHandler } from 'express';
import { TooManyRequestsError } from '../utils/errors';

/**
 * Rate limit simples em memória (janela fixa por IP).
 * Para múltiplas instâncias em produção, troque por Redis/limitador da plataforma.
 */
export function rateLimit(opts: { windowMs: number; max: number; message?: string; keyPrefix: string }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, _res, next) => {
    const now = Date.now();
    const key = `${opts.keyPrefix}:${req.ip}`;
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      return next();
    }
    entry.count += 1;
    if (entry.count > opts.max) return next(new TooManyRequestsError(opts.message));
    next();
  };
}
