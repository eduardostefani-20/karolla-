import {
  addDays,
  calculateAppointmentPrice,
  checkSlot,
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
} from '@karolla/shared';
import type { DatabaseService, AppointmentPatch } from '../repositories/types';
import { ConflictError, NotFoundError } from '../utils/errors';
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
    const [customers, pets] = await Promise.all([this.db.customers.list(), this.db.pets.list()]);
    const byCustomer = new Map(customers.map((c) => [c.id, c]));
    const byPet = new Map(pets.map((p) => [p.id, p]));
    return appointments
      .filter((a) => byCustomer.has(a.customerId) && byPet.has(a.petId))
      .map((a) => ({ ...a, customer: byCustomer.get(a.customerId) as Customer, pet: byPet.get(a.petId) as Pet }));
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

  async update(id: string, input: AppointmentUpdateInput & { recalculatePrice?: boolean }): Promise<AppointmentDetail> {
    const current = await this.db.appointments.findById(id);
    if (!current) throw new NotFoundError('Agendamento não encontrado.');

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
    };

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
    };
    const occupiesNewTime =
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
      });
      if (!result.ok) throw new ConflictError('SLOT_UNAVAILABLE', SLOT_REASON_MESSAGES[result.reason]);
      guard = { capacity: ctx.settings.capacity };
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

  async dashboard(): Promise<DashboardData> {
    const settings = await this.db.settings.get();
    const today = nowInTimezone(this.clock.now(), settings.timezone).date;
    const [upcomingRaw, customers, pets] = await Promise.all([
      this.db.appointments.list({ from: today, to: addDays(today, 365) }),
      this.db.customers.list(),
      this.db.pets.list(),
    ]);
    const todayRows = upcomingRaw.filter((a) => a.date === today && a.status !== 'cancelled');
    const future = upcomingRaw.filter((a) => a.status === 'pending' || a.status === 'confirmed');
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
    };
  }
}
