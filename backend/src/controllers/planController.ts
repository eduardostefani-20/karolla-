import type { Request, Response } from 'express';
import { z } from 'zod';
import { idSchema, paymentSchema, planSchema, planUsageSchema, subscribeSchema, subscriptionUpdateSchema } from '@karolla/shared';
import type { Container } from '../container';
import { parse } from '../middleware/validate';
import { idParamSchema } from '../validators/query';
import { NotFoundError } from '../utils/errors';

const id = (req: Request) => parse(idParamSchema, req.params).id;

/** Conta com agenda "só os próprios": só mexe nos planos dos próprios atendimentos. */
async function scoped(c: Container, req: Request): Promise<string> {
  const appointmentId = id(req);
  if (req.admin?.permissions.agendaScope === 'own') {
    const a = await c.db.appointments.findById(appointmentId);
    if (!a || !req.admin.professionalId || a.professionalId !== req.admin.professionalId) throw new NotFoundError('Agendamento não encontrado.');
  }
  return appointmentId;
}
const listQuery = z.object({
  customerId: idSchema.optional(),
  status: z.enum(['pending', 'active', 'overdue', 'paused', 'cancelled']).optional(),
});

/** Planos e mensalidades (painel). Valores somem da resposta para quem não tem "finance.view". */
export function planController(c: Container) {
  return {
    async list(_req: Request, res: Response) {
      res.json(await c.plans.listPlans());
    },
    async create(req: Request, res: Response) {
      res.status(201).json(await c.plans.createPlan(parse(planSchema, req.body)));
    },
    async update(req: Request, res: Response) {
      res.json(await c.plans.updatePlan(id(req), parse(planSchema.partial(), req.body)));
    },
    async remove(req: Request, res: Response) {
      await c.plans.deletePlan(id(req));
      res.status(204).end();
    },
    async subscriptions(req: Request, res: Response) {
      res.json(await c.plans.listSubscriptions(parse(listQuery, req.query)));
    },
    async subscription(req: Request, res: Response) {
      res.json(await c.plans.getSubscription(id(req)));
    },
    async subscribe(req: Request, res: Response) {
      res.status(201).json(await c.plans.subscribe(parse(subscribeSchema, req.body), req.admin!));
    },
    async updateSubscription(req: Request, res: Response) {
      res.json(await c.plans.updateSubscription(id(req), parse(subscriptionUpdateSchema, req.body), req.admin!));
    },
    async recordPayment(req: Request, res: Response) {
      res.status(201).json(await c.plans.recordPayment(id(req), parse(paymentSchema, req.body), req.admin!));
    },
    async forAppointment(req: Request, res: Response) {
      res.json(await c.plans.forAppointment(await scoped(c, req)));
    },
    async use(req: Request, res: Response) {
      res.status(201).json(await c.plans.useOnAppointment(await scoped(c, req), parse(planUsageSchema, req.body), req.admin!));
    },
    async revertUsage(req: Request, res: Response) {
      res.json(await c.plans.revertUsage(id(req), req.admin!));
    },
  };
}
