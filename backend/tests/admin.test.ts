import { describe, expect, it } from 'vitest';
import { MockAuthService } from '../src/integrations/auth/MockAuthService';
import { loadEnv, ConfigError } from '../src/config/env';
import { ADMIN, bookingPayload, setup, TOMORROW } from './helpers';

describe('Autenticação e proteção', () => {
  it('login inválido retorna mensagem genérica', async () => {
    const { api } = await setup();
    const res = await api.post('/api/auth/login').send({ email: ADMIN.email, password: 'errada' }).expect(401);
    expect(res.body.error.message).toBe('E-mail ou senha incorretos.');
    await api.post('/api/auth/login').send({ email: 'nao-e-email', password: 'x' }).expect(400);
  });

  it('login válido retorna token e dados do usuário', async () => {
    const { api } = await setup();
    const res = await api.post('/api/auth/login').send(ADMIN).expect(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('owner');
    const me = await api.get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`).expect(200);
    expect(me.body.user.email).toBe(ADMIN.email);
  });

  it.each([
    '/api/admin/dashboard',
    '/api/admin/appointments',
    '/api/admin/customers',
    '/api/admin/pets',
    '/api/admin/catalog',
    '/api/admin/schedule',
    '/api/admin/settings',
  ])('acesso direto sem login é bloqueado: %s', async (path) => {
    const { api } = await setup();
    await api.get(path).expect(401);
    await api.get(path).set('Authorization', 'Bearer token-falso').expect(401);
  });

  it('token adulterado é rejeitado', async () => {
    const { api, login } = await setup();
    const token = await login();
    const [body, sig] = token.slice(7).split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'x', email: 'x', name: 'x', role: 'owner', exp: 9999999999 })).toString('base64url');
    expect(body).toBeTruthy();
    await api.get('/api/admin/dashboard').set('Authorization', `Bearer ${forged}.${sig}`).expect(401);
  });

  it('perfil "staff" opera a agenda mas não altera configurações', async () => {
    const auth = new MockAuthService({ email: 'equipe@karollapet.test', password: 'equipe-123', secret: 's', ttlHours: 1, role: 'staff' });
    const { api } = await setup({ auth });
    const res = await api.post('/api/auth/login').send({ email: 'equipe@karollapet.test', password: 'equipe-123' }).expect(200);
    const token = `Bearer ${res.body.token}`;
    await api.get('/api/admin/appointments').set('Authorization', token).expect(200);
    const denied = await api.post('/api/admin/services').set('Authorization', token).send({ name: 'X', category: 'Y', durationMinutes: 30 }).expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
  });

  it('produção não aceita banco em memória nem auth mock', () => {
    expect(() => loadEnv({ APP_MODE: 'production', DATABASE_PROVIDER: 'memory' })).toThrow(ConfigError);
    expect(() => loadEnv({ APP_MODE: 'production', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_ANON_KEY: 'a', AUTH_PROVIDER: 'mock' })).toThrow(ConfigError);
    expect(() => loadEnv({ APP_MODE: 'production' })).toThrow(/SUPABASE_URL/);
  });
});

describe('Painel administrativo', () => {
  it('dashboard mostra contadores e agenda do dia', async () => {
    const { api, login } = await setup();
    const token = await login();
    const res = await api.get('/api/admin/dashboard').set('Authorization', token).expect(200);
    expect(res.body.today).toBe('2026-10-07');
    expect(res.body.stats.appointmentsToday).toBe(3);
    expect(res.body.todayAgenda.map((a: { pet: { name: string } }) => a.pet.name)).toEqual(['Thor', 'Mel', 'Luna']);
    expect(res.body.stats.customers).toBe(3);
    expect(res.body.stats.pets).toBe(4);
  });

  it('fluxo: visualizar, editar, remarcar e alterar status de um agendamento', async () => {
    const { api, login } = await setup();
    const token = await login();
    const created = await api.post('/api/public/appointments').send(bookingPayload()).expect(201);
    const id = created.body.appointment.id;

    const list = await api.get('/api/admin/appointments').query({ from: TOMORROW, to: TOMORROW, search: 'bob' }).set('Authorization', token).expect(200);
    expect(list.body).toHaveLength(1);

    const detail = await api.get(`/api/admin/appointments/${id}`).set('Authorization', token).expect(200);
    expect(detail.body.customer.name).toBe('Carlos Pereira');

    const edited = await api
      .patch(`/api/admin/appointments/${id}`)
      .set('Authorization', token)
      .send({ time: '13:00', serviceIds: ['banho'], addonIds: [], notes: 'Cliente pediu laço azul' })
      .expect(200);
    expect(edited.body.time).toBe('13:00');
    expect(edited.body.totalCents).toBe(9000);
    expect(edited.body.notes).toBe('Cliente pediu laço azul');
    expect(edited.body.updatedAt >= detail.body.updatedAt).toBe(true);

    const status = await api.patch(`/api/admin/appointments/${id}/status`).set('Authorization', token).send({ status: 'confirmed' }).expect(200);
    expect(status.body.status).toBe('confirmed');

    await api.patch(`/api/admin/appointments/${id}`).set('Authorization', token).send({ time: '12:00' }).expect(409);
    await api.patch(`/api/admin/appointments/${id}/status`).set('Authorization', token).send({ status: 'invalido' }).expect(400);
  });

  it('não permite remarcar para horário em conflito', async () => {
    const { api, login, container } = await setup();
    await container.db.settings.update({ capacity: 1 });
    const token = await login();
    const a = await api.post('/api/public/appointments').send(bookingPayload()).expect(201);
    const p = bookingPayload({ time: '15:30' });
    const b = await api.post('/api/public/appointments').send({ ...p, tutor: { ...(p.tutor as object), whatsapp: '(11) 94444-3333' } }).expect(201);
    const res = await api.patch(`/api/admin/appointments/${b.body.appointment.id}`).set('Authorization', token).send({ time: '09:30' }).expect(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
    // cancelar libera o horário
    await api.patch(`/api/admin/appointments/${a.body.appointment.id}/status`).set('Authorization', token).send({ status: 'cancelled' }).expect(200);
    await api.patch(`/api/admin/appointments/${b.body.appointment.id}`).set('Authorization', token).send({ time: '09:30' }).expect(200);
  });

  it('edita dados do tutor e do pet', async () => {
    const { api, login } = await setup();
    const token = await login();
    const created = await api.post('/api/public/appointments').send(bookingPayload()).expect(201);
    const { customerId, petId } = created.body.appointment;
    const c = await api.patch(`/api/admin/customers/${customerId}`).set('Authorization', token).send({ name: 'Carlos P. Pereira', whatsapp: '(11) 95555-0000' }).expect(200);
    expect(c.body.whatsapp).toBe('11955550000');
    await api.patch(`/api/admin/customers/${customerId}`).set('Authorization', token).send({ whatsapp: '(11) 98888-7777' }).expect(409);
    const pet = await api.patch(`/api/admin/pets/${petId}`).set('Authorization', token).send({ weightKg: 31.5, breedId: 'dog-golden-retriever' }).expect(200);
    expect(pet.body.breedName).toBe('Golden Retriever');
    expect(pet.body.appointments).toHaveLength(1);
    const customers = await api.get('/api/admin/customers').set('Authorization', token).expect(200);
    expect(customers.body.find((x: { id: string }) => x.id === customerId).petCount).toBe(1);
  });

  it('edição de preço reflete no site e no cálculo do agendamento', async () => {
    const { api, login } = await setup();
    const token = await login();
    await api
      .put('/api/admin/prices')
      .set('Authorization', token)
      .send({ prices: [{ serviceId: 'banho-tosa', sizeId: 'grande', priceCents: 20000, durationMinutes: null }] })
      .expect(200);
    const catalog = await api.get('/api/public/catalog').expect(200);
    const price = catalog.body.servicePrices.find((p: { serviceId: string; sizeId: string }) => p.serviceId === 'banho-tosa' && p.sizeId === 'grande');
    expect(price.priceCents).toBe(20000);
    const res = await api.post('/api/public/appointments').send(bookingPayload()).expect(201);
    expect(res.body.appointment.totalCents).toBe(20000 + 2000 + 1000);
    expect(res.body.appointment.durationMinutes).toBe(120 + 15);
    await api.put('/api/admin/prices').set('Authorization', token).send({ prices: [{ serviceId: 'banho', sizeId: 'mini', priceCents: -5 }] }).expect(400);
  });

  it('cria, edita, desativa e exclui serviço', async () => {
    const { api, login } = await setup();
    const token = await login();
    const created = await api
      .post('/api/admin/services')
      .set('Authorization', token)
      .send({ name: 'Banho Terapêutico', description: 'Com ozônio', category: 'Banho', durationMinutes: 70 })
      .expect(201);
    const id = created.body.id;
    expect(created.body.sortOrder).toBe(8);
    await api.patch(`/api/admin/services/${id}`).set('Authorization', token).send({ name: 'Banho de Ozônio' }).expect(200);
    await api.put('/api/admin/prices').set('Authorization', token).send({ prices: [{ serviceId: id, sizeId: 'medio', priceCents: 9900 }] }).expect(200);

    let catalog = await api.get('/api/public/catalog').expect(200);
    expect(catalog.body.services.find((s: { id: string }) => s.id === id).name).toBe('Banho de Ozônio');

    await api.patch(`/api/admin/services/${id}`).set('Authorization', token).send({ active: false }).expect(200);
    catalog = await api.get('/api/public/catalog').expect(200);
    expect(catalog.body.services.find((s: { id: string }) => s.id === id)).toBeUndefined();

    await api.delete(`/api/admin/services/${id}`).set('Authorization', token).expect(204);
    // serviço com histórico não pode ser excluído
    const inUse = await api.delete('/api/admin/services/banho').set('Authorization', token).expect(409);
    expect(inUse.body.error.message).toMatch(/Desative/);
    await api.post('/api/admin/services').set('Authorization', token).send({ name: '', category: '', durationMinutes: 1 }).expect(400);
  });

  it('gerencia adicionais e editor do formulário', async () => {
    const { api, login } = await setup();
    const token = await login();
    const addon = await api.post('/api/admin/addons').set('Authorization', token).send({ name: 'Ozônio', priceCents: 1500, durationMinutes: 10 }).expect(201);
    await api.patch(`/api/admin/addons/${addon.body.id}`).set('Authorization', token).send({ priceCents: 1800 }).expect(200);
    await api.patch('/api/admin/addons/perfume').set('Authorization', token).send({ active: false }).expect(200);
    await api.delete(`/api/admin/addons/${addon.body.id}`).set('Authorization', token).expect(204);

    const fields = await api
      .put('/api/admin/form-fields')
      .set('Authorization', token)
      .send({ fields: [{ key: 'tutor.email', label: 'Seu e-mail', helpText: '', enabled: true, required: false }, { key: 'pet.weight', label: 'Peso', helpText: '', enabled: true, required: true }] })
      .expect(200);
    expect(fields.body.find((f: { key: string }) => f.key === 'tutor.email').required).toBe(false);

    const catalog = await api.get('/api/public/catalog').expect(200);
    expect(catalog.body.addons.find((a: { id: string }) => a.id === 'perfume')).toBeUndefined();
    expect(catalog.body.formFields.find((f: { key: string }) => f.key === 'tutor.email').label).toBe('Seu e-mail');

    // e-mail agora opcional; peso obrigatório
    const p = bookingPayload();
    await api.post('/api/public/appointments').send({ ...p, tutor: { ...p.tutor, email: '' } }).expect(201);
    const res = await api.post('/api/public/appointments').send({ ...p, date: '2026-10-09', pet: { ...p.pet, weightKg: null } }).expect(400);
    expect(res.body.error.fields['pet.weightKg']).toBeDefined();
  });

  it('gerencia raças, portes e espécies', async () => {
    const { api, login } = await setup();
    const token = await login();
    const breed = await api.post('/api/admin/breeds').set('Authorization', token).send({ speciesId: 'dog', name: 'Basset Hound', defaultSizeId: 'medio' }).expect(201);
    await api.delete(`/api/admin/breeds/${breed.body.id}`).set('Authorization', token).expect(204);
    await api.delete('/api/admin/breeds/dog-golden-retriever').set('Authorization', token).expect(409);
    const size = await api.post('/api/admin/sizes').set('Authorization', token).send({ name: 'Extra', minWeightKg: 60, maxWeightKg: 90 }).expect(201);
    await api.post('/api/admin/sizes').set('Authorization', token).send({ name: 'Errado', minWeightKg: 50, maxWeightKg: 10 }).expect(400);
    await api.delete(`/api/admin/sizes/${size.body.id}`).set('Authorization', token).expect(204);
    await api.delete('/api/admin/species/dog').set('Authorization', token).expect(409);
    const sp = await api.post('/api/admin/species').set('Authorization', token).send({ name: 'Coelho', emoji: '🐰' }).expect(201);
    expect(sp.body.sortOrder).toBe(3);
  });

  it('configura horários e bloqueios que afetam a disponibilidade', async () => {
    const { api, login } = await setup();
    const token = await login();
    const days = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      isOpen: weekday === 4,
      openTime: '10:00',
      closeTime: '16:00',
      breakStart: null,
      breakEnd: null,
    }));
    await api.put('/api/admin/business-hours').set('Authorization', token).send({ days }).expect(200);
    const avail = await api.get('/api/public/availability').query({ date: TOMORROW, serviceIds: 'banho', sizeId: 'mini' }).expect(200);
    expect(avail.body.slots[0].time).toBe('10:00');

    await api.post('/api/admin/blocked-times').set('Authorization', token).send({ date: TOMORROW, startTime: '10:00', endTime: '12:00', reason: 'Reunião' }).expect(201);
    const avail2 = await api.get('/api/public/availability').query({ date: TOMORROW, serviceIds: 'banho', sizeId: 'mini' }).expect(200);
    expect(avail2.body.slots.find((s: { time: string }) => s.time === '10:30').available).toBe(false);

    const blocked = await api.post('/api/admin/blocked-dates').set('Authorization', token).send({ date: TOMORROW, reason: 'Feriado' }).expect(201);
    const catalog = await api.get('/api/public/catalog').expect(200);
    expect(catalog.body.closedDates).toContain(TOMORROW);
    await api.post('/api/public/appointments').send(bookingPayload({ time: '13:00' })).expect(409);
    await api.delete(`/api/admin/blocked-dates/${blocked.body.id}`).set('Authorization', token).expect(204);

    await api.put('/api/admin/business-hours').set('Authorization', token).send({ days: days.slice(0, 3) }).expect(400);
  });

  it('atualiza configurações (número do WhatsApp em um único lugar)', async () => {
    const { api, login } = await setup();
    const token = await login();
    const current = await api.get('/api/admin/settings').set('Authorization', token).expect(200);
    await api.put('/api/admin/settings').set('Authorization', token).send({ ...current.body, whatsappNumber: '55 (11) 97777-1111' }).expect(200);
    const res = await api.post('/api/public/appointments').send(bookingPayload()).expect(201);
    expect(res.body.whatsappLink).toMatch(/^https:\/\/wa\.me\/5511977771111/);
    await api.put('/api/admin/settings').set('Authorization', token).send({ ...current.body, whatsappNumber: '123' }).expect(400);
  });

  it('status do sistema deixa claro o que é DEMO e o que está conectado', async () => {
    const { api, login } = await setup();
    const token = await login();
    const res = await api.get('/api/admin/system-status').set('Authorization', token).expect(200);
    expect(res.body).toEqual({
      mode: 'demo',
      database: { provider: 'memory', connected: true },
      auth: { provider: 'mock' },
      whatsapp: { provider: 'link', configured: true },
      googleSheets: { provider: 'disabled', configured: false },
    });
  });

  it('rota inexistente e JSON inválido retornam erro amigável', async () => {
    const { api } = await setup();
    const r1 = await api.get('/api/nao-existe').expect(404);
    expect(r1.body.error.message).toBe('Recurso não encontrado.');
    const r2 = await api.post('/api/public/appointments').set('Content-Type', 'application/json').send('{"x":').expect(400);
    expect(r2.body.error.code).toBe('INVALID_JSON');
  });
});
