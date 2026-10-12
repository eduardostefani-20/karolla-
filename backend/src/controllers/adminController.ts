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
  inspirationSchema,
  professionalSchema,
  storySchema,
  petUpdateSchema,
  reorderSchema,
  serviceSchema,
  servicePricesSchema,
  settingsSchema,
  sizeSchema,
  speciesSchema,
  type SystemStatus,
  contactCreateSchema,
  contactUpdateSchema,
  crmQuerySchema,
  idSchema,
  linkAccountSchema,
  manualAppointmentSchema,
  professionalTimeOffSchema,
  petPhotoSchema,
  petReferenceSchema,
  privateUploadSchema,
} from '@karolla/shared';
import { z } from 'zod';
import type { Container } from '../container';
import { parse } from '../middleware/validate';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { idParamSchema, searchQuerySchema } from '../validators/query';

const id = (req: Request) => parse(idParamSchema, req.params).id;

/**
 * Agenda "somente os próprios atendimentos": devolve o profissional vinculado à conta (null = conta sem
 * profissional vinculado, que então não vê nenhum atendimento). `undefined` = vê a agenda inteira.
 */
const ownProfessional = (req: Request): string | null | undefined =>
  req.admin?.permissions.agendaScope === 'own' ? (req.admin.professionalId ?? null) : undefined;

/** Para PATCH: o schema base com todos os campos opcionais (sem defaults que sobrescrevam valores). */
const partialOf = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  z.object(Object.fromEntries(Object.entries(schema.shape).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()]))) as unknown as z.ZodType<
    Partial<z.output<z.ZodObject<T>>>
  >;

const unwrap = <T extends z.ZodRawShape>(s: z.ZodObject<T> | z.ZodEffects<z.ZodObject<T>>): z.ZodObject<T> =>
  s instanceof z.ZodEffects ? (s.innerType() as z.ZodObject<T>) : s;

export function adminController(c: Container) {
  /** Confere se o atendimento está no escopo da conta; fora dele responde "não encontrado". */
  async function scopedAppointment(req: Request): Promise<string> {
    const appointmentId = id(req);
    const own = ownProfessional(req);
    if (own === undefined) return appointmentId;
    const appointment = await c.db.appointments.findById(appointmentId);
    if (!appointment || own === null || appointment.professionalId !== own) throw new NotFoundError('Agendamento não encontrado.');
    return appointmentId;
  }

  /** Para agenda "só os próprios": clientes, pets e atendimentos que a conta pode ver. null = sem restrição. */
  async function ownIds(req: Request) {
    const own = ownProfessional(req);
    if (own === undefined) return null;
    const rows = own === null ? [] : await c.db.appointments.list({ professionalId: own });
    return {
      appointments: new Set(rows.map((a) => a.id)),
      customers: new Set(rows.map((a) => a.customerId)),
      pets: new Set(rows.map((a) => a.petId)),
    };
  }

  return {
    // ----- Dashboard / sistema -----
    async dashboard(req: Request, res: Response) {
      res.json(await c.appointments.dashboard(ownProfessional(req)));
    },
    async systemStatus(_req: Request, res: Response) {
      const status: SystemStatus = {
        mode: c.env.APP_MODE,
        database: { provider: c.db.provider, connected: await c.db.healthCheck().catch(() => false) },
        auth: { provider: c.auth.provider },
        storage: { provider: c.storage.provider },
        instagramFeed: { configured: c.instagram.configured },
        ...c.notifications.status(),
        schema: { portalCrm: await c.db.featuresReady(9), agendaPlans: await c.db.featuresReady(10) },
      };
      res.json(status);
    },

    // ----- Agendamentos -----
    async listAppointments(req: Request, res: Response) {
      const query = parse(appointmentListQuerySchema, req.query);
      const own = ownProfessional(req);
      if (own === null) return void res.json([]);
      res.json(await c.appointments.list(own === undefined ? query : { ...query, professionalId: own }));
    },
    async getAppointment(req: Request, res: Response) {
      res.json(await c.appointments.get(await scopedAppointment(req)));
    },
    async updateAppointment(req: Request, res: Response) {
      const input = parse(appointmentUpdateSchema, req.body);
      const appointmentId = await scopedAppointment(req);
      const own = ownProfessional(req);
      if (own !== undefined && input.professionalId !== undefined && input.professionalId !== own) {
        throw new ForbiddenError('Você só pode cuidar dos seus próprios atendimentos.');
      }
      // Sem permissão financeira não altera valores (o preço é recalculado só por quem vê valores).
      res.json(await c.appointments.update(appointmentId, input));
    },
    async updateAppointmentStatus(req: Request, res: Response) {
      const { status } = parse(z.object({ status: appointmentStatusSchema }), req.body);
      res.json(await c.appointments.update(await scopedAppointment(req), { status }));
    },
    async createAppointment(req: Request, res: Response) {
      const input = parse(manualAppointmentSchema, req.body);
      const own = ownProfessional(req);
      if (own === null) throw new ForbiddenError('Sua conta não tem profissional vinculado para criar atendimentos.');
      res.status(201).json(await c.appointments.createManual(input, req.admin!, own));
    },
    /** "Avisar tutor pelo WhatsApp": abre a conversa com a mensagem pronta e registra a tentativa. */
    async notifyPickup(req: Request, res: Response) {
      const appointmentId = await scopedAppointment(req);
      const appointment = await c.db.appointments.findById(appointmentId);
      res.status(201).json(await c.crm.startContact(appointment!.customerId, { kind: 'pickup', appointmentId }, req.admin!));
    },
    async resendNotifications(req: Request, res: Response) {
      res.json(await c.appointments.resendNotifications(await scopedAppointment(req)));
    },

    // ----- Clientes e pets -----
    async listCustomers(req: Request, res: Response) {
      const rows = await c.customers.listCustomers(parse(searchQuerySchema, req.query).search);
      const allowed = await ownIds(req);
      res.json(allowed ? rows.filter((r) => allowed.customers.has(r.id)) : rows);
    },
    async getCustomer(req: Request, res: Response) {
      const allowed = await ownIds(req);
      if (allowed && !allowed.customers.has(id(req))) throw new NotFoundError('Cliente não encontrado.');
      const detail = await c.customers.getCustomer(id(req));
      res.json(allowed ? { ...detail, appointments: detail.appointments.filter((a) => allowed.appointments.has(a.id)) } : detail);
    },
    async updateCustomer(req: Request, res: Response) {
      res.json(await c.customers.updateCustomer(id(req), parse(customerUpdateSchema, req.body)));
    },
    async listPets(req: Request, res: Response) {
      const rows = await c.customers.listPets(parse(searchQuerySchema, req.query).search);
      const allowed = await ownIds(req);
      res.json(allowed ? rows.filter((r) => allowed.pets.has(r.id)) : rows);
    },
    async getPet(req: Request, res: Response) {
      const allowed = await ownIds(req);
      if (allowed && !allowed.pets.has(id(req))) throw new NotFoundError('Pet não encontrado.');
      const detail = await c.customers.getPet(id(req));
      res.json(allowed ? { ...detail, appointments: detail.appointments.filter((a) => allowed.appointments.has(a.id)) } : detail);
    },
    async updatePet(req: Request, res: Response) {
      res.json(await c.customers.updatePet(id(req), parse(petUpdateSchema, req.body)));
    },
    async linkAccount(req: Request, res: Response) {
      res.json(await c.customers.linkAccount(id(req), parse(linkAccountSchema, req.body).email));
    },
    async unlinkAccount(req: Request, res: Response) {
      res.json(await c.customers.unlinkAccount(id(req)));
    },
    async petUploadTicket(req: Request, res: Response) {
      res.json(await c.customers.petUploadTicket(id(req), parse(privateUploadSchema, req.body)));
    },
    async setPetPhoto(req: Request, res: Response) {
      res.json(await c.customers.setPetPhoto(id(req), parse(petPhotoSchema, req.body).path));
    },
    async addPetReference(req: Request, res: Response) {
      res.status(201).json(await c.customers.addPetReference(id(req), parse(petReferenceSchema, req.body)));
    },
    async removePetReference(req: Request, res: Response) {
      const refId = parse(z.object({ refId: idSchema }), req.params).refId;
      res.json(await c.customers.removePetReference(id(req), refId));
    },

    // ----- Comentários -----
    async comments(_req: Request, res: Response) {
      res.json(await c.comments.listAdmin());
    },
    async removeComment(req: Request, res: Response) {
      await c.comments.remove(id(req));
      res.status(204).end();
    },

    // ----- CRM -----
    async crm(req: Request, res: Response) {
      res.json(await c.crm.list(parse(crmQuerySchema, req.query)));
    },
    async startContact(req: Request, res: Response) {
      res.status(201).json(await c.crm.startContact(id(req), parse(contactCreateSchema, req.body), req.admin!));
    },
    async updateContact(req: Request, res: Response) {
      res.json(await c.crm.updateContact(id(req), parse(contactUpdateSchema, req.body).status));
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
    reorder(entity: 'services' | 'addons' | 'sizes' | 'species' | 'breeds' | 'professionals') {
      return async (req: Request, res: Response) => {
        res.json(await c.catalog.reorder(entity, parse(reorderSchema, req.body).ids));
      };
    },
    // ----- Profissionais -----
    async createProfessional(req: Request, res: Response) {
      res.status(201).json(await c.catalog.createProfessional(parse(professionalSchema, req.body)));
    },
    async updateProfessional(req: Request, res: Response) {
      res.json(await c.catalog.updateProfessional(id(req), parse(partialOf(professionalSchema), req.body)));
    },
    async deleteProfessional(req: Request, res: Response) {
      await c.catalog.deleteProfessional(id(req));
      res.status(204).end();
    },

    // ----- Mídia: inspirações e stories -----
    async uploadTicket(req: Request, res: Response) {
      res.json(await c.media.createUploadTicket(req.body));
    },
    async listInspirations(_req: Request, res: Response) {
      res.json(await c.media.listInspirations());
    },
    async createInspiration(req: Request, res: Response) {
      res.status(201).json(await c.media.createInspiration(parse(inspirationSchema, req.body)));
    },
    async updateInspiration(req: Request, res: Response) {
      res.json(await c.media.updateInspiration(id(req), parse(partialOf(inspirationSchema), req.body)));
    },
    async deleteInspiration(req: Request, res: Response) {
      await c.media.deleteInspiration(id(req));
      res.status(204).end();
    },
    async listStories(_req: Request, res: Response) {
      res.json(await c.media.listAdminStories());
    },
    async createStory(req: Request, res: Response) {
      res.status(201).json(await c.media.createStory(parse(storySchema, req.body)));
    },
    async deleteStory(req: Request, res: Response) {
      await c.media.deleteStory(id(req));
      res.status(204).end();
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
    async addProfessionalTimeOff(req: Request, res: Response) {
      res.status(201).json(await c.schedule.addProfessionalTimeOff(parse(professionalTimeOffSchema, req.body)));
    },
    async removeProfessionalTimeOff(req: Request, res: Response) {
      await c.schedule.removeProfessionalTimeOff(id(req));
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
