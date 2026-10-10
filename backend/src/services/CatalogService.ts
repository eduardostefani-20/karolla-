import {
  addonSchema,
  breedSchema,
  formFieldsSchema,
  professionalSchema,
  resolveFormConfig,
  serviceSchema,
  servicePricesSchema,
  sizeSchema,
  speciesSchema,
  addDays,
  nowInTimezone,
  type AdminCatalog,
  type AppMode,
  type PricingCatalog,
  type PublicCatalog,
  type Service,
} from '@karolla/shared';
import type { z } from 'zod';
import type { DatabaseService, TableRepository } from '../repositories/types';
import { ConflictError, NotFoundError } from '../utils/errors';
import type { Clock } from '../utils/clock';

/**
 * Catálogo configurável: espécies, raças, portes, serviços, preços, adicionais e campos do formulário.
 * Tudo é editável pelo painel — nada de preço ou opção fixa no código.
 */
export class CatalogService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mode: AppMode,
    private readonly clock: Clock,
  ) {}

  /** Dados usados pelo motor de preços (inclui inativos; o motor decide o que é permitido). */
  async getPricingCatalog(): Promise<PricingCatalog> {
    const [services, servicePrices, addons, sizes] = await Promise.all([
      this.db.services.list(),
      this.db.servicePrices.list(),
      this.db.addons.list(),
      this.db.sizes.list(),
    ]);
    return { services, servicePrices, addons, sizes };
  }

  async getPublicCatalog(): Promise<PublicCatalog> {
    const [species, breeds, sizes, services, servicePrices, addons, formFields, businessHours, settings, blockedDates, professionals] = await Promise.all([
      this.db.species.list({ active: true }),
      this.db.breeds.list({ active: true }),
      this.db.sizes.list({ active: true }),
      this.db.services.list({ active: true }),
      this.db.servicePrices.list(),
      this.db.addons.list({ active: true }),
      this.db.formFields.list(),
      this.db.businessHours.list(),
      this.db.settings.get(),
      this.db.blockedDates.list(),
      this.db.professionals.list({ active: true }),
    ]);
    const activeServiceIds = new Set(services.map((s) => s.id));
    const activeSizeIds = new Set(sizes.map((s) => s.id));
    const today = nowInTimezone(this.clock.now(), settings.timezone).date;
    const lastDay = addDays(today, settings.maxAdvanceDays);
    return {
      species,
      breeds,
      sizes,
      services,
      servicePrices: servicePrices.filter((p) => activeServiceIds.has(p.serviceId) && activeSizeIds.has(p.sizeId)),
      addons,
      formFields: Object.values(resolveFormConfig(formFields)),
      businessHours,
      professionals: professionals.map(({ id, name, serviceIds }) => ({ id, name, serviceIds })),
      closedDates: blockedDates.filter((b) => b.date >= today && b.date <= lastDay).map((b) => b.date),
      settings: {
        businessName: settings.businessName,
        whatsappNumber: settings.whatsappNumber,
        contactEmail: settings.contactEmail,
        addressLine: settings.addressLine,
        city: settings.city,
        instagram: settings.instagram,
        timezone: settings.timezone,
        maxAdvanceDays: settings.maxAdvanceDays,
        bookingNotice: settings.bookingNotice,
      },
      mode: this.mode,
    };
  }

  async getAdminCatalog(): Promise<AdminCatalog> {
    const [species, breeds, sizes, services, servicePrices, addons, formFields, professionals] = await Promise.all([
      this.db.species.list(),
      this.db.breeds.list(),
      this.db.sizes.list(),
      this.db.services.list(),
      this.db.servicePrices.list(),
      this.db.addons.list(),
      this.db.formFields.list(),
      this.db.professionals.list(),
    ]);
    return { species, breeds, sizes, services, servicePrices, addons, formFields: Object.values(resolveFormConfig(formFields)), professionals };
  }

  // ---------- Serviços ----------
  private async nextSortOrder(repo: TableRepository<{ id: string; sortOrder: number }>) {
    const rows = await repo.list();
    return rows.reduce((max, r) => Math.max(max, r.sortOrder), 0) + 1;
  }

  async createService(input: z.output<typeof serviceSchema>): Promise<Service> {
    await this.assertSpeciesExist(input.speciesIds);
    const sortOrder = input.sortOrder || (await this.nextSortOrder(this.db.services));
    return this.db.services.create({ ...input, sortOrder });
  }

  async updateService(id: string, input: Partial<z.output<typeof serviceSchema>>) {
    if (input.speciesIds) await this.assertSpeciesExist(input.speciesIds);
    return this.db.services.update(id, input);
  }

  /** Exclusão só é permitida se o serviço nunca foi usado; caso contrário, deve ser desativado. */
  async deleteService(id: string) {
    if (!(await this.db.services.findById(id))) throw new NotFoundError('Serviço não encontrado.');
    if ((await this.db.appointments.countByService(id)) > 0) {
      throw new ConflictError('IN_USE', 'Este serviço já tem agendamentos. Desative-o em vez de excluir para preservar o histórico.');
    }
    for (const price of await this.db.servicePrices.list({ serviceId: id })) await this.db.servicePrices.delete(price.id);
    await this.db.services.delete(id);
  }

  async reorder(entity: 'services' | 'addons' | 'sizes' | 'species' | 'breeds' | 'professionals', ids: string[]) {
    const repo = this.db[entity] as TableRepository<{ id: string; sortOrder: number }>;
    for (const [index, id] of ids.entries()) await repo.update(id, { sortOrder: index + 1 });
    return repo.list();
  }

  private async assertSpeciesExist(ids: string[]) {
    if (!ids.length) return;
    const all = new Set((await this.db.species.list()).map((s) => s.id));
    if (ids.some((id) => !all.has(id))) throw new NotFoundError('Espécie não encontrada.');
  }

  // ---------- Preços ----------
  async savePrices(input: z.output<typeof servicePricesSchema>) {
    const [services, sizes, existing] = await Promise.all([this.db.services.list(), this.db.sizes.list(), this.db.servicePrices.list()]);
    const serviceIds = new Set(services.map((s) => s.id));
    const sizeIds = new Set(sizes.map((s) => s.id));
    for (const p of input.prices) {
      if (!serviceIds.has(p.serviceId)) throw new NotFoundError('Serviço não encontrado.');
      if (!sizeIds.has(p.sizeId)) throw new NotFoundError('Porte não encontrado.');
    }
    for (const p of input.prices) {
      const current = existing.find((e) => e.serviceId === p.serviceId && e.sizeId === p.sizeId);
      if (p.priceCents == null) {
        if (current) await this.db.servicePrices.delete(current.id);
      } else if (current) {
        await this.db.servicePrices.update(current.id, { priceCents: p.priceCents, durationMinutes: p.durationMinutes });
      } else {
        await this.db.servicePrices.create({ serviceId: p.serviceId, sizeId: p.sizeId, priceCents: p.priceCents, durationMinutes: p.durationMinutes });
      }
    }
    return this.db.servicePrices.list();
  }

  // ---------- Adicionais ----------
  async createAddon(input: z.output<typeof addonSchema>) {
    const sortOrder = input.sortOrder || (await this.nextSortOrder(this.db.addons));
    return this.db.addons.create({ ...input, sortOrder });
  }

  updateAddon(id: string, input: Partial<z.output<typeof addonSchema>>) {
    return this.db.addons.update(id, input);
  }

  async deleteAddon(id: string) {
    if (!(await this.db.addons.findById(id))) throw new NotFoundError('Adicional não encontrado.');
    if ((await this.db.appointments.countByAddon(id)) > 0) {
      throw new ConflictError('IN_USE', 'Este adicional já foi usado em agendamentos. Desative-o em vez de excluir.');
    }
    await this.db.addons.delete(id);
  }

  // ---------- Espécies, raças e portes ----------
  async createSpecies(input: z.output<typeof speciesSchema>) {
    const sortOrder = input.sortOrder || (await this.nextSortOrder(this.db.species));
    return this.db.species.create({ ...input, sortOrder });
  }
  updateSpecies(id: string, input: Partial<z.output<typeof speciesSchema>>) {
    return this.db.species.update(id, input);
  }
  async deleteSpecies(id: string) {
    const [pets, breeds] = await Promise.all([this.db.pets.list({ speciesId: id }), this.db.breeds.list({ speciesId: id })]);
    if (pets.length || breeds.length) {
      throw new ConflictError('IN_USE', 'Esta espécie possui raças ou pets cadastrados. Desative-a em vez de excluir.');
    }
    await this.db.species.delete(id);
  }

  async createBreed(input: z.output<typeof breedSchema>) {
    if (!(await this.db.species.findById(input.speciesId))) throw new NotFoundError('Espécie não encontrada.');
    const sortOrder = input.sortOrder || (await this.nextSortOrder(this.db.breeds));
    return this.db.breeds.create({ ...input, sortOrder });
  }
  updateBreed(id: string, input: Partial<z.output<typeof breedSchema>>) {
    return this.db.breeds.update(id, input);
  }
  async deleteBreed(id: string) {
    if ((await this.db.pets.list({ breedId: id })).length) {
      throw new ConflictError('IN_USE', 'Há pets cadastrados com esta raça. Desative-a em vez de excluir.');
    }
    await this.db.breeds.delete(id);
  }

  async createSize(input: z.output<typeof sizeSchema>) {
    const sortOrder = input.sortOrder || (await this.nextSortOrder(this.db.sizes));
    return this.db.sizes.create({ ...input, sortOrder });
  }
  updateSize(id: string, input: Partial<z.output<typeof sizeSchema>>) {
    return this.db.sizes.update(id, input);
  }
  async deleteSize(id: string) {
    const [pets, appointments] = await Promise.all([this.db.pets.list({ sizeId: id }), this.db.appointments.list()]);
    if (pets.length || appointments.some((a) => a.sizeId === id)) {
      throw new ConflictError('IN_USE', 'Este porte já é usado por pets ou agendamentos. Desative-o em vez de excluir.');
    }
    for (const price of await this.db.servicePrices.list({ sizeId: id })) await this.db.servicePrices.delete(price.id);
    await this.db.sizes.delete(id);
  }

  // ---------- Profissionais ----------
  private async assertServicesExist(ids: string[]) {
    if (!ids.length) return;
    const all = new Set((await this.db.services.list()).map((s) => s.id));
    if (ids.some((id) => !all.has(id))) throw new NotFoundError('Serviço não encontrado.');
  }

  async createProfessional(input: z.output<typeof professionalSchema>) {
    await this.assertServicesExist(input.serviceIds);
    const sortOrder = input.sortOrder || (await this.nextSortOrder(this.db.professionals));
    return this.db.professionals.create({ ...input, sortOrder });
  }

  async updateProfessional(id: string, input: Partial<z.output<typeof professionalSchema>>) {
    if (input.serviceIds) await this.assertServicesExist(input.serviceIds);
    return this.db.professionals.update(id, input);
  }

  /** Profissional com histórico não é excluído (a agenda antiga continua com o nome dele): desative. */
  async deleteProfessional(id: string) {
    if (!(await this.db.professionals.findById(id))) throw new NotFoundError('Profissional não encontrado.');
    if ((await this.db.appointments.countByProfessional(id)) > 0) {
      throw new ConflictError('IN_USE', 'Este profissional tem agendamentos. Desative-o em vez de excluir para manter o histórico.');
    }
    await this.db.professionals.delete(id);
  }

  // ---------- Campos do formulário ----------
  async saveFormFields(input: z.output<typeof formFieldsSchema>) {
    const fields = input.fields.map((f) => ({ ...f, required: f.enabled && f.required }));
    await this.db.formFields.upsertMany(fields);
    return Object.values(resolveFormConfig(await this.db.formFields.list()));
  }
}
