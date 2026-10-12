import type { Request, Response } from 'express';
import { z } from 'zod';
import { staffCreateSchema, staffPasswordSchema, staffUpdateSchema } from '@karolla/shared';
import type { Container } from '../container';
import { parse } from '../middleware/validate';
import { resetRedirect } from './authController';

const id = (req: Request) => String(req.params.id);
const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  actorId: z.string().max(80).optional(),
  entity: z.string().max(40).optional(),
});

/** Equipe e permissões (somente quem tem "team.admin"; a lista exige "team.view"). */
export function teamController(c: Container) {
  return {
    async list(_req: Request, res: Response) {
      res.json(await c.staff.list());
    },
    async create(req: Request, res: Response) {
      res.status(201).json(await c.staff.create(parse(staffCreateSchema, req.body), req.admin!));
    },
    async update(req: Request, res: Response) {
      res.json(await c.staff.update(id(req), parse(staffUpdateSchema, req.body), req.admin!));
    },
    async setPassword(req: Request, res: Response) {
      await c.staff.setPassword(id(req), parse(staffPasswordSchema, req.body).password, req.admin!);
      res.status(204).end();
    },
    async sendReset(req: Request, res: Response) {
      await c.staff.sendPasswordReset(id(req), resetRedirect(c));
      res.status(204).end();
    },
    async audit(req: Request, res: Response) {
      res.json(await c.db.audit.list(parse(auditQuerySchema, req.query)));
    },
  };
}
