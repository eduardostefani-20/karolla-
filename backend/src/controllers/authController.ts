import type { Request, Response } from 'express';
import { loginSchema } from '@karolla/shared';
import type { Container } from '../container';
import { bearerToken } from '../middleware/auth';
import { parse } from '../middleware/validate';

export function authController(c: Container) {
  return {
    async login(req: Request, res: Response) {
      const { email, password } = parse(loginSchema, req.body);
      res.json(await c.auth.signIn(email, password));
    },
    async me(req: Request, res: Response) {
      res.json({ user: req.admin });
    },
    async logout(req: Request, res: Response) {
      const token = bearerToken(req.headers.authorization);
      if (token) await c.auth.signOut(token);
      res.status(204).end();
    },
  };
}
