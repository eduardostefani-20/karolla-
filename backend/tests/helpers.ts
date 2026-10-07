import request from 'supertest';
import { loadEnv } from '../src/config/env';
import { buildContainer, type ContainerOverrides } from '../src/container';
import { createApp } from '../src/app';

/** Quarta-feira, 07/10/2026, 10:00 em São Paulo. */
export const NOW = new Date('2026-10-07T13:00:00Z');
export const TOMORROW = '2026-10-08';

export const ADMIN = { email: 'carol@karollapet.test', password: 'senha-de-teste-123' };

export async function setup(overrides: ContainerOverrides = {}, envOverrides: Record<string, string> = {}) {
  const env = loadEnv({
    NODE_ENV: 'test',
    APP_MODE: 'demo',
    DEMO_ADMIN_EMAIL: ADMIN.email,
    DEMO_ADMIN_PASSWORD: ADMIN.password,
    AUTH_TOKEN_SECRET: 'test-secret',
    WHATSAPP_NUMBER: '5511900000000',
    ...envOverrides,
  });
  const container = await buildContainer(env, { clock: { now: () => NOW }, ...overrides });
  const app = createApp(container);
  const api = request(app);
  const login = async () => {
    const res = await api.post('/api/auth/login').send(ADMIN);
    return `Bearer ${res.body.token as string}`;
  };
  return { container, app, api, login };
}

export function bookingPayload(overrides: Record<string, unknown> = {}) {
  return {
    pet: {
      name: 'Bob',
      speciesId: 'dog',
      breedId: 'dog-labrador',
      breedName: 'Labrador',
      sizeId: 'grande',
      weightKg: 30,
      ageMonths: 24,
      notes: 'Muito brincalhão',
    },
    serviceIds: ['banho-tosa'],
    addonIds: ['hidratacao', 'corte-unhas'],
    date: TOMORROW,
    time: '09:00',
    tutor: {
      name: 'Carlos Pereira',
      whatsapp: '(11) 95555-4444',
      email: 'carlos@exemplo.com',
      address: { street: 'Rua Azul', number: '50', complement: '', neighborhood: 'Vila Nova', city: 'São Paulo' },
      notes: '',
    },
    ...overrides,
  };
}
