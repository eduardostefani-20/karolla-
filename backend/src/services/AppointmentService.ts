import {
  addDays,
  attributionChannel,
  calculateAppointmentPrice,
  checkSlot,
  effectiveCapacity,
  isBlockingStatus,
  nowInTimezone,
  SLOT_REASON_MESSAGES,
  type Appointment,
  type AppointmentDetail,
  type AppointmentListQuery,
  type AppointmentUpdateInput,
  type Customer,
  type DashboardData,
  type Pet,
  type AdminUser,
  type AppointmentStatus,
  type manualAppointmentSchema,
  APPOINTMENT_STATUS_LABELS,
  CUSTOMER_DEFAULTS,
  PET_DEFAULTS,
  STATUSES_SINCE_0010,
} from '@karolla/shared';
import type { z } from 'zod';
import type { DatabaseService, AppointmentPatch } from '../repositories/types';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import type { Clock } from '../utils/clock';
import type { CatalogService } from './CatalogService';
import type { ScheduleService } from './ScheduleService';
import type { NotificationService } from './NotificationService';
import { pricingErrorToAppError } from './BookingService';

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/** Gestão de agendamentos no painel administrativo. */
export class AppointmentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly catalog: CatalogService,
    private readonly schedule: ScheduleService,
    private readonly notifications: NotificationService,
    private readonly clock: Clock,
  ) {}

  private async attach(appointments: Appointment[]): Promise<AppointmentDetail[]> {
    if (!appointments.length) return [];
    const [customers, pets, professionals] = await Promise.all([this.db.customers.list(), this.db.pets.list(), this.db.professionals.list()]);
    const byCustomer = new Map(customers.map((c) => [c.id, c]));
    const byPet = new Map(pets.map((p) => [p.id, p]));
    const byPro = new Map(professionals.map(({ id, name, color }) => [id, { id, name, color }]));
    return appointments
      .filter((a) => byCustomer.has(a.customerId) && byPet.has(a.petId))
      .map((a) => ({
        ...a,
        customer: byCustomer.get(a.customerId) as Customer,
        pet: byPet.get(a.petId) as Pet,
        professional: (a.professionalId && byPro.get(a.professionalId)) || null,
      }));
  }

  async list(query: AppointmentListQuery): Promise<AppointmentDetail[]> {
    const rows = await this.attach(await this.db.appointments.list(query));
    if (!query.search) return rows;
    const term = query.search.toLowerCase();
    const digits = term.replace(/\D/g, '');
    return rows.filter(
      (a) =>
        a.pet.name.toLowerCase().includes(term) ||
        a.customer.name.toLowerCase().includes(term) ||
        (digits.length >= 4 && a.customer.whatsapp.includes(digits)),
    );
  }

  async get(id: string): Promise<AppointmentDetail> {
    const appointment = await this.db.appointments.findById(id);
    if (!appointment) throw new NotFoundError('Agendamento não encontrado.');
    const [detail] = await this.attach([appointment]);
    if (!detail) throw new NotFoundError('Cliente ou pet do agendamento não encontrado.');
    const integrationLogs = await this.db.integrationLogs.list({ appointmentId: id });
    return { ...detail, integrationLogs };
  }

  /** Novos status só depois da migração 0010 (antes disso o banco recusaria). */
  private async assertStatusAvailable(status: AppointmentStatus | undefined) {
    if (status && STATUSES_SINCE_0010.includes(status) && !(await this.db.featuresReady(10))) {
      throw new AppError(409, 'SETUP_PENDING', `O status "${APPOINTMENT_STATUS_LABELS[status]}" fica disponível depois da atualização do banco.`);
    }
  }

  /**
   * Agendamento criado pela equipe (WhatsApp, telefone, presencial). Usa a MESMA agenda do site:
   * mesmas regras de funcionamento, capacidade e profissionais (pode ser para hoje/sem antecedência).
   */
  async createManual(input: z.output<typeof manualAppointmentSchema>, actor: AdminUser, ownProfessionalId?: string | null): Promise<AppointmentDetail> {
    await this.assertStatusAvailable(input.status);
    const professionalId = ownProfessionalId !== undefined ? ownProfessionalId : input.professionalId;

    // 1. Tutor: existente ou novo (WhatsApp já cadastrado reaproveita o cadastro, sem sobrescrever).
    let customer: Customer | null = null;
    if (input.customerId) {
      customer = await this.db.customers.findById(input.customerId);
      if (!customer) throw new NotFoundError('Cliente não encontrado.');
    } else if (input.newCustomer) {
      customer =
        (await this.db.customers.findByWhatsapp(input.newCustomer.whatsapp)) ??
        (await this.db.customers.create({
          ...CUSTOMER_DEFAULTS,
          name: input.newCustomer.name,
          whatsapp: input.newCustomer.whatsapp,
          email: input.newCustomer.email,
          address: { street: '', number: '', complement: '', neighborhood: '', city: '' },
          notes: '',
        }));
    }
    if (!customer) throw new ValidationError('Escolha ou cadastre o tutor.', { customerId: 'Escolha ou cadastre o tutor.' });

    // 2. Pet: do próprio tutor, ou novo
    let pet: Pet | null = null;
    if (input.petId) {
      pet = await this.db.pets.findById(input.petId);
      if (!pet || pet.customerId !== customer.id) throw new NotFoundError('Pet não encontrado para este tutor.');
    } else if (input.newPet) {
      const [species, size] = await Promise.all([this.db.species.findById(input.newPet.speciesId), this.db.sizes.findById(input.newPet.sizeId)]);
      if (!species) throw new ValidationError('Espécie inválida.', { 'newPet.speciesId': 'Escolha a espécie.' });
      if (!size) throw new ValidationError('Porte inválido.', { 'newPet.sizeId': 'Escolha o porte.' });
      let breedName = input.newPet.breedName;
      if (input.newPet.breedId) {
        const breed = await this.db.breeds.findById(input.newPet.breedId);
        if (!breed || breed.speciesId !== species.id) throw new ValidationError('Raça inválida.', { 'newPet.breedId': 'Escolha uma raça da lista.' });
        breedName = breed.name;
      }
      pet = await this.db.pets.create({
        ...PET_DEFAULTS,
        customerId: customer.id,
        name: input.newPet.name,
        speciesId: species.id,
        breedId: input.newPet.breedId,
        breedName,
        sizeId: size.id,
        weightKg: null,
        ageMonths: null,
        notes: '',
      });
    }
    if (!pet) throw new ValidationError('Escolha ou cadastre o pet.', { petId: 'Escolha ou cadastre o pet.' });
    if (professionalId && !(await this.db.professionals.findById(professionalId))) throw new NotFoundError('Profissional não encontrado.');

    // 3. Preço calculado no servidor pela tabela atual
    let price;
    try {
      price = calculateAppointmentPrice({ serviceIds: input.serviceIds, addonIds: input.addonIds, sizeId: pet.sizeId, speciesId: pet.speciesId }, await this.catalog.getPricingCatalog());
    } catch (err) {
      pricingErrorToAppError(err);
    }

    // 4. Disponibilidade (mesma regra do site, sem exigir antecedência)
    const ctx = await this.schedule.getAvailabilityContext(input.date, input.date);
    const slot = checkSlot(ctx, input.date, input.time, price.totalDurationMinutes, {
      enforceBookingWindow: false,
      serviceIds: input.serviceIds,
      professionalId: professionalId ?? undefined,
    });
    if (!slot.ok) throw new ConflictError('SLOT_UNAVAILABLE', SLOT_REASON_MESSAGES[slot.reason]);
    const assigned = professionalId ?? slot.professionalId ?? null;

    const appointment = await this.db.appointments.create(
      {
        customerId: customer.id,
        petId: pet.id,
        sizeId: pet.sizeId,
        date: input.date,
        time: input.time,
        durationMinutes: price.totalDurationMinutes,
        totalCents: price.totalCents,
        status: input.status,
        notes: input.notes,
        customerNotes: '',
        source: 'admin',
        origin: input.origin,
        createdByName: actor.name || actor.email,
        professionalId: assigned,
        inspiration: null,
        attribution: null,
        services: price.lines.filter((l) => l.kind === 'service').map((l) => ({ serviceId: l.refId, name: l.name, priceCents: l.priceCents, durationMinutes: l.durationMinutes })),
        addons: price.lines.filter((l) => l.kind === 'addon').map((l) => ({ addonId: l.refId, name: l.name, priceCents: l.priceCents, durationMinutes: l.durationMinutes })),
      },
      { capacity: effectiveCapacity(ctx, { date: input.date, time: input.time, durationMinutes: price.totalDurationMinutes }), professionalId: assigned, professionalCapacity: ctx.professionals?.find((p) => p.id === assigned)?.capacity },
    );
    await this.notifications.onAppointmentCreated(appointment, customer, pet).catch(() => undefined);
    return this.get(appointment.id);
  }

  async update(id: string, input: AppointmentUpdateInput & { recalculatePrice?: boolean }): Promise<AppointmentDetail> {
    const current = await this.db.appointments.findById(id);
    if (!current) throw new NotFoundError('Agendamento não encontrado.');
    await this.assertStatusAvailable(input.status);

    const serviceIds = input.serviceIds ?? current.services.map((s) => s.serviceId);
    const addonIds = input.addonIds ?? current.addons.map((a) => a.addonId);
    const sizeId = input.sizeId ?? current.sizeId;
    const itemsChanged =
      !sameIds(serviceIds, current.services.map((s) => s.serviceId)) ||
      !sameIds(addonIds, current.addons.map((a) => a.addonId)) ||
      sizeId !== current.sizeId;

    const patch: AppointmentPatch = {
      date: input.date,
      time: input.time,
      status: input.status,
      notes: input.notes,
      customerNotes: input.customerNotes,
      professionalId: input.professionalId,
    };
    if (input.professionalId && !(await this.db.professionals.findById(input.professionalId))) {
      throw new NotFoundError('Profissional não encontrado.');
    }

    if (itemsChanged || input.recalculatePrice) {
      let price;
      try {
        // allowInactive: o painel pode manter itens já desativados em agendamentos antigos
        price = calculateAppointmentPrice({ serviceIds, addonIds, sizeId }, await this.catalog.getPricingCatalog(), { allowInactive: true });
      } catch (err) {
        pricingErrorToAppError(err);
      }
      Object.assign(patch, {
        sizeId,
        totalCents: price.totalCents,
        durationMinutes: price.totalDurationMinutes,
        services: price.lines.filter((l) => l.kind === 'service').map((l) => ({ serviceId: l.refId, name: l.name, priceCents: l.priceCents, durationMinutes: l.durationMinutes })),
        addons: price.lines.filter((l) => l.kind === 'addon').map((l) => ({ addonId: l.refId, name: l.name, priceCents: l.priceCents, durationMinutes: l.durationMinutes })),
      });
    }

    const next = {
      date: patch.date ?? current.date,
      time: patch.time ?? current.time,
      durationMinutes: patch.durationMinutes ?? current.durationMinutes,
      status: patch.status ?? current.status,
      professionalId: input.professionalId !== undefined ? input.professionalId : current.professionalId,
    };
    const occupiesNewTime =
      next.professionalId !== current.professionalId ||
      itemsChanged ||
      next.date !== current.date ||
      next.time !== current.time ||
      next.durationMinutes > current.durationMinutes ||
      (!isBlockingStatus(current.status) && isBlockingStatus(next.status));

    let guard = null;
    if (occupiesNewTime && isBlockingStatus(next.status)) {
      // Admin pode agendar no passado/sem antecedência, mas nunca em conflito ou fora do funcionamento.
      const ctx = await this.schedule.getAvailabilityContext(next.date, next.date);
      const result = checkSlot(ctx, next.date, next.time, next.durationMinutes, {
        excludeAppointmentId: id,
        enforceBookingWindow: false,
        serviceIds,
        professionalId: next.professionalId ?? undefined,
      });
      if (!result.ok) throw new ConflictError('SLOT_UNAVAILABLE', SLOT_REASON_MESSAGES[result.reason]);
      // Agenda por profissional: agendamento sem profissional recebe um livre ao ser remarcado.
      if (!next.professionalId && result.professionalId) patch.professionalId = result.professionalId;
      const guardPro = patch.professionalId ?? next.professionalId;
      guard = {
        capacity: effectiveCapacity(ctx, next),
        professionalId: guardPro,
        professionalCapacity: ctx.professionals?.find((p) => p.id === guardPro)?.capacity,
      };
    }

    const updated = await this.db.appointments.update(id, patch, guard);
    await this.notifications.onAppointmentUpdated(updated);
    return this.get(updated.id);
  }

  async resendNotifications(id: string) {
    const appointment = await this.db.appointments.findById(id);
    if (!appointment) throw new NotFoundError('Agendamento não encontrado.');
    await this.notifications.resend(appointment);
    return this.get(id);
  }

  /** `onlyProfessionalId` = conta com agenda "só os próprios atendimentos" (não vê totais da loja). */
  async dashboard(onlyProfessionalId?: string | null): Promise<DashboardData> {
    const settings = await this.db.settings.get();
    const today = nowInTimezone(this.clock.now(), settings.timezone).date;
    const own = onlyProfessionalId !== undefined;
    const [allRecent, customers, pets] = await Promise.all([
      this.db.appointments.list({ from: addDays(today, -30), to: addDays(today, 365) }),
      own ? Promise.resolve([]) : this.db.customers.list(),
      own ? Promise.resolve([]) : this.db.pets.list(),
    ]);
    const recentRaw = own ? allRecent.filter((a) => onlyProfessionalId !== null && a.professionalId === onlyProfessionalId) : allRecent;
    const upcomingRaw = recentRaw.filter((a) => a.date >= today);
    const todayRows = upcomingRaw.filter((a) => a.date === today && a.status !== 'cancelled');
    const future = upcomingRaw.filter((a) => a.status === 'pending' || a.status === 'confirmed' || a.status === 'waiting');
    const [todayAgenda, nextAppointments] = await Promise.all([
      this.attach(todayRows),
      this.attach(future.filter((a) => a.date > today).slice(0, 6)),
    ]);
    return {
      today,
      stats: {
        appointmentsToday: todayRows.length,
        upcoming: future.length,
        pending: future.filter((a) => a.status === 'pending').length,
        confirmed: future.filter((a) => a.status === 'confirmed').length,
        customers: customers.length,
        pets: pets.length,
        revenueTodayCents: todayRows.filter((a) => a.status !== 'no_show').reduce((sum, a) => sum + a.totalCents, 0),
      },
      todayAgenda,
      nextAppointments,
      channels: own ? [] : this.channels(recentRaw),
    };
  }

  /** Agendamentos online feitos nos últimos 30 dias, por origem — mostra quais anúncios trazem clientes. */
  private channels(appointments: Appointment[]): DashboardData['channels'] {
    const since = this.clock.now().getTime() - 30 * 24 * 60 * 60 * 1000;
    const groups = new Map<string, DashboardData['channels'][number]>();
    for (const a of appointments) {
      if (a.source !== 'online' || Date.parse(a.createdAt) < since) continue;
      const channel = attributionChannel(a.attribution);
      const group = groups.get(channel.key) ?? { ...channel, count: 0, revenueCents: 0 };
      group.count += 1;
      if (isBlockingStatus(a.status)) group.revenueCents += a.totalCents;
      groups.set(channel.key, group);
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || b.revenueCents - a.revenueCents);
  }
}
