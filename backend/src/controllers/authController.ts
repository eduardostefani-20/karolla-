import type { Request, Response } from 'express';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, refreshSchema, resetPasswordSchema } from '@karolla/shared';
import type { Container } from '../container';
import { bearerToken } from '../middleware/auth';
import { parse } from '../middleware/validate';

/** Página do site que recebe o link de redefinição de senha enviado por e-mail. */
export const resetRedirect = (c: Container) => `${c.env.PUBLIC_SITE_URL.replace(/\/$/, '')}/redefinir-senha`;

export function authController(c: Container) {
  return {
    async login(req: Request, res: Response) {
      const { email, password } = parse(loginSchema, req.body);
      res.json(await c.staff.login(email, password));
    },
    async refresh(req: Request, res: Response) {
      res.json(await c.staff.refresh(parse(refreshSchema, req.body).refreshToken));
    },
    async me(req: Request, res: Response) {
      res.json({ user: req.admin });
    },
    async logout(req: Request, res: Response) {
      const token = bearerToken(req.headers.authorization);
      if (token) await c.auth.signOut(token);
      res.status(204).end();
    },
    /** Sempre responde 204 (não revela se o e-mail tem cadastro). */
    async forgotPassword(req: Request, res: Response) {
      const { email } = parse(forgotPasswordSchema, req.body);
      await c.auth.requestPasswordReset(email, resetRedirect(c));
      res.status(204).end();
    },
    async resetPassword(req: Request, res: Response) {
      const { token, password } = parse(resetPasswordSchema, req.body);
      await c.auth.completePasswordReset(token, password);
      res.status(204).end();
    },
    async changePassword(req: Request, res: Response) {
      const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
      await c.staff.changeOwnPassword(req.admin!, currentPassword, newPassword);
      res.status(204).end();
    },
  };
}
