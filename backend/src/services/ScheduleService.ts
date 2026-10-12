import {
  blockedDateSchema,
  blockedTimeSchema,
  businessHoursSchema,
  professionalTimeOffSchema,
  settingsSchema,
  DEFAULT_CRM_INACTIVE_DAYS,
  DEFAULT_CRM_REACTIVATION_MESSAGE,
  DEFAULT_PICKUP_MESSAGE,
  type AvailabilityContext,
  type BusinessSettings,
} from '@karolla/shared';
import type { z } from 'zod';
import type { DatabaseService } from '../repositories/types';
import { ConflictError, NotFoundError } from '../utils/errors';
import type { Clock } from '../utils/clock';
import { assertSchemaFor } from './schemaGuard';

/** Horários de funcionamento, bloqueios e configurações gerais do negócio. */
export class ScheduleService {
  constructor(
    private readonly db: DatabaseService,
    private readonly clock: Clock,
  ) {}

  async getSchedule() {
    const [businessHours, blockedDates, blockedTimes, professionalTimeOff] = await Promise.all([
      this.db.businessHours.list(),
      this.db.blockedDates.list(),
      this.db.blockedTimes.list(),
      this.db.professionalTimeOff.list(),
    ]);
    return { businessHours, blockedDates, blockedTimes, professionalTimeOff };
  }

  async addProfessionalTimeOff(input: z.output<typeof professionalTimeOffSchema>) {
    if (!(await this.db.professionals.findById(input.professionalId))) throw new NotFoundError('Profissional não encontrado.');
    return this.db.professionalTimeOff.create(input);
  }

  async removeProfessionalTimeOff(id: string) {
    await this.db.professionalTimeOff.delete(id);
  }

  /** Contexto completo para o motor de disponibilidade. */
  async getAvailabilityContext(from: string, to: string): Promise<AvailabilityContext> {
    const [businessHours, blockedDates, blockedTimes, appointments, settings, professionals, timeOff, services] = await Promise.all([
      this.db.businessHours.list(),
      this.db.blockedDates.list(),
      this.db.blockedTimes.list(),
      this.db.appointments.listOccupying(from, to),
      this.db.settings.get(),
      this.db.professionals.list({ active: true }),
      this.db.professionalTimeOff.list(),
      this.db.services.list(),
    ]);
    const relevantOff = timeOff.filter((t) => t.dateTo >= from && t.dateFrom <= to);
    const serviceLimits = Object.fromEntries(services.filter((s) => s.maxConcurrent).map((s) => [s.id, s.maxConcurrent!]));
    return {
      // Só profissionais ATIVOS; desativar tira o profissional dos horários futuros (histórico fica).
      professionals: professionals.map(({ id, serviceIds, capacity, workHours }) => ({
        id,
        serviceIds,
        capacity,
        workHours,
        timeOff: relevantOff.filter((t) => t.professionalId === id),
      })),
      serviceLimits,
      businessHours,
      blockedDates,
      blockedTimes,
      appointments,
      settings,
      now: this.clock.now(),
    };
  }

  async saveBusinessHours(input: z.output<typeof businessHoursSchema>) {
    const weekdays = new Set(input.days.map((d) => d.weekday));
    if (weekdays.size !== 7) throw new ConflictError('INVALID_WEEK', 'Informe cada dia da semana uma única vez.');
    const existing = await this.db.businessHours.list();
    for (const day of input.days) {
      const data = {
        ...day,
        breakStart: day.isOpen ? day.breakStart : null,
        breakEnd: day.isOpen ? day.breakEnd : null,
      };
      const current = existing.find((e) => e.weekday === day.weekday);
      if (current) await this.db.businessHours.update(current.id, data);
      else await this.db.businessHours.create(data);
    }
    return this.db.businessHours.list();
  }

  async addBlockedDate(input: z.output<typeof blockedDateSchema>) {
    if ((await this.db.blockedDates.list({ date: input.date })).length) {
      throw new ConflictError('DUPLICATED', 'Esta data já está bloqueada.');
    }
    return this.db.blockedDates.create(input);
  }

  removeBlockedDate(id: string) {
    return this.db.blockedDates.delete(id);
  }

  addBlockedTime(input: z.output<typeof blockedTimeSchema>) {
    return this.db.blockedTimes.create(input);
  }

  removeBlockedTime(id: string) {
    return this.db.blockedTimes.delete(id);
  }

  getSettings(): Promise<BusinessSettings> {
    return this.db.settings.get();
  }

  async updateSettings(input: z.output<typeof settingsSchema>) {
    await assertSchemaFor(
      this.db,
      9,
      input.crmInactiveDays !== DEFAULT_CRM_INACTIVE_DAYS || input.crmReactivationMessage !== DEFAULT_CRM_REACTIVATION_MESSAGE,
      'A configuração do CRM',
    );
    await assertSchemaFor(this.db, 10, input.slotCapacityLimit != null || input.pickupMessage !== DEFAULT_PICKUP_MESSAGE, 'O limite geral por horário e a mensagem de retirada');
    await assertSchemaFor(this.db, 11, input.taxiEnabled || input.taxiWindows.length > 0, 'O Taxi Dog');
    return this.db.settings.update(input);
  }
}
