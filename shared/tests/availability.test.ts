import { describe, expect, it } from 'vitest';
import { checkSlot, getDayAvailability, type AvailabilityContext } from '../src';
import { businessHours } from './fixtures';

// 2026-10-07 (quarta) 10:00 em São Paulo = 13:00 UTC
const NOW = new Date('2026-10-07T13:00:00Z');

function ctx(overrides: Partial<AvailabilityContext> = {}): AvailabilityContext {
  return {
    businessHours,
    blockedDates: [],
    blockedTimes: [],
    appointments: [],
    settings: { slotIntervalMinutes: 30, capacity: 1, minAdvanceMinutes: 60, maxAdvanceDays: 60, timezone: 'America/Sao_Paulo' },
    now: NOW,
    ...overrides,
  };
}

describe('checkSlot', () => {
  it('aceita horário livre em dia útil', () => {
    expect(checkSlot(ctx(), '2026-10-08', '09:00', 60)).toEqual({ ok: true });
  });
  it('rejeita data passada', () => {
    expect(checkSlot(ctx(), '2026-10-06', '09:00', 60)).toEqual({ ok: false, reason: 'PAST' });
    expect(checkSlot(ctx(), '2026-10-07', '09:30', 60)).toEqual({ ok: false, reason: 'PAST' });
  });
  it('respeita antecedência mínima', () => {
    expect(checkSlot(ctx(), '2026-10-07', '10:30', 30)).toEqual({ ok: false, reason: 'TOO_SOON' });
    expect(checkSlot(ctx(), '2026-10-07', '11:00', 60)).toEqual({ ok: true });
  });
  it('respeita limite de dias à frente', () => {
    expect(checkSlot(ctx(), '2026-12-31', '09:00', 60)).toEqual({ ok: false, reason: 'TOO_FAR' });
  });
  it('rejeita domingo (fechado)', () => {
    expect(checkSlot(ctx(), '2026-10-11', '09:00', 60)).toEqual({ ok: false, reason: 'CLOSED_DAY' });
  });
  it('rejeita atendimento que ultrapassa o fechamento', () => {
    expect(checkSlot(ctx(), '2026-10-08', '17:30', 60)).toEqual({ ok: false, reason: 'OUTSIDE_HOURS' });
  });
  it('rejeita atendimento que invade o intervalo', () => {
    expect(checkSlot(ctx(), '2026-10-08', '11:30', 60)).toEqual({ ok: false, reason: 'BREAK' });
  });
  it('rejeita data e horário bloqueados', () => {
    expect(checkSlot(ctx({ blockedDates: [{ id: 'b', date: '2026-10-08', reason: '' }] }), '2026-10-08', '09:00', 60)).toEqual({ ok: false, reason: 'BLOCKED_DATE' });
    const bt = [{ id: 'bt', date: '2026-10-08', startTime: '14:00', endTime: '15:00', reason: '' }];
    expect(checkSlot(ctx({ blockedTimes: bt }), '2026-10-08', '13:30', 60)).toEqual({ ok: false, reason: 'BLOCKED_TIME' });
    expect(checkSlot(ctx({ blockedTimes: bt }), '2026-10-08', '15:00', 60)).toEqual({ ok: true });
  });
  it('não permite conflito com horário ocupado (capacidade 1)', () => {
    const appointments = [{ id: 'a1', date: '2026-10-08', time: '09:00', durationMinutes: 90, status: 'confirmed' as const }];
    expect(checkSlot(ctx({ appointments }), '2026-10-08', '10:00', 60)).toEqual({ ok: false, reason: 'FULL' });
    expect(checkSlot(ctx({ appointments }), '2026-10-08', '10:30', 60)).toEqual({ ok: true });
    // o próprio agendamento é ignorado ao remarcar
    expect(checkSlot(ctx({ appointments }), '2026-10-08', '09:30', 60, { excludeAppointmentId: 'a1' })).toEqual({ ok: true });
  });
  it('cancelados liberam o horário', () => {
    const appointments = [{ date: '2026-10-08', time: '09:00', durationMinutes: 60, status: 'cancelled' as const }];
    expect(checkSlot(ctx({ appointments }), '2026-10-08', '09:00', 60)).toEqual({ ok: true });
  });
  it('respeita capacidade de atendimentos simultâneos', () => {
    const appointments = [
      { date: '2026-10-08', time: '09:00', durationMinutes: 60, status: 'pending' as const },
      { date: '2026-10-08', time: '10:00', durationMinutes: 60, status: 'pending' as const },
    ];
    const c = ctx({ appointments, settings: { ...ctx().settings, capacity: 2 } });
    // os dois existentes não se sobrepõem entre si: um novo das 09:30 às 10:30 encontra no máximo 1 simultâneo
    expect(checkSlot(c, '2026-10-08', '09:30', 60)).toEqual({ ok: true });
    const full = [...appointments, { date: '2026-10-08', time: '09:30', durationMinutes: 60, status: 'pending' as const }];
    expect(checkSlot({ ...c, appointments: full }, '2026-10-08', '09:45', 30)).toEqual({ ok: false, reason: 'FULL' });
  });
});

describe('getDayAvailability', () => {
  it('lista horários, oculta o intervalo e marca ocupados', () => {
    const appointments = [{ date: '2026-10-08', time: '09:00', durationMinutes: 60, status: 'confirmed' as const }];
    const day = getDayAvailability(ctx({ appointments }), '2026-10-08', 60);
    const times = day.slots.map((s) => s.time);
    expect(times[0]).toBe('08:00');
    expect(times).not.toContain('11:30');
    expect(times).not.toContain('12:00');
    expect(times).toContain('13:00');
    expect(times.at(-1)).toBe('17:00');
    expect(day.slots.find((s) => s.time === '09:00')?.available).toBe(false);
    expect(day.slots.find((s) => s.time === '08:30')?.available).toBe(false);
    expect(day.slots.find((s) => s.time === '10:00')?.available).toBe(true);
  });
  it('informa dia fechado', () => {
    expect(getDayAvailability(ctx(), '2026-10-11', 60).closedReason).toBe('CLOSED_DAY');
    expect(getDayAvailability(ctx(), '2026-10-01', 60).closedReason).toBe('PAST');
  });
});
