import { describe, expect, it } from 'vitest';
import { checkTaxiLeg, driverCanTake, quoteTaxi, type TaxiContext } from '../src';

// 2026-10-08 = quinta (4)
const day = '2026-10-08';
const ctx = (over: Partial<TaxiContext> = {}): TaxiContext => ({
  settings: { taxiEnabled: true, taxiWindows: [{ weekday: 4, startTime: '08:00', endTime: '18:00' }], taxiPickupLeadMinutes: 30, taxiSlotMinutes: 30 },
  regions: [{ id: 'centro', name: 'Centro', neighborhoods: ['Centro', 'Vila Nova'], feeOneWayCents: 1500, feeRoundTripCents: 2500, active: true, sortOrder: 1 }],
  drivers: [{ id: 'joao', name: 'João', phone: '', active: true, capacity: 1, workHours: [], sortOrder: 1 }],
  blocks: [],
  transports: [],
  ...over,
});

describe('Taxi Dog', () => {
  it('cota ida e volta com horários e taxa da região (bairro sem acento/maiúscula)', () => {
    expect(quoteTaxi(ctx(), { date: day, time: '10:00', durationMinutes: 60, neighborhood: 'vila nóva', direction: 'both' })).toMatchObject({
      available: true,
      regionName: 'Centro',
      feeCents: 2500,
      pickupTime: '09:30',
      dropoffTime: '11:00',
    });
    expect(quoteTaxi(ctx(), { date: day, time: '10:00', durationMinutes: 60, neighborhood: 'Centro', direction: 'pickup' })).toMatchObject({ feeCents: 1500, dropoffTime: null });
  });

  it('só aparece quando disponível: região, dia/horário, bloqueio, motorista e capacidade', () => {
    const q = (c: TaxiContext, n = 'Centro', time = '10:00') => quoteTaxi(c, { date: day, time, durationMinutes: 60, neighborhood: n, direction: 'both' });
    expect(q(ctx({ settings: { ...ctx().settings, taxiEnabled: false } })).reason).toBe('DISABLED');
    expect(q(ctx(), 'Jardins').reason).toBe('NO_REGION');
    expect(q(ctx(), 'Centro', '17:45').reason).toBe('OUTSIDE_WINDOW'); // volta às 18:45
    expect(q(ctx({ blocks: [{ id: 'b', driverId: null, dateFrom: day, dateTo: day, startTime: null, endTime: null, reason: '', createdAt: '' }] })).reason).toBe('BLOCKED');
    expect(q(ctx({ drivers: [{ ...ctx().drivers[0]!, active: false }] })).reason).toBe('NO_DRIVER');
    const busy = [{ id: 't1', date: day, pickupTime: '09:40', dropoffTime: null, driverId: null, status: 'requested' as const }];
    expect(q(ctx({ transports: busy })).reason).toBe('FULL');
    expect(q(ctx({ transports: [{ ...busy[0]!, status: 'cancelled' }] })).available).toBe(true);
  });

  it('motorista de folga/ocupado não pode assumir; outro com capacidade pode', () => {
    const maria = { id: 'maria', name: 'Maria', phone: '', active: true, capacity: 2, workHours: [{ weekday: 4, startTime: '13:00', endTime: '18:00', breakStart: null, breakEnd: null }], sortOrder: 2 };
    const c = ctx({ drivers: [ctx().drivers[0]!, maria], transports: [{ id: 't1', date: day, pickupTime: '14:00', dropoffTime: null, driverId: 'joao', status: 'confirmed' }] });
    const t = { id: 't2', date: day, pickupTime: '14:10', dropoffTime: null };
    expect(driverCanTake(c, 'joao', t)).toBe(false); // já tem um pet no bloco
    expect(driverCanTake(c, 'maria', t)).toBe(true);
    expect(driverCanTake(c, 'maria', { ...t, pickupTime: '09:00' })).toBe(false); // fora do horário dela
    expect(checkTaxiLeg(c, day, 14 * 60 + 10)).toMatchObject({ ok: true, freeDrivers: ['maria'] });
  });
});
