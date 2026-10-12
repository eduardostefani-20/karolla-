import type { BusinessSettings, TaxiBlock, TaxiDirection, TaxiDriver, TaxiRegion, TaxiTransport } from '../types/domain';
import { minutesToTime, timeToMinutes, weekdayOf } from '../utils/date';

/**
 * TAXI DOG — regras de disponibilidade compartilhadas (site e servidor).
 * Um trecho (buscar ou levar o pet) só é oferecido quando: o Taxi Dog está ligado, a região do
 * endereço é atendida, o horário cabe na janela do dia, não há bloqueio, existe motorista ativo
 * trabalhando naquele horário e ainda sobra capacidade no bloco de horário.
 */

export type TaxiUnavailableReason = 'DISABLED' | 'NO_REGION' | 'OUTSIDE_WINDOW' | 'BLOCKED' | 'NO_DRIVER' | 'FULL';

export const TAXI_REASON_MESSAGES: Record<TaxiUnavailableReason, string> = {
  DISABLED: 'O Taxi Dog não está disponível no momento.',
  NO_REGION: 'Ainda não atendemos este bairro com o Taxi Dog.',
  OUTSIDE_WINDOW: 'O Taxi Dog não funciona neste dia ou horário.',
  BLOCKED: 'O Taxi Dog não estará disponível nesta data.',
  NO_DRIVER: 'Não há motorista disponível neste horário.',
  FULL: 'O Taxi Dog já está lotado neste horário.',
};

export interface TaxiContext {
  settings: Pick<BusinessSettings, 'taxiEnabled' | 'taxiWindows' | 'taxiPickupLeadMinutes' | 'taxiSlotMinutes'>;
  regions: TaxiRegion[];
  drivers: TaxiDriver[];
  blocks: TaxiBlock[];
  /** Transportes já existentes (para capacidade). */
  transports: Pick<TaxiTransport, 'id' | 'date' | 'pickupTime' | 'dropoffTime' | 'driverId' | 'status'>[];
}

export const normalizePlace = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/** Região que atende o bairro (ativa). */
export function findTaxiRegion(regions: TaxiRegion[], neighborhood: string): TaxiRegion | null {
  const n = normalizePlace(neighborhood);
  const active = regions.filter((r) => r.active).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    active.find((r) => r.neighborhoods.some((x) => normalizePlace(x) === n && n !== '')) ??
    active.find((r) => r.neighborhoods.includes('*')) ??
    null
  );
}

function blocked(blocks: TaxiBlock[], driverId: string | null, date: string, minute: number): boolean {
  return blocks.some((b) => {
    if (b.driverId !== driverId) return false;
    if (date < b.dateFrom || date > b.dateTo) return false;
    if (!b.startTime || !b.endTime) return true;
    return minute >= timeToMinutes(b.startTime) && minute < timeToMinutes(b.endTime);
  });
}

function driverWorks(d: TaxiDriver, blocks: TaxiBlock[], date: string, minute: number): boolean {
  if (!d.active || blocked(blocks, d.id, date, minute)) return false;
  if (d.workHours.length === 0) return true;
  const day = d.workHours.find((h) => h.weekday === weekdayOf(date));
  if (!day) return false;
  if (minute < timeToMinutes(day.startTime) || minute >= timeToMinutes(day.endTime)) return false;
  if (day.breakStart && day.breakEnd && minute >= timeToMinutes(day.breakStart) && minute < timeToMinutes(day.breakEnd)) return false;
  return true;
}

/** Trechos (horários) já marcados no mesmo bloco de horário. */
function legsNear(ctx: TaxiContext, date: string, minute: number, exclude?: string, driverId?: string) {
  const slot = Math.max(10, ctx.settings.taxiSlotMinutes);
  let count = 0;
  for (const t of ctx.transports) {
    if (t.status === 'cancelled' || t.date !== date || (exclude && t.id === exclude)) continue;
    if (driverId !== undefined && t.driverId !== driverId) continue;
    for (const leg of [t.pickupTime, t.dropoffTime]) {
      if (leg && Math.abs(timeToMinutes(leg) - minute) < slot) count += 1;
    }
  }
  return count;
}

export type TaxiLegCheck = { ok: true; freeDrivers: string[] } | { ok: false; reason: TaxiUnavailableReason };

/** Um trecho em um horário: janela, bloqueios, motoristas e capacidade. */
export function checkTaxiLeg(ctx: TaxiContext, date: string, minute: number, exclude?: string): TaxiLegCheck {
  if (!ctx.settings.taxiEnabled) return { ok: false, reason: 'DISABLED' };
  const window = ctx.settings.taxiWindows.find((w) => w.weekday === weekdayOf(date));
  if (!window || minute < timeToMinutes(window.startTime) || minute > timeToMinutes(window.endTime)) return { ok: false, reason: 'OUTSIDE_WINDOW' };
  if (blocked(ctx.blocks, null, date, minute)) return { ok: false, reason: 'BLOCKED' };
  const working = ctx.drivers.filter((d) => driverWorks(d, ctx.blocks, date, minute));
  if (working.length === 0) return { ok: false, reason: 'NO_DRIVER' };
  const capacity = working.reduce((sum, d) => sum + Math.max(1, d.capacity), 0);
  if (legsNear(ctx, date, minute, exclude) >= capacity) return { ok: false, reason: 'FULL' };
  const freeDrivers = working.filter((d) => legsNear(ctx, date, minute, exclude, d.id) < Math.max(1, d.capacity)).map((d) => d.id);
  return { ok: true, freeDrivers };
}

export interface TaxiQuote {
  available: boolean;
  reason: TaxiUnavailableReason | null;
  message: string | null;
  regionId: string | null;
  regionName: string | null;
  feeCents: number;
  pickupTime: string | null;
  dropoffTime: string | null;
}

/** Cotação do Taxi Dog para um agendamento (data, início e duração). */
export function quoteTaxi(
  ctx: TaxiContext,
  input: { date: string; time: string; durationMinutes: number; neighborhood: string; direction: TaxiDirection },
): TaxiQuote {
  const fail = (reason: TaxiUnavailableReason, region: TaxiRegion | null = null): TaxiQuote => ({
    available: false,
    reason,
    message: TAXI_REASON_MESSAGES[reason],
    regionId: region?.id ?? null,
    regionName: region?.name ?? null,
    feeCents: 0,
    pickupTime: null,
    dropoffTime: null,
  });
  if (!ctx.settings.taxiEnabled) return fail('DISABLED');
  const region = findTaxiRegion(ctx.regions, input.neighborhood);
  if (!region) return fail('NO_REGION');
  const start = timeToMinutes(input.time);
  const pickup = input.direction !== 'dropoff' ? Math.max(0, start - Math.max(0, ctx.settings.taxiPickupLeadMinutes)) : null;
  const dropoff = input.direction !== 'pickup' ? start + input.durationMinutes : null;
  for (const leg of [pickup, dropoff]) {
    if (leg == null) continue;
    const check = checkTaxiLeg(ctx, input.date, leg);
    if (!check.ok) return fail(check.reason, region);
  }
  return {
    available: true,
    reason: null,
    message: null,
    regionId: region.id,
    regionName: region.name,
    feeCents: input.direction === 'both' ? region.feeRoundTripCents : region.feeOneWayCents,
    pickupTime: pickup == null ? null : minutesToTime(pickup),
    dropoffTime: dropoff == null ? null : minutesToTime(dropoff),
  };
}

/** O motorista pode assumir o transporte (trabalha nos horários e tem capacidade)? */
export function driverCanTake(ctx: TaxiContext, driverId: string, t: Pick<TaxiTransport, 'id' | 'date' | 'pickupTime' | 'dropoffTime'>): boolean {
  const driver = ctx.drivers.find((d) => d.id === driverId);
  if (!driver) return false;
  for (const leg of [t.pickupTime, t.dropoffTime]) {
    if (!leg) continue;
    const minute = timeToMinutes(leg);
    if (!driverWorks(driver, ctx.blocks, t.date, minute)) return false;
    if (legsNear(ctx, t.date, minute, t.id, driverId) >= Math.max(1, driver.capacity)) return false;
  }
  return true;
}
