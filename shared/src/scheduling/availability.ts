import type {
  AppointmentStatus,
  BlockedDate,
  BlockedTime,
  BusinessHours,
  BusinessSettings,
  ProfessionalTimeOff,
  ProfessionalWorkHours,
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
  professionalId?: string | null;
  /** Serviços do atendimento (para o limite opcional por tipo de serviço). */
  serviceIds?: string[];
}

/** Profissional ativo, como o motor de agenda precisa. */
export interface SchedulingProfessional {
  id: string;
  serviceIds: string[];
  /** Pets ao mesmo tempo (padrão 1). */
  capacity?: number;
  /** Horário próprio. Vazio/ausente = segue o funcionamento da loja. */
  workHours?: ProfessionalWorkHours[];
  /** Folgas e indisponibilidades. */
  timeOff?: Pick<ProfessionalTimeOff, 'dateFrom' | 'dateTo' | 'startTime' | 'endTime'>[];
}

export type SchedulingSettings = Pick<
  BusinessSettings,
  'slotIntervalMinutes' | 'capacity' | 'minAdvanceMinutes' | 'maxAdvanceDays' | 'timezone'
> &
  Partial<Pick<BusinessSettings, 'slotCapacityLimit'>>;

export interface AvailabilityContext {
  businessHours: BusinessHours[];
  blockedDates: BlockedDate[];
  blockedTimes: BlockedTime[];
  appointments: OccupiedSlot[];
  settings: SchedulingSettings;
  now: Date;
  /**
   * Profissionais ATIVOS. Quando houver pelo menos um, a agenda passa a ser por profissional:
   * cada um atende 1 pet por vez e a capacidade total = número de profissionais.
   * Vazio/ausente = regra de vagas por horário (settings.capacity).
   */
  professionals?: SchedulingProfessional[];
  /** Limite opcional de atendimentos simultâneos por serviço (id → máximo). */
  serviceLimits?: Record<string, number>;
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
  | 'FULL'
  | 'SERVICE_FULL'
  | 'NO_PROFESSIONAL';

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
  SERVICE_FULL: 'Este serviço já está no limite de atendimentos simultâneos neste horário. Escolha outro horário.',
  NO_PROFESSIONAL: 'Nenhum profissional disponível realiza este serviço. Fale com a Karolla Pet.',
};

export interface SlotCheckOptions {
  /** Ignora um agendamento (o próprio, ao remarcar). */
  excludeAppointmentId?: string;
  /** Aplica antecedência mínima / máxima e bloqueio de passado (site público). Padrão: true. */
  enforceBookingWindow?: boolean;
  /** Aplica funcionamento, intervalo e bloqueios. Padrão: true. */
  enforceBusinessRules?: boolean;
  /** Serviços do atendimento (define quais profissionais podem atender). */
  serviceIds?: string[];
  /** Profissional escolhido. Ausente/null = qualquer profissional habilitado. */
  professionalId?: string | null;
}

/** Em agenda por profissional, `professionalId` é o profissional livre escolhido para o horário. */
export type SlotCheckResult = { ok: true; professionalId?: string } | { ok: false; reason: SlotUnavailableReason };

/** Profissionais habilitados para TODOS os serviços informados. */
export function qualifiedProfessionals<T extends SchedulingProfessional>(professionals: T[], serviceIds: string[] = []): T[] {
  return professionals.filter((p) => p.serviceIds.length === 0 || serviceIds.every((id) => p.serviceIds.includes(id)));
}

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

  // Limite opcional por tipo de serviço (ex.: uma única mesa de tosa)
  for (const serviceId of options.serviceIds ?? []) {
    const limit = ctx.serviceLimits?.[serviceId];
    if (!limit) continue;
    const same = ctx.appointments.filter((a) => a.serviceIds?.includes(serviceId));
    if (maxConcurrentInInterval(same, date, start, end, options.excludeAppointmentId) >= limit) return { ok: false, reason: 'SERVICE_FULL' };
  }

  const pros = ctx.professionals ?? [];
  if (pros.length > 0) return checkProfessionals(ctx, pros, date, start, end, options);

  const concurrent = maxConcurrentInInterval(ctx.appointments, date, start, end, options.excludeAppointmentId);
  if (concurrent >= capacityAt(ctx, date, start, end)) return { ok: false, reason: 'FULL' };

  return { ok: true };
}

/** O profissional trabalha no intervalo inteiro (horário próprio, intervalo e folgas)? */
export function professionalAvailable(p: SchedulingProfessional, date: string, start: number, end: number): boolean {
  const off = (p.timeOff ?? []).some((t) => {
    if (date < t.dateFrom || date > t.dateTo) return false;
    if (!t.startTime || !t.endTime) return true; // dia inteiro
    return overlaps(start, end, timeToMinutes(t.startTime), timeToMinutes(t.endTime));
  });
  if (off) return false;
  const hours = p.workHours ?? [];
  if (hours.length === 0) return true; // segue o funcionamento da loja (já conferido)
  const day = hours.find((h) => h.weekday === weekdayOf(date));
  if (!day) return false; // dia de folga
  if (start < timeToMinutes(day.startTime) || end > timeToMinutes(day.endTime)) return false;
  if (day.breakStart && day.breakEnd && overlaps(start, end, timeToMinutes(day.breakStart), timeToMinutes(day.breakEnd))) return false;
  return true;
}

/**
 * Pets atendidos ao mesmo tempo no intervalo: soma da capacidade dos profissionais ATIVOS e DISPONÍVEIS
 * naquele horário (agenda por profissional) ou "vagas por horário"; nos dois casos respeita o limite
 * geral opcional.
 */
export function capacityAt(ctx: Pick<AvailabilityContext, 'professionals' | 'settings'>, date: string, start: number, end: number): number {
  const pros = ctx.professionals ?? [];
  const base =
    pros.length > 0
      ? pros.filter((p) => professionalAvailable(p, date, start, end)).reduce((sum, p) => sum + Math.max(1, p.capacity ?? 1), 0)
      : Math.max(1, ctx.settings.capacity);
  const limit = ctx.settings.slotCapacityLimit;
  return limit && limit > 0 ? Math.min(base, limit) : base;
}

/**
 * Agenda por profissional: precisa existir um profissional habilitado e livre no intervalo inteiro,
 * e o total de atendimentos simultâneos (incluindo antigos sem profissional) não pode passar
 * do número de profissionais. Escolhe o profissional livre com menos minutos agendados no dia.
 */
function checkProfessionals(
  ctx: AvailabilityContext,
  pros: SchedulingProfessional[],
  date: string,
  start: number,
  end: number,
  options: SlotCheckOptions,
): SlotCheckResult {
  const qualified = qualifiedProfessionals(pros, options.serviceIds);
  const chosenOnly = options.professionalId ? qualified.filter((p) => p.id === options.professionalId) : qualified;
  if (chosenOnly.length === 0) return { ok: false, reason: 'NO_PROFESSIONAL' };
  // Só quem trabalha naquele horário (folga, horário próprio e intervalo do profissional)
  const candidates = chosenOnly.filter((p) => professionalAvailable(p, date, start, end));
  if (candidates.length === 0) return { ok: false, reason: 'FULL' };

  const exclude = options.excludeAppointmentId;
  const free = candidates.filter(
    (p) => maxConcurrentInInterval(ctx.appointments.filter((a) => a.professionalId === p.id), date, start, end, exclude) < Math.max(1, p.capacity ?? 1),
  );
  if (free.length === 0) return { ok: false, reason: 'FULL' };
  if (maxConcurrentInInterval(ctx.appointments, date, start, end, exclude) >= capacityAt(ctx, date, start, end)) return { ok: false, reason: 'FULL' };

  const busyMinutes = (id: string) =>
    ctx.appointments
      .filter((a) => a.date === date && a.professionalId === id && isBlockingStatus(a.status) && (exclude == null || a.id !== exclude))
      .reduce((sum, a) => sum + a.durationMinutes, 0);
  const chosen = [...free].sort((a, b) => busyMinutes(a.id) - busyMinutes(b.id))[0]!;
  return { ok: true, professionalId: chosen.id };
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
  options: Pick<SlotCheckOptions, 'serviceIds' | 'professionalId'> = {},
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
    const result = checkSlot(ctx, date, time, durationMinutes, options);
    // Horários que caem no intervalo nem aparecem; os demais aparecem como ocupados/indisponíveis.
    if (!result.ok && result.reason === 'BREAK') continue;
    slots.push({ time, available: result.ok });
  }
  const anyAvailable = slots.some((s) => s.available);
  return { date, closedReason: anyAvailable || slots.length ? null : 'OUTSIDE_HOURS', slots };
}

/**
 * Limite de atendimentos simultâneos para a trava atômica do banco. Com data/horário, considera só os
 * profissionais disponíveis naquele intervalo; sem, o total (compatível com chamadas antigas).
 */
export function effectiveCapacity(
  ctx: Pick<AvailabilityContext, 'professionals' | 'settings'>,
  at?: { date: string; time: string; durationMinutes: number },
): number {
  if (at) {
    const start = timeToMinutes(at.time);
    return capacityAt(ctx, at.date, start, start + at.durationMinutes);
  }
  const pros = ctx.professionals ?? [];
  const base = pros.length > 0 ? pros.reduce((sum, p) => sum + Math.max(1, p.capacity ?? 1), 0) : Math.max(1, ctx.settings.capacity);
  const limit = ctx.settings.slotCapacityLimit;
  return limit && limit > 0 ? Math.min(base, limit) : base;
}
