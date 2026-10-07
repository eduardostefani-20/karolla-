import type { Addon, BusinessHours, PetSize, Service, ServicePrice } from '../src';

export const sizes: PetSize[] = [
  { id: 'mini', name: 'Mini', description: '', minWeightKg: 0, maxWeightKg: 4, active: true, sortOrder: 1 },
  { id: 'medio', name: 'Médio', description: '', minWeightKg: 10, maxWeightKg: 25, active: true, sortOrder: 3 },
  { id: 'gigante', name: 'Gigante', description: '', minWeightKg: 45, maxWeightKg: null, active: false, sortOrder: 5 },
];

export const services: Service[] = [
  { id: 'banho', name: 'Banho', description: '', category: 'Banho', durationMinutes: 60, active: true, sortOrder: 1, speciesIds: [] },
  { id: 'tosa', name: 'Tosa', description: '', category: 'Tosa', durationMinutes: 90, active: true, sortOrder: 2, speciesIds: ['dog'] },
  { id: 'antigo', name: 'Antigo', description: '', category: 'Banho', durationMinutes: 30, active: false, sortOrder: 3, speciesIds: [] },
];

export const servicePrices: ServicePrice[] = [
  { id: 'p1', serviceId: 'banho', sizeId: 'mini', priceCents: 5000, durationMinutes: null },
  { id: 'p2', serviceId: 'banho', sizeId: 'medio', priceCents: 7000, durationMinutes: 75 },
  { id: 'p3', serviceId: 'tosa', sizeId: 'medio', priceCents: 9000, durationMinutes: null },
  { id: 'p4', serviceId: 'antigo', sizeId: 'medio', priceCents: 1000, durationMinutes: null },
  { id: 'p5', serviceId: 'banho', sizeId: 'gigante', priceCents: 15000, durationMinutes: null },
];

export const addons: Addon[] = [
  { id: 'hidratacao', name: 'Hidratação', description: '', priceCents: 2000, durationMinutes: 15, active: true, sortOrder: 1 },
  { id: 'unhas', name: 'Corte de unhas', description: '', priceCents: 1000, durationMinutes: 0, active: true, sortOrder: 2 },
  { id: 'perfume', name: 'Perfume', description: '', priceCents: 500, durationMinutes: 0, active: false, sortOrder: 3 },
];

export const catalog = { sizes, services, servicePrices, addons };

/** Seg–Sex 08:00–18:00 com almoço 12:00–13:00; sábado 08:00–14:00; domingo fechado. */
export const businessHours: BusinessHours[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  id: `h${weekday}`,
  weekday,
  isOpen: weekday !== 0,
  openTime: '08:00',
  closeTime: weekday === 6 ? '14:00' : '18:00',
  breakStart: weekday === 6 ? null : '12:00',
  breakEnd: weekday === 6 ? null : '13:00',
}));
