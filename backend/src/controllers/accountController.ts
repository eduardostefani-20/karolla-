import type { Request, Response } from 'express';
import {
  accountEmailSchema,
  accountLoginSchema,
  accountPetSchema,
  accountPetUpdateSchema,
  accountProfileSchema,
  accountSignupSchema,
  petPhotoSchema,
  petReferenceSchema,
  privateUploadSchema,
  refreshSchema,
} from '@karolla/shared';
import type { Container } from '../container';
import { bearerToken } from '../middleware/auth';
import { parse } from '../middleware/validate';
import { idParamSchema } from '../validators/query';

const id = (req: Request) => parse(idParamSchema, req.params).id;
const site = (c: Container) => c.env.PUBLIC_SITE_URL.replace(/\/$/, '');

/** Portal do cliente. Todo acesso é limitado ao cadastro ligado ao login (req.customer). */
export function accountController(c: Container) {
  return {
    async signUp(req: Request, res: Response) {
      const input = parse(accountSignupSchema, req.body);
      res.status(201).json(await c.account.signUp(input, `${site(c)}/minha-conta/entrar?confirmado=1`));
    },
    async login(req: Request, res: Response) {
      const { email, password } = parse(accountLoginSchema, req.body);
      res.json(await c.account.login(email, password));
    },
    async refresh(req: Request, res: Response) {
      res.json(await c.account.refresh(parse(refreshSchema, req.body).refreshToken));
    },
    async logout(req: Request, res: Response) {
      const token = bearerToken(req.headers.authorization);
      if (token) await c.auth.signOut(token);
      res.status(204).end();
    },
    async me(req: Request, res: Response) {
      res.json(await c.account.account(req.identity!));
    },
    async updateProfile(req: Request, res: Response) {
      res.json(await c.account.updateProfile(req.customer!, parse(accountProfileSchema, req.body)));
    },
    async changeEmail(req: Request, res: Response) {
      const { email } = parse(accountEmailSchema, req.body);
      await c.account.requestEmailChange(bearerToken(req.headers.authorization)!, email, `${site(c)}/minha-conta`);
      res.status(204).end();
    },
    async pets(req: Request, res: Response) {
      res.json(await c.account.listPets(req.customer!));
    },
    async pet(req: Request, res: Response) {
      res.json(await c.account.getPet(req.customer!, id(req)));
    },
    async createPet(req: Request, res: Response) {
      res.status(201).json(await c.account.createPet(req.customer!, parse(accountPetSchema, req.body)));
    },
    async updatePet(req: Request, res: Response) {
      res.json(await c.account.updatePet(req.customer!, id(req), parse(accountPetUpdateSchema, req.body)));
    },
    async uploadTicket(req: Request, res: Response) {
      res.json(await c.account.uploadTicket(req.customer!, id(req), parse(privateUploadSchema, req.body)));
    },
    async setPhoto(req: Request, res: Response) {
      res.json(await c.account.setPetPhoto(req.customer!, id(req), parse(petPhotoSchema, req.body).path));
    },
    async addReference(req: Request, res: Response) {
      res.status(201).json(await c.account.addReference(req.customer!, id(req), parse(petReferenceSchema, req.body)));
    },
    async removeReference(req: Request, res: Response) {
      await c.account.removeReference(req.customer!, id(req));
      res.status(204).end();
    },
    async appointments(req: Request, res: Response) {
      res.json(await c.account.appointments(req.customer!));
    },
  };
}
