import type {
  AppointmentStatus,
  BlockedDate,
  BlockedTime,
  BusinessHours,
  BusinessSettings,
} from '../types/domain';
import { NON_BLOCKING_STATUSES } from '../types/domain';
import { diffInDays, minutesToTime, nowInTimezone, timeToMinutes, weekdayOf } from '../utils/date';

/**
 * MOTOR DE DISPONIBILIDADE — regras de agenda compartilhadas.
 *
 * Considera: horário de funcionamento, intervalo (almoço), duração do atendimento,
 * horários ocupados, bloqueios de data/horário, dias fechados, antecedência mínima,
 * limite de dias à frente e capacidade de atendimentos simultâneos.
 *
 * O back-end usa as mesmas funções antes de gravar (e o banco revalida de forma atômica).
 */

export interface OccupiedSlot {
  id?: string;
  date: string;
  time: string;
  durationMinutes: number;
  status: AppointmentStatus;
}

export type SchedulingSettings = Pick<
  BusinessSettings,
  'slotIntervalMinutes' | 'capacity' | 'minAdvanceMinutes' | 'maxAdvanceDays' | 'timezone'
>;

export interface AvailabilityContext {
  businessHours: BusinessHours[];
  blockedDates: BlockedDate[];
  blockedTimes: BlockedTime[];
  appointments: OccupiedSlot[];
  settings: SchedulingSettings;
  now: Date;
}

export type SlotUnavailableReason =
  | 'INVALID'
  | 'PAST'
  | 'TOO_SOON'
  | 'TOO_FAR'
  | 'CLOSED_DAY'
  | 'BLOCKED_DATE'
  | 'OUTSIDE_HOURS'
  | 'BREAK'
  | 'BLOCKED_TIME'
  | 'FULL';

export const SLOT_REASON_MESSAGES: Record<SlotUnavailableReason, string> = {
  INVALID: 'Data ou horário inválido.',
  PAST: 'Não é possível agendar em uma data ou horário que já passou.',
  TOO_SOON: 'Este horário está muito próximo. Escolha um horário com mais antecedência.',
  TOO_FAR: 'Esta data ainda não está aberta para agendamentos.',
  CLOSED_DAY: 'A Karolla Pet não abre neste dia.',
  BLOCKED_DATE: 'Esta data não está disponível para agendamentos.',
  OUTSIDE_HOURS: 'O atendimento não cabe no horário de funcionamento.',
  BREAK: 'Este horário coincide com o intervalo da equipe.',
  BLOCKED_TIME: 'Este horário está bloqueado.',
  FULL: 'Este horário acabou de ser ocupado. Escolha outro horário.',
};

export interface SlotCheckOptions {
  /** Ignora um agendamento (o próprio, ao remarcar). */
  excludeAppointmentId?: string;
  /** Aplica antecedência mínima / máxima e bloqueio de passado (site público). Padrão: true. */
  enforceBookingWindow?: boolean;
  /** Aplica funcionamento, intervalo e bloqueios. Padrão: true. */
  enforceBusinessRules?: boolean;
}

export type SlotCheckResult = { ok: true } | { ok: false; reason: SlotUnavailableReason };

export function isBlockingStatus(status: AppointmentStatus): boolean {
  return !NON_BLOCKING_STATUSES.includes(status);
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Maior número de atendimentos simultâneos já existentes dentro do intervalo [start, end).
 * Usa varredura pelos pontos de início — exato para intervalos semiabertos.
 */
export function maxConcurrentInInterval(
  appointments: OccupiedSlot[],
  date: string,
  start: number,
  end: number,
  excludeId?: string,
): number {
  const relevant = appointments
    .filter((a) => a.date === date && isBlockingStatus(a.status) && (excludeId == null || a.id !== excludeId))
    .map((a) => {
      const s = timeToMinutes(a.time);
      return { s, e: s + a.durationMinutes };
    })
    .filter((a) => overlaps(a.s, a.e, start, end));

  const points = [start, ...relevant.map((a) => a.s).filter((s) => s > start && s < end)];
  let max = 0;
  for (const p of points) {
    const count = relevant.filter((a) => a.s <= p && p < a.e).length;
    if (count > max) max = count;
  }
  return max;
}

export function checkSlot(
  ctx: AvailabilityContext,
  date: string,
  time: string,
  durationMinutes: number,
  options: SlotCheckOptions = {},
): SlotCheckResult {
  const { enforceBookingWindow = true, enforceBusinessRules = true } = options;
  if (durationMinutes <= 0) return { ok: false, reason: 'INVALID' };

  const start = timeToMinutes(time);
  const end = start + durationMinutes;

  if (enforceBookingWindow) {
    const now = nowInTimezone(ctx.now, ctx.settings.timezone);
    const daysAhead = diffInDays(now.date, date);
    if (daysAhead < 0 || (daysAhead === 0 && start <= now.minutes)) return { ok: false, reason: 'PAST' };
    const minutesUntil = daysAhead * 1440 + start - now.minutes;
    if (minutesUntil < ctx.settings.minAdvanceMinutes) return { ok: false, reason: 'TOO_SOON' };
    if (daysAhead > ctx.settings.maxAdvanceDays) return { ok: false, reason: 'TOO_FAR' };
  }

  if (enforceBusinessRules) {
    if (ctx.blockedDates.some((b) => b.date === date)) return { ok: false, reason: 'BLOCKED_DATE' };
    const hours = ctx.businessHours.find((h) => h.weekday === weekdayOf(date));
    if (!hours || !hours.isOpen) return { ok: false, reason: 'CLOSED_DAY' };
    if (start < timeToMinutes(hours.openTime) || end > timeToMinutes(hours.closeTime)) {
      return { ok: false, reason: 'OUTSIDE_HOURS' };
    }
    if (hours.breakStart && hours.breakEnd) {
      if (overlaps(start, end, timeToMinutes(hours.breakStart), timeToMinutes(hours.breakEnd))) {
        return { ok: false, reason: 'BREAK' };
      }
    }
    const blockedTime = ctx.blockedTimes.some(
      (b) => b.date === date && overlaps(start, end, timeToMinutes(b.startTime), timeToMinutes(b.endTime)),
    );
    if (blockedTime) return { ok: false, reason: 'BLOCKED_TIME' };
  }

  const concurrent = maxConcurrentInInterval(ctx.appointments, date, start, end, options.excludeAppointmentId);
  if (concurrent >= Math.max(1, ctx.settings.capacity)) return { ok: false, reason: 'FULL' };

  return { ok: true };
}

export interface DayAvailability {
  date: string;
  /** Motivo quando o dia inteiro está indisponível. */
  closedReason: SlotUnavailableReason | null;
  slots: { time: string; available: boolean }[];
}

/** Lista todos os horários do dia com sua disponibilidade para um atendimento com a duração informada. */
export function getDayAvailability(
  ctx: AvailabilityContext,
  date: string,
  durationMinutes: number,
): DayAvailability {
  const now = nowInTimezone(ctx.now, ctx.settings.timezone);
  const daysAhead = diffInDays(now.date, date);
  const dayReason: SlotUnavailableReason | null =
    daysAhead < 0
      ? 'PAST'
      : daysAhead > ctx.settings.maxAdvanceDays
        ? 'TOO_FAR'
        : ctx.blockedDates.some((b) => b.date === date)
          ? 'BLOCKED_DATE'
          : null;

  const hours = ctx.businessHours.find((h) => h.weekday === weekdayOf(date));
  if (dayReason) return { date, closedReason: dayReason, slots: [] };
  if (!hours || !hours.isOpen) return { date, closedReason: 'CLOSED_DAY', slots: [] };

  const step = Math.max(5, ctx.settings.slotIntervalMinutes);
  const slots: DayAvailability['slots'] = [];
  for (let m = timeToMinutes(hours.openTime); m + durationMinutes <= timeToMinutes(hours.closeTime); m += step) {
    const time = minutesToTime(m);
    const result = checkSlot(ctx, date, time, durationMinutes);
    // Horários que caem no intervalo nem aparecem; os demais aparecem como ocupados/indisponíveis.
    if (!result.ok && result.reason === 'BREAK') continue;
    slots.push({ time, available: result.ok });
  }
  const anyAvailable = slots.some((s) => s.available);
  return { date, closedReason: anyAvailable || slots.length ? null : 'OUTSIDE_HOURS', slots };
}
