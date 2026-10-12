import { describe, expect, it } from 'vitest';
import type { MemoryDatabase } from '../src/repositories/memory/MemoryDatabase';
import { setup, TOMORROW } from './helpers';

const manual = (over: Record<string, unknown> = {}) => ({
  newCustomer: { name: 'Rita Balcão', whatsapp: '(11) 93333-2222', email: '' },
  newPet: { name: 'Faísca', speciesId: 'dog', breedId: 'dog-shih-tzu', breedName: 'x', sizeId: 'pequeno' },
  serviceIds: ['banho'],
  addonIds: [],
  date: TOMORROW,
  time: '10:00',
  origin: 'phone',
  ...over,
});

describe('Agendamento manual pelo painel', () => {
  it('cria tutor e pet, grava origem e quem criou, usando a mesma agenda do site', async () => {
    const { api, login } = await setup();
    const admin = await login();
    const settings = (await api.get('/api/admin/settings').set('Authorization', admin)).body;
    await api.put('/api/admin/settings').set('Authorization', admin).send({ ...settings, capacity: 1 }).expect(200);
    const res = await api.post('/api/admin/appointments').set('Authorization', admin).send(manual()).expect(201);
    expect(res.body).toMatchObject({ source: 'admin', origin: 'phone', createdByName: 'Carol (demo)', status: 'confirmed', pet: { name: 'Faísca', breedName: 'Shih Tzu' } });
    expect(res.body.totalCents).toBeGreaterThan(0);
    // mesmo WhatsApp reaproveita o cadastro
    const again = await api.post('/api/admin/appointments').set('Authorization', admin).send(manual({ time: '16:30', newPet: null, petId: res.body.petId })).expect(201);
    expect(again.body.customerId).toBe(res.body.customerId);
    // horário ocupado (capacidade 1) é recusado com mensagem clara
    const conflict = await api.post('/api/admin/appointments').set('Authorization', admin).send(manual({ newPet: null, petId: res.body.petId })).expect(409);
    expect(conflict.body.error.code).toBe('SLOT_UNAVAILABLE');
    // o horário também deixa de aparecer no site
    const slots = await api.get('/api/public/availability').query({ date: TOMORROW, serviceIds: 'banho', sizeId: 'pequeno' }).expect(200);
    expect(slots.body.slots.find((s: { time: string }) => s.time === '10:00').available).toBe(false);
  });

  it('pet de outro tutor é recusado e quem não pode criar recebe 403', async () => {
    const { api, login } = await setup();
    const admin = await login();
    const customers = (await api.get('/api/admin/customers').set('Authorization', admin)).body;
    const pets = (await api.get('/api/admin/pets').set('Authorization', admin)).body;
    const joao = customers.find((c: { name: string }) => c.name.startsWith('João'));
    const mel = pets.find((p: { name: string }) => p.name === 'Mel');
    await api.post('/api/admin/appointments').set('Authorization', admin).send(manual({ newCustomer: null, customerId: joao.id, newPet: null, petId: mel.id })).expect(404);
    await api.post('/api/admin/team').set('Authorization', admin).send({ name: 'Pro', email: 'pro@karollapet.test', password: 'Equipe2026', role: 'professional' }).expect(201);
    const pro = await api.post('/api/auth/login').send({ email: 'pro@karollapet.test', password: 'Equipe2026' });
    await api.post('/api/admin/appointments').set('Authorization', `Bearer ${pro.body.token}`).send(manual()).expect(403);
  });
});

describe('Fluxo de status e aviso de retirada', () => {
  it('Aguardando → Em atendimento → Finalizado → Pronto → Entregue; aviso abre WhatsApp com a mensagem de retirada', async () => {
    const { api, login } = await setup();
    const admin = await login();
    const created = (await api.post('/api/admin/appointments').set('Authorization', admin).send(manual()).expect(201)).body;
    for (const status of ['waiting', 'in_progress', 'completed', 'ready']) {
      await api.patch(`/api/admin/appointments/${created.id}/status`).set('Authorization', admin).send({ status }).expect(200);
    }
    const notify = await api.post(`/api/admin/appointments/${created.id}/notify-pickup`).set('Authorization', admin).expect(201);
    expect(notify.body.contact).toMatchObject({ kind: 'pickup', appointmentId: created.id, status: 'opened' });
    expect(notify.body.contact.message).toContain('Faísca');
    expect(notify.body.contact.message).toContain('Rita');
    expect(notify.body.whatsappLink).toMatch(/^https:\/\/wa\.me\/5511933332222\?text=/);
    await api.patch(`/api/admin/appointments/${created.id}/status`).set('Authorization', admin).send({ status: 'delivered' }).expect(200);
    const crm = await api.get('/api/admin/crm').set('Authorization', admin).query({ search: 'Rita' }).expect(200);
    expect(crm.body.customers[0].visits).toBe(1); // "Entregue" conta como visita
  });

  it('antes da atualização do banco, os status novos avisam em vez de quebrar', async () => {
    const { api, login, container } = await setup();
    const admin = await login();
    (container.db as MemoryDatabase).schemaLevel = 9;
    const list = (await api.get('/api/admin/appointments').set('Authorization', admin)).body;
    const res = await api.patch(`/api/admin/appointments/${list[0].id}/status`).set('Authorization', admin).send({ status: 'ready' }).expect(409);
    expect(res.body.error.code).toBe('SETUP_PENDING');
    await api.patch(`/api/admin/appointments/${list[0].id}/status`).set('Authorization', admin).send({ status: 'confirmed' }).expect(200);
    await api.get('/api/admin/plans').set('Authorization', admin).expect(503);
  });
});

describe('Agenda por profissional', () => {
  it('horário próprio, folga e capacidade definem os horários oferecidos', async () => {
    const { api, login } = await setup();
    const admin = await login();
    // 2026-10-08 = quinta (4). Bia só trabalha à tarde.
    const bia = (await api
      .post('/api/admin/professionals')
      .set('Authorization', admin)
      .send({ name: 'Bia', workHours: [{ weekday: 4, startTime: '13:00', endTime: '18:00' }] })
      .expect(201)).body;
    const slots = async () => (await api.get('/api/public/availability').query({ date: TOMORROW, serviceIds: 'banho', sizeId: 'pequeno', professionalId: bia.id }).expect(200)).body.slots;
    const at = (list: { time: string; available: boolean }[], t: string) => list.find((s) => s.time === t)?.available;
    let list = await slots();
    expect(at(list, '09:00')).toBe(false);
    expect(at(list, '16:00')).toBe(true);

    const off = await api.post('/api/admin/professional-time-off').set('Authorization', admin).send({ professionalId: bia.id, dateFrom: TOMORROW, dateTo: TOMORROW, startTime: '16:00', endTime: '17:00', reason: 'Consulta' }).expect(201);
    list = await slots();
    expect(at(list, '16:00')).toBe(false);
    expect(at(list, '17:00')).toBe(true);
    await api.delete(`/api/admin/professional-time-off/${off.body.id}`).set('Authorization', admin).expect(204);
    expect(at(await slots(), '16:00')).toBe(true);

    // desativada: some dos horários, histórico continua
    await api.patch(`/api/admin/professionals/${bia.id}`).set('Authorization', admin).send({ active: false }).expect(200);
    const all = (await api.get('/api/public/availability').query({ date: TOMORROW, serviceIds: 'banho', sizeId: 'pequeno' }).expect(200)).body;
    expect(all.professionals.map((p: { id: string }) => p.id)).not.toContain(bia.id);
  });

  it('limite por tipo de serviço', async () => {
    const { api, login } = await setup();
    const admin = await login();
    const settings = (await api.get('/api/admin/settings').set('Authorization', admin)).body;
    await api.put('/api/admin/settings').set('Authorization', admin).send({ ...settings, capacity: 3 }).expect(200);
    await api.patch('/api/admin/services/tosa').set('Authorization', admin).send({ maxConcurrent: 1 }).expect(200);
    await api.post('/api/admin/appointments').set('Authorization', admin).send(manual({ serviceIds: ['tosa'] })).expect(201);
    const second = await api
      .post('/api/admin/appointments')
      .set('Authorization', admin)
      .send(manual({ serviceIds: ['tosa'], newCustomer: { name: 'Outro', whatsapp: '(11) 93333-1111', email: '' } }))
      .expect(409);
    expect(second.body.error.message).toMatch(/limite/);
    await api.post('/api/admin/appointments').set('Authorization', admin).send(manual({ serviceIds: ['banho'], newCustomer: { name: 'Outro', whatsapp: '(11) 93333-1111', email: '' } })).expect(201);
  });
});

describe('Planos e mensalidades (sem pagamento online)', () => {
  async function withPlan() {
    const ctx = await setup();
    const admin = await ctx.login();
    const plan = (await ctx.api.post('/api/admin/plans').set('Authorization', admin).send({ name: '4 banhos', priceCents: 16000, serviceIds: ['banho'], usesPerPeriod: 2 }).expect(201)).body;
    const appt = (await ctx.api.post('/api/admin/appointments').set('Authorization', admin).send(manual()).expect(201)).body;
    const sub = (await ctx.api.post('/api/admin/customer-plans').set('Authorization', admin).send({ customerId: appt.customerId, planId: plan.id, startDate: '2026-10-01' }).expect(201)).body;
    return { ...ctx, admin, plan, appt, sub };
  }

  it('contratado fica pendente; só fica ativo quando alguém registra o pagamento', async () => {
    const { api, admin, appt, sub } = await withPlan();
    expect(sub).toMatchObject({ status: 'pending', effectiveStatus: 'pending', nextDueDate: '2026-10-01', priceCents: 16000 });
    const denied = await api.post(`/api/admin/appointments/${appt.id}/plan-usages`).set('Authorization', admin).send({ customerPlanId: sub.id, serviceId: 'banho' }).expect(409);
    expect(denied.body.error.code).toBe('PLAN_NOT_ACTIVE');
    await api.patch(`/api/admin/customer-plans/${sub.id}`).set('Authorization', admin).send({ status: 'active' }).expect(409);

    const paid = (await api.post(`/api/admin/customer-plans/${sub.id}/payments`).set('Authorization', admin).send({ amountCents: 16000, paidAt: '2026-10-01', method: 'pix' }).expect(201)).body;
    expect(paid).toMatchObject({ status: 'active', effectiveStatus: 'active', nextDueDate: '2026-11-01', periodStart: '2026-10-01', usesLeft: 2 });
    expect(paid.payments[0]).toMatchObject({ amountCents: 16000, periodFrom: '2026-10-01', periodTo: '2026-11-01', recordedByName: 'Carol (demo)' });
    expect(paid.events.map((e: { kind: string }) => e.kind)).toEqual(['payment', 'created']);
  });

  it('uso no atendimento: serviço incluído, sem repetir, respeitando o limite do período; dá para desfazer', async () => {
    const { api, admin, appt, sub } = await withPlan();
    await api.post(`/api/admin/customer-plans/${sub.id}/payments`).set('Authorization', admin).send({ amountCents: 16000, paidAt: '2026-10-01', method: 'cash' }).expect(201);
    const used = await api.post(`/api/admin/appointments/${appt.id}/plan-usages`).set('Authorization', admin).send({ customerPlanId: sub.id, serviceId: 'banho' }).expect(201);
    expect(used.body.usages).toHaveLength(1);
    const dup = await api.post(`/api/admin/appointments/${appt.id}/plan-usages`).set('Authorization', admin).send({ customerPlanId: sub.id, serviceId: 'banho' }).expect(409);
    expect(dup.body.error.code).toBe('DUPLICATED');
    await api.post(`/api/admin/appointments/${appt.id}/plan-usages`).set('Authorization', admin).send({ customerPlanId: sub.id, serviceId: 'tosa' }).expect(400);
    expect((await api.get(`/api/admin/customer-plans/${sub.id}`).set('Authorization', admin)).body.usesLeft).toBe(1);

    const appt2 = (await api.post('/api/admin/appointments').set('Authorization', admin).send(manual({ time: '14:00', newPet: null, petId: appt.petId })).expect(201)).body;
    await api.post(`/api/admin/appointments/${appt2.id}/plan-usages`).set('Authorization', admin).send({ customerPlanId: sub.id, serviceId: 'banho' }).expect(201);
    const appt3 = (await api.post('/api/admin/appointments').set('Authorization', admin).send(manual({ time: '16:00', newPet: null, petId: appt.petId })).expect(201)).body;
    const none = await api.post(`/api/admin/appointments/${appt3.id}/plan-usages`).set('Authorization', admin).send({ customerPlanId: sub.id, serviceId: 'banho' }).expect(409);
    expect(none.body.error.code).toBe('NO_USES_LEFT');

    await api.delete(`/api/admin/plan-usages/${used.body.usages[0].id}`).set('Authorization', admin).expect(200);
    expect((await api.get(`/api/admin/customer-plans/${sub.id}`).set('Authorization', admin)).body.usesLeft).toBe(1);
  });

  it('vencido é calculado; quem não tem "Planos → Confirmar" não registra pagamento; valores somem sem "finance.view"', async () => {
    const { api, admin, sub } = await withPlan();
    await api.patch(`/api/admin/customer-plans/${sub.id}`).set('Authorization', admin).send({ nextDueDate: '2026-10-05' }).expect(200);
    await api.post(`/api/admin/customer-plans/${sub.id}/payments`).set('Authorization', admin).send({ amountCents: 16000, paidAt: '2026-09-05', method: 'pix' }).expect(201);
    // período 05/10 → 05/11 pago; agora volta o vencimento para antes de hoje (07/10) para simular atraso
    await api.patch(`/api/admin/customer-plans/${sub.id}`).set('Authorization', admin).send({ nextDueDate: '2026-10-06' }).expect(200);
    const overdue = (await api.get('/api/admin/customer-plans').set('Authorization', admin).query({ status: 'overdue' }).expect(200)).body;
    expect(overdue.map((s: { id: string }) => s.id)).toContain(sub.id);

    await api.post('/api/admin/team').set('Authorization', admin).send({ name: 'Ger', email: 'ger@karollapet.test', password: 'Equipe2026', role: 'manager' }).expect(201);
    const ger = `Bearer ${(await api.post('/api/auth/login').send({ email: 'ger@karollapet.test', password: 'Equipe2026' })).body.token}`;
    const list = await api.get('/api/admin/customer-plans').set('Authorization', ger).expect(200);
    expect(JSON.stringify(list.body)).not.toMatch(/priceCents|amountCents/);
    await api.post(`/api/admin/customer-plans/${sub.id}/payments`).set('Authorization', ger).send({ amountCents: 1, paidAt: '2026-10-07', method: 'pix' }).expect(403);
  });

  it('o cliente vê o próprio plano na conta (sem histórico interno)', async () => {
    const { api, admin, sub, appt } = await withPlan();
    await api.post(`/api/admin/customer-plans/${sub.id}/payments`).set('Authorization', admin).send({ amountCents: 16000, paidAt: '2026-10-01', method: 'pix' }).expect(201);
    const customer = (await api.get(`/api/admin/customers/${appt.customerId}`).set('Authorization', admin)).body;
    await api.patch(`/api/admin/customers/${appt.customerId}`).set('Authorization', admin).send({ email: 'rita@exemplo.com' }).expect(200);
    const signup = await api.post('/api/account/signup').send({ name: customer.name, email: 'rita@exemplo.com', whatsapp: '(11) 95555-7878', password: 'Cliente2026', acceptPrivacy: true }).expect(201);
    const plans = await api.get('/api/account/me/plans').set('Authorization', `Bearer ${signup.body.session.token}`).expect(200);
    expect(plans.body).toHaveLength(1);
    expect(plans.body[0]).toMatchObject({ effectiveStatus: 'active', usesLeft: 2, plan: { name: '4 banhos' } });
    expect(plans.body[0]).not.toHaveProperty('events');
    expect(plans.body[0]).not.toHaveProperty('notes');
  });
});
