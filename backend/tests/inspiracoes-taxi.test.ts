import { describe, expect, it } from 'vitest';
import { bookingPayload, setup, TOMORROW } from './helpers';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

async function customerToken(api: Awaited<ReturnType<typeof setup>>['api'], email = 'fa@exemplo.com', whatsapp = '(11) 95555-6060') {
  const res = await api.post('/api/account/signup').send({ name: 'Fabiana Souza', email, whatsapp, password: 'Cliente2026', acceptPrivacy: true }).expect(201);
  return `Bearer ${res.body.session.token as string}`;
}

describe('Comentários nas inspirações', () => {
  it('só cliente com conta comenta; texto simples, sem links, com limites; a equipe remove', async () => {
    const { api, login, container } = await setup();
    const insp = (await api.get('/api/public/inspirations').expect(200)).body[0];
    await api.post(`/api/account/me/inspirations/${insp.id}/comments`).send({ body: 'Lindo!' }).expect(401);

    const token = await customerToken(api);
    const created = await api.post(`/api/account/me/inspirations/${insp.id}/comments`).set('Authorization', token).send({ body: '<b>Amei</b> esse corte!' }).expect(201);
    expect(created.body).toMatchObject({ authorName: 'Fabiana', body: 'Amei esse corte!' }); // HTML removido
    const list = await api.get(`/api/public/inspirations/${insp.id}/comments`).expect(200);
    expect(list.body.map((c: { body: string }) => c.body)).toEqual(['Amei esse corte!']);
    expect(list.body[0]).not.toHaveProperty('customerId');

    await api.post(`/api/account/me/inspirations/${insp.id}/comments`).set('Authorization', token).send({ body: 'veja www.promo.com' }).expect(400);
    await api.post(`/api/account/me/inspirations/${insp.id}/comments`).set('Authorization', token).send({ body: 'Mais um!' }).expect(429);

    const admin = await login();
    const all = await api.get('/api/admin/comments').set('Authorization', admin).expect(200);
    expect(all.body[0]).toMatchObject({ inspirationTitle: insp.title, customerName: 'Fabiana Souza', status: 'visible' });
    await api.delete(`/api/admin/comments/${all.body[0].id}`).set('Authorization', admin).expect(204);
    expect((await api.get(`/api/public/inspirations/${insp.id}/comments`)).body).toEqual([]);
    expect(await container.db.customers.findByWhatsapp('11955556060')).not.toBeNull();
  });

  it('etiquetas de porte e tipo de tosa aparecem no catálogo público', async () => {
    const { api, login } = await setup();
    const admin = await login();
    const list = (await api.get('/api/admin/inspirations').set('Authorization', admin)).body;
    await api.patch(`/api/admin/inspirations/${list[0].id}`).set('Authorization', admin).send({ sizeId: 'pequeno', groomingType: 'bebe' }).expect(200);
    const pub = (await api.get('/api/public/inspirations')).body.find((i: { id: string }) => i.id === list[0].id);
    expect(pub).toMatchObject({ sizeId: 'pequeno', groomingType: 'bebe' });
  });
});

describe('Sugestão de tosa no agendamento', () => {
  it('foto de referência privada e preferência ficam ligadas ao agendamento e ao pet', async () => {
    const { api, login } = await setup();
    const ticket = (await api.post('/api/public/grooming-reference/upload-ticket').send({ contentType: 'image/png', size: PNG.length }).expect(200)).body;
    expect(ticket.path).toMatch(/^agendamentos\/referencias\//);
    await api.put(ticket.uploadUrl).set('Content-Type', 'image/png').send(PNG).expect(204);
    await api
      .post('/api/public/appointments')
      .send(bookingPayload({ serviceIds: ['banho-tosa'], groomingReference: { path: 'agendamentos/referencias/inventado.png', description: '' } }))
      .expect(400);
    const res = await api
      .post('/api/public/appointments')
      .send(bookingPayload({ serviceIds: ['banho-tosa'], groomingNotes: 'Orelhas redondas', groomingReference: { path: ticket.path, description: 'Igual à foto' } }))
      .expect(201);
    expect(res.body.appointment.customerNotes).toContain('Tosa: Orelhas redondas');
    expect(res.body.appointment.customerNotes).toContain('foto de referência enviada');

    const admin = await login();
    const pet = (await api.get(`/api/admin/pets/${res.body.pet.id}`).set('Authorization', admin).expect(200)).body;
    expect(pet.references).toHaveLength(1);
    expect(pet.references[0]).toMatchObject({ description: 'Igual à foto', appointmentId: res.body.appointment.id });
    expect(pet.references[0].url).toMatch(/^\/api\/private-files\//);
  });
});

describe('Taxi Dog', () => {
  async function withTaxi() {
    const ctx = await setup();
    const admin = await ctx.login();
    // amanhã (2026-10-08) é quinta-feira (4)
    await ctx.api.put('/api/admin/taxi/settings').set('Authorization', admin).send({ taxiEnabled: true, taxiWindows: [{ weekday: 4, startTime: '07:00', endTime: '19:00' }] }).expect(200);
    const region = (await ctx.api.post('/api/admin/taxi/regions').set('Authorization', admin).send({ name: 'Zona Norte', neighborhoods: ['Vila Nova'], feeOneWayCents: 1500, feeRoundTripCents: 2500 }).expect(201)).body;
    const driver = (await ctx.api.post('/api/admin/taxi/drivers').set('Authorization', admin).send({ name: 'Seu Zé' }).expect(201)).body;
    return { ...ctx, admin, region, driver };
  }
  const quote = (over: Record<string, string> = {}) => ({ date: TOMORROW, time: '09:00', serviceIds: 'banho', sizeId: 'grande', neighborhood: 'vila nova', direction: 'both', ...over });

  it('cotação só aparece com região, horário e motorista disponíveis', async () => {
    const { api } = await withTaxi();
    const ok = (await api.get('/api/public/taxi/quote').query(quote()).expect(200)).body;
    expect(ok).toMatchObject({ available: true, regionName: 'Zona Norte', feeCents: 2500, pickupTime: '08:30' });
    expect((await api.get('/api/public/taxi/quote').query(quote({ neighborhood: 'Jardins' }))).body).toMatchObject({ available: false, reason: 'NO_REGION' });
    const catalog = (await api.get('/api/public/catalog')).body;
    expect(catalog.features.taxi).toBe(true);
  });

  it('agendamento com Taxi Dog cria o transporte; lotado é recusado; confirmar exige motorista livre', async () => {
    const { api, admin, driver } = await withTaxi();
    const res = await api.post('/api/public/appointments').send(bookingPayload({ taxi: { direction: 'both', notes: 'Portão azul' } })).expect(201);
    expect(res.body.taxi).toMatchObject({ direction: 'both', pickupTime: '08:30', status: 'requested', feeCents: 2500 });

    // o mesmo bloco de horário já ocupa o único motorista
    const full = await api
      .post('/api/public/appointments')
      .send(bookingPayload({ tutor: { ...bookingPayload().tutor, whatsapp: '(11) 95555-1111' }, pet: { ...bookingPayload().pet, name: 'Rex' }, taxi: { direction: 'pickup' } }))
      .expect(409);
    expect(full.body.error.code).toBe('TAXI_UNAVAILABLE');
    // outro bairro: não atende
    const far = await api
      .post('/api/public/appointments')
      .send(bookingPayload({ time: '14:00', tutor: { ...bookingPayload().tutor, whatsapp: '(11) 95555-2222', address: { ...bookingPayload().tutor.address, neighborhood: 'Jardins' } }, taxi: { direction: 'pickup' } }))
      .expect(409);
    expect(far.body.error.message).toMatch(/bairro/);

    const transports = (await api.get('/api/admin/taxi/transports').set('Authorization', admin).query({ date: TOMORROW }).expect(200)).body;
    expect(transports).toHaveLength(1);
    expect(transports[0]).toMatchObject({ petName: 'Bob', customerName: 'Carlos Pereira', address: expect.stringContaining('Vila Nova'), notes: 'Portão azul', status: 'requested' });
    const id = transports[0].id;
    await api.patch(`/api/admin/taxi/transports/${id}`).set('Authorization', admin).send({ status: 'confirmed' }).expect(409);

    // motorista de folga não pode assumir
    const block = await api.post('/api/admin/taxi/blocks').set('Authorization', admin).send({ driverId: driver.id, dateFrom: TOMORROW, dateTo: TOMORROW }).expect(201);
    const off = await api.patch(`/api/admin/taxi/transports/${id}`).set('Authorization', admin).send({ driverId: driver.id, status: 'confirmed' }).expect(409);
    expect(off.body.error.code).toBe('DRIVER_UNAVAILABLE');
    await api.delete(`/api/admin/taxi/blocks/${block.body.id}`).set('Authorization', admin).expect(204);

    const confirmed = await api.patch(`/api/admin/taxi/transports/${id}`).set('Authorization', admin).send({ driverId: driver.id, status: 'confirmed' }).expect(200);
    expect(confirmed.body).toMatchObject({ status: 'confirmed', driverName: 'Seu Zé' });
    await api.patch(`/api/admin/taxi/transports/${id}`).set('Authorization', admin).send({ status: 'picked_up' }).expect(200);
    // status do atendimento continua independente
    const appt = (await api.get(`/api/admin/appointments/${res.body.appointment.id}`).set('Authorization', admin)).body;
    expect(appt.status).toBe('pending');
  });

  it('gerente opera o Taxi Dog sem ver taxas (permissão financeira)', async () => {
    const { api, admin } = await withTaxi();
    await api.post('/api/public/appointments').send(bookingPayload({ taxi: { direction: 'pickup' } })).expect(201);
    await api.post('/api/admin/team').set('Authorization', admin).send({ name: 'Ger', email: 'ger2@karollapet.test', password: 'Equipe2026', role: 'manager' }).expect(201);
    const token = `Bearer ${(await api.post('/api/auth/login').send({ email: 'ger2@karollapet.test', password: 'Equipe2026' })).body.token}`;
    const overview = (await api.get('/api/admin/taxi').set('Authorization', token).expect(200)).body;
    expect(overview.regions[0].name).toBe('Zona Norte');
    expect(overview.regions[0]).not.toHaveProperty('feeOneWayCents');
    expect(overview.regions[0]).not.toHaveProperty('feeRoundTripCents');
    const transports = (await api.get('/api/admin/taxi/transports').set('Authorization', token).query({ date: TOMORROW }).expect(200)).body;
    expect(transports[0]).not.toHaveProperty('feeCents');
  });

  it('sem permissão de Taxi Dog não vê os transportes', async () => {
    const { api, admin } = await withTaxi();
    await api.post('/api/admin/team').set('Authorization', admin).send({ name: 'Pro', email: 'pro2@karollapet.test', password: 'Equipe2026', role: 'professional' }).expect(201);
    const pro = (await api.post('/api/auth/login').send({ email: 'pro2@karollapet.test', password: 'Equipe2026' })).body.token;
    await api.get('/api/admin/taxi/transports').set('Authorization', `Bearer ${pro}`).expect(403);
  });
});
