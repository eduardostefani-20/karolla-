import { describe, expect, it } from 'vitest';
import { calculateAppointmentPrice, getStartingPrice, PricingError } from '../src';
import { catalog } from './fixtures';

describe('calculateAppointmentPrice', () => {
  it('calcula serviço por porte', () => {
    const r = calculateAppointmentPrice({ serviceIds: ['banho'], sizeId: 'mini', addonIds: [] }, catalog);
    expect(r.totalCents).toBe(5000);
    expect(r.totalDurationMinutes).toBe(60);
  });

  it('soma adicionais e usa duração específica do porte', () => {
    const r = calculateAppointmentPrice({ serviceIds: ['banho'], sizeId: 'medio', addonIds: ['hidratacao', 'unhas'] }, catalog);
    expect(r.servicesCents).toBe(7000);
    expect(r.addonsCents).toBe(3000);
    expect(r.totalCents).toBe(10000);
    expect(r.totalDurationMinutes).toBe(75 + 15);
    expect(r.lines.map((l) => l.name)).toEqual(['Banho', 'Hidratação', 'Corte de unhas']);
  });

  it('soma múltiplos serviços', () => {
    const r = calculateAppointmentPrice({ serviceIds: ['banho', 'tosa'], sizeId: 'medio', addonIds: [] }, catalog);
    expect(r.totalCents).toBe(16000);
  });

  const expectCode = (fn: () => unknown, code: string) => {
    try {
      fn();
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(PricingError);
      expect((e as PricingError).code).toBe(code);
    }
  };

  it('rejeita serviço desativado', () => {
    expectCode(() => calculateAppointmentPrice({ serviceIds: ['antigo'], sizeId: 'medio', addonIds: [] }, catalog), 'SERVICE_INACTIVE');
  });
  it('permite serviço desativado com allowInactive (painel)', () => {
    const r = calculateAppointmentPrice({ serviceIds: ['antigo'], sizeId: 'medio', addonIds: [] }, catalog, { allowInactive: true });
    expect(r.totalCents).toBe(1000);
  });
  it('rejeita adicional desativado', () => {
    expectCode(() => calculateAppointmentPrice({ serviceIds: ['banho'], sizeId: 'mini', addonIds: ['perfume'] }, catalog), 'ADDON_INACTIVE');
  });
  it('rejeita porte sem preço configurado', () => {
    expectCode(() => calculateAppointmentPrice({ serviceIds: ['tosa'], sizeId: 'mini', addonIds: [] }, catalog), 'PRICE_NOT_CONFIGURED');
  });
  it('rejeita porte desativado', () => {
    expectCode(() => calculateAppointmentPrice({ serviceIds: ['banho'], sizeId: 'gigante', addonIds: [] }, catalog), 'SIZE_INACTIVE');
  });
  it('rejeita serviço de outra espécie', () => {
    expectCode(
      () => calculateAppointmentPrice({ serviceIds: ['tosa'], sizeId: 'medio', addonIds: [], speciesId: 'cat' }, catalog),
      'SERVICE_NOT_AVAILABLE_FOR_SPECIES',
    );
  });
  it('rejeita itens inexistentes, vazios e duplicados', () => {
    expectCode(() => calculateAppointmentPrice({ serviceIds: [], sizeId: 'mini', addonIds: [] }, catalog), 'NO_SERVICE');
    expectCode(() => calculateAppointmentPrice({ serviceIds: ['x'], sizeId: 'mini', addonIds: [] }, catalog), 'SERVICE_NOT_FOUND');
    expectCode(() => calculateAppointmentPrice({ serviceIds: ['banho'], sizeId: 'mini', addonIds: ['x'] }, catalog), 'ADDON_NOT_FOUND');
    expectCode(() => calculateAppointmentPrice({ serviceIds: ['banho'], sizeId: 'mini', addonIds: ['unhas', 'unhas'] }, catalog), 'DUPLICATED_ITEM');
  });
  it('reflete alteração de preço imediatamente', () => {
    const edited = { ...catalog, servicePrices: catalog.servicePrices.map((p) => (p.id === 'p1' ? { ...p, priceCents: 5500 } : p)) };
    expect(calculateAppointmentPrice({ serviceIds: ['banho'], sizeId: 'mini', addonIds: [] }, edited).totalCents).toBe(5500);
  });
  it('preço "a partir de" ignora portes inativos', () => {
    expect(getStartingPrice('banho', catalog)).toBe(5000);
    expect(getStartingPrice('inexistente', catalog)).toBeNull();
  });
});
