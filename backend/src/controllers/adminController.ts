import type { Request, Response } from 'express';
import {
  addonSchema,
  appointmentListQuerySchema,
  appointmentStatusSchema,
  appointmentUpdateSchema,
  blockedDateSchema,
  blockedTimeSchema,
  breedSchema,
  businessHoursSchema,
  customerUpdateSchema,
  formFieldsSchema,
  petUpdateSchema,
  reorderSchema,
  serviceSchema,
  servicePricesSchema,
  settingsSchema,
  sizeSchema,
  speciesSchema,
  type SystemStatus,
} from '@karolla/shared';
import { z } from 'zod';
import type { Container } from '../container';
import { parse } from '../middleware/validate';
import { idParamSchema, searchQuerySchema } from '../validators/query';

const id = (req: Request) => parse(idParamSchema, req.params).id;

/** Para PATCH: o schema base com todos os campos opcionais (sem defaults que sobrescrevam valores). */
const partialOf = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  z.object(Object.fromEntries(Object.entries(schema.shape).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()]))) as unknown as z.ZodType<
    Partial<z.output<z.ZodObject<T>>>
  >;

const unwrap = <T extends z.ZodRawShape>(s: z.ZodObject<T> | z.ZodEffects<z.ZodObject<T>>): z.ZodObject<T> =>
  s instanceof z.ZodEffects ? (s.innerType() as z.ZodObject<T>) : s;

export function adminController(c: Container) {
  return {
    // ----- Dashboard / sistema -----
    async dashboard(_req: Request, res: Response) {
      res.json(await c.appointments.dashboard());
    },
    async systemStatus(_req: Request, res: Response) {
      const status: SystemStatus = {
        mode: c.env.APP_MODE,
        database: { provider: c.db.provider, connected: await c.db.healthCheck().catch(() => false) },
        auth: { provider: c.auth.provider },
        ...c.notifications.status(),
      };
      res.json(status);
    },

    // ----- Agendamentos -----
    async listAppointments(req: Request, res: Response) {
      res.json(await c.appointments.list(parse(appointmentListQuerySchema, req.query)));
    },
    async getAppointment(req: Request, res: Response) {
      res.json(await c.appointments.get(id(req)));
    },
    async updateAppointment(req: Request, res: Response) {
      res.json(await c.appointments.update(id(req), parse(appointmentUpdateSchema, req.body)));
    },
    async updateAppointmentStatus(req: Request, res: Response) {
      const { status } = parse(z.object({ status: appointmentStatusSchema }), req.body);
      res.json(await c.appointments.update(id(req), { status }));
    },
    async resendNotifications(req: Request, res: Response) {
      res.json(await c.appointments.resendNotifications(id(req)));
    },

    // ----- Clientes e pets -----
    async listCustomers(req: Request, res: Response) {
      res.json(await c.customers.listCustomers(parse(searchQuerySchema, req.query).search));
    },
    async getCustomer(req: Request, res: Response) {
      res.json(await c.customers.getCustomer(id(req)));
    },
    async updateCustomer(req: Request, res: Response) {
      res.json(await c.customers.updateCustomer(id(req), parse(customerUpdateSchema, req.body)));
    },
    async listPets(req: Request, res: Response) {
      res.json(await c.customers.listPets(parse(searchQuerySchema, req.query).search));
    },
    async getPet(req: Request, res: Response) {
      res.json(await c.customers.getPet(id(req)));
    },
    async updatePet(req: Request, res: Response) {
      res.json(await c.customers.updatePet(id(req), parse(petUpdateSchema, req.body)));
    },

    // ----- Catálogo -----
    async catalog(_req: Request, res: Response) {
      res.json(await c.catalog.getAdminCatalog());
    },
    async createService(req: Request, res: Response) {
      res.status(201).json(await c.catalog.createService(parse(serviceSchema, req.body)));
    },
    async updateService(req: Request, res: Response) {
      res.json(await c.catalog.updateService(id(req), parse(partialOf(serviceSchema), req.body)));
    },
    async deleteService(req: Request, res: Response) {
      await c.catalog.deleteService(id(req));
      res.status(204).end();
    },
    async savePrices(req: Request, res: Response) {
      res.json(await c.catalog.savePrices(parse(servicePricesSchema, req.body)));
    },
    async createAddon(req: Request, res: Response) {
      res.status(201).json(await c.catalog.createAddon(parse(addonSchema, req.body)));
    },
    async updateAddon(req: Request, res: Response) {
      res.json(await c.catalog.updateAddon(id(req), parse(partialOf(addonSchema), req.body)));
    },
    async deleteAddon(req: Request, res: Response) {
      await c.catalog.deleteAddon(id(req));
      res.status(204).end();
    },
    async createSpecies(req: Request, res: Response) {
      res.status(201).json(await c.catalog.createSpecies(parse(speciesSchema, req.body)));
    },
    async updateSpecies(req: Request, res: Response) {
      res.json(await c.catalog.updateSpecies(id(req), parse(partialOf(speciesSchema), req.body)));
    },
    async deleteSpecies(req: Request, res: Response) {
      await c.catalog.deleteSpecies(id(req));
      res.status(204).end();
    },
    async createBreed(req: Request, res: Response) {
      res.status(201).json(await c.catalog.createBreed(parse(breedSchema, req.body)));
    },
    async updateBreed(req: Request, res: Response) {
      res.json(await c.catalog.updateBreed(id(req), parse(partialOf(breedSchema), req.body)));
    },
    async deleteBreed(req: Request, res: Response) {
      await c.catalog.deleteBreed(id(req));
      res.status(204).end();
    },
    async createSize(req: Request, res: Response) {
      res.status(201).json(await c.catalog.createSize(parse(sizeSchema, req.body)));
    },
    async updateSize(req: Request, res: Response) {
      res.json(await c.catalog.updateSize(id(req), parse(partialOf(unwrap(sizeSchema)), req.body)));
    },
    async deleteSize(req: Request, res: Response) {
      await c.catalog.deleteSize(id(req));
      res.status(204).end();
    },
    reorder(entity: 'services' | 'addons' | 'sizes' | 'species' | 'breeds') {
      return async (req: Request, res: Response) => {
        res.json(await c.catalog.reorder(entity, parse(reorderSchema, req.body).ids));
      };
    },
    async saveFormFields(req: Request, res: Response) {
      res.json(await c.catalog.saveFormFields(parse(formFieldsSchema, req.body)));
    },

    // ----- Horários e configurações -----
    async getSchedule(_req: Request, res: Response) {
      res.json(await c.schedule.getSchedule());
    },
    async saveBusinessHours(req: Request, res: Response) {
      res.json(await c.schedule.saveBusinessHours(parse(businessHoursSchema, req.body)));
    },
    async addBlockedDate(req: Request, res: Response) {
      res.status(201).json(await c.schedule.addBlockedDate(parse(blockedDateSchema, req.body)));
    },
    async removeBlockedDate(req: Request, res: Response) {
      await c.schedule.removeBlockedDate(id(req));
      res.status(204).end();
    },
    async addBlockedTime(req: Request, res: Response) {
      res.status(201).json(await c.schedule.addBlockedTime(parse(blockedTimeSchema, req.body)));
    },
    async removeBlockedTime(req: Request, res: Response) {
      await c.schedule.removeBlockedTime(id(req));
      res.status(204).end();
    },
    async getSettings(_req: Request, res: Response) {
      res.json(await c.schedule.getSettings());
    },
    async updateSettings(req: Request, res: Response) {
      res.json(await c.schedule.updateSettings(parse(settingsSchema, req.body)));
    },
  };
}
