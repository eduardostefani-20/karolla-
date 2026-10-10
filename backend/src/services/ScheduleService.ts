import {
  blockedDateSchema,
  blockedTimeSchema,
  businessHoursSchema,
  settingsSchema,
  type AvailabilityContext,
  type BusinessSettings,
} from '@karolla/shared';
import type { z } from 'zod';
import type { DatabaseService } from '../repositories/types';
import { ConflictError } from '../utils/errors';
import type { Clock } from '../utils/clock';

/** Horários de funcionamento, bloqueios e configurações gerais do negócio. */
export class ScheduleService {
  constructor(
    private readonly db: DatabaseService,
    private readonly clock: Clock,
  ) {}

  async getSchedule() {
    const [businessHours, blockedDates, blockedTimes] = await Promise.all([
      this.db.businessHours.list(),
      this.db.blockedDates.list(),
      this.db.blockedTimes.list(),
    ]);
    return { businessHours, blockedDates, blockedTimes };
  }

  /** Contexto completo para o motor de disponibilidade. */
  async getAvailabilityContext(from: string, to: string): Promise<AvailabilityContext> {
    const [businessHours, blockedDates, blockedTimes, appointments, settings, professionals] = await Promise.all([
      this.db.businessHours.list(),
      this.db.blockedDates.list(),
      this.db.blockedTimes.list(),
      this.db.appointments.listOccupying(from, to),
      this.db.settings.get(),
      this.db.professionals.list({ active: true }),
    ]);
    return {
      professionals: professionals.map(({ id, serviceIds }) => ({ id, serviceIds })),
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

  updateSettings(input: z.output<typeof settingsSchema>) {
    return this.db.settings.update(input);
  }
}
