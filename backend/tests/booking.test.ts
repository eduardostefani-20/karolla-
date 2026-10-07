import { describe, expect, it, vi } from 'vitest';
import { bookingPayload, setup, TOMORROW } from './helpers';
import { InfrastructureError } from '../src/utils/errors';

describe('Agendamento público', () => {
  it('expõe catálogo ativo e modo demo', async () => {
    const { api } = await setup();
    const res = await api.get('/api/public/catalog').expect(200);
    expect(res.body.mode).toBe('demo');
    expect(res.body.species.map((s: { name: string }) => s.name)).toEqual(['Cachorro', 'Gato']);
    expect(res.body.breeds.length).toBeGreaterThan(25);
    expect(res.body.settings.whatsappNumber).toBe('5511900000000');
    // nenhuma informação sensível no catálogo público
    expect(JSON.stringify(res.body)).not.toMatch(/password|secret|service_role/i);
  });

  it('cria agendamento completo com preço calculado no servidor', async () => {
    const { api, container } = await setup();
    const res = await api.post('/api/public/appointments').send(bookingPayload()).expect(201);
    const a = res.body.appointment;
    // Banho + Tosa grande (16500) + hidratação (2000) + unhas (1000) — valores DEMO
    expect(a.totalCents).toBe(19500);
    expect(a.durationMinutes).toBe(135 + 15);
    expect(a.status).toBe('pending');
    expect(a.services[0].name).toBe('Banho + Tosa');
    expect(res.body.whatsappLink).toMatch(/^https:\/\/wa\.me\/5511900000000\?text=/);
    expect(decodeURIComponent(res.body.whatsappLink)).toContain('NOVO AGENDAMENTO — KAROLLA PET');

    const stored = await container.db.appointments.findById(a.id);
    expect(stored?.totalCents).toBe(19500);
    const customer = await container.db.customers.findByWhatsapp('11955554444');
    expect(customer?.name).toBe('Carlos Pereira');
    const logs = await container.db.integrationLogs.list({ appointmentId: a.id });
    expect(logs.map((l) => `${l.integration}:${l.status}`)).toEqual(['whatsapp:link_generated', 'google_sheets:skipped']);
  });

  it('ignora o preço enviado pelo navegador e avisa quando mudou', async () => {
    const { api } = await setup();
    const res = await api.post('/api/public/appointments').send(bookingPayload({ expectedTotalCents: 100 })).expect(409);
    expect(res.body.error.code).toBe('PRICE_CHANGED');
  });

  it('rejeita formulário incompleto com mensagens por campo', async () => {
    const { api } = await setup();
    const payload = bookingPayload();
    const res = await api
      .post('/api/public/appointments')
      .send({ ...payload, pet: { ...payload.pet, name: '' }, tutor: { ...payload.tutor, name: 'Carlos' } })
      .expect(400);
    expect(res.body.error.fields['pet.name']).toBeDefined();
    expect(res.body.error.fields['tutor.name']).toBe('Informe nome e sobrenome.');
  });

  it('rejeita telefone inválido', async () => {
    const { api } = await setup();
    const payload = bookingPayload();
    const res = await api.post('/api/public/appointments').send({ ...payload, tutor: { ...payload.tutor, whatsapp: '1234' } }).expect(400);
    expect(res.body.error.fields['tutor.whatsapp']).toMatch(/WhatsApp válido/);
  });

  it('rejeita e-mail inválido', async () => {
    const { api } = await setup();
    const payload = bookingPayload();
    const res = await api.post('/api/public/appointments').send({ ...payload, tutor: { ...payload.tutor, email: 'carlos@' } }).expect(400);
    expect(res.body.error.fields['tutor.email']).toMatch(/e-mail válido/);
  });

  it('exige campos configurados como obrigatórios no editor do formulário', async () => {
    const { api } = await setup();
    const payload = bookingPayload();
    const res = await api.post('/api/public/appointments').send({ ...payload, tutor: { ...payload.tutor, email: '' } }).expect(400);
    expect(res.body.error.fields['tutor.email']).toBe('Informe o e-mail.');
  });

  it('rejeita data passada', async () => {
    const { api } = await setup();
    const res = await api.post('/api/public/appointments').send(bookingPayload({ date: '2026-10-01' })).expect(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
    expect(res.body.error.message).toMatch(/já passou/);
  });

  it('rejeita domingo (fechado) e horário fora do funcionamento', async () => {
    const { api } = await setup();
    await api.post('/api/public/appointments').send(bookingPayload({ date: '2026-10-11' })).expect(409);
    const res = await api.post('/api/public/appointments').send(bookingPayload({ time: '17:00' })).expect(409);
    expect(res.body.error.message).toMatch(/horário de funcionamento/);
  });

  it('não permite agendamento em horário ocupado', async () => {
    const { api, container } = await setup();
    await container.db.settings.update({ capacity: 1 });
    await api.post('/api/public/appointments').send(bookingPayload()).expect(201);
    const payload = bookingPayload({ time: '10:00' });
    const res = await api
      .post('/api/public/appointments')
      .send({ ...payload, tutor: { ...(payload.tutor as object), whatsapp: '(11) 94444-3333' } })
      .expect(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
  });

  it('garante exclusividade mesmo com requisições simultâneas', async () => {
    const { api, container } = await setup();
    await container.db.settings.update({ capacity: 1 });
    const results = await Promise.all(
      ['(11) 91111-1111', '(11) 92222-2222', '(11) 93333-3333'].map((whatsapp) => {
        const p = bookingPayload();
        return api.post('/api/public/appointments').send({ ...p, tutor: { ...p.tutor, whatsapp } });
      }),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
  });

  it('rejeita serviço desativado', async () => {
    const { api, container } = await setup();
    await container.db.services.update('banho-tosa', { active: false });
    const res = await api.post('/api/public/appointments').send(bookingPayload()).expect(409);
    expect(res.body.error.code).toBe('SERVICE_INACTIVE');
  });

  it('rejeita adicional desativado', async () => {
    const { api, container } = await setup();
    await container.db.addons.update('hidratacao', { active: false });
    const res = await api.post('/api/public/appointments').send(bookingPayload()).expect(409);
    expect(res.body.error.code).toBe('ADDON_INACTIVE');
  });

  it('aceita raça digitada manualmente ("Outra raça")', async () => {
    const { api } = await setup();
    const payload = bookingPayload();
    const res = await api
      .post('/api/public/appointments')
      .send({ ...payload, pet: { ...payload.pet, breedId: null, breedName: 'Vira-lata caramelo' } })
      .expect(201);
    expect(res.body.pet.breedName).toBe('Vira-lata caramelo');
    expect(res.body.pet.breedId).toBeNull();
  });

  it('reaproveita cliente e pet já cadastrados', async () => {
    const { api, container } = await setup();
    await api.post('/api/public/appointments').send(bookingPayload()).expect(201);
    await api.post('/api/public/appointments').send(bookingPayload({ date: '2026-10-09' })).expect(201);
    const customer = await container.db.customers.findByWhatsapp('11955554444');
    expect(await container.db.pets.list({ customerId: customer!.id })).toHaveLength(1);
  });

  it('erro de banco retorna mensagem amigável (sem detalhes técnicos)', async () => {
    const { api, container } = await setup();
    vi.spyOn(container.db.appointments, 'create').mockRejectedValueOnce(new InfrastructureError('connection refused at 10.0.0.1'));
    const res = await api.post('/api/public/appointments').send(bookingPayload()).expect(500);
    expect(res.body.error.message).toBe('Não foi possível concluir agora. Tente novamente em instantes.');
    expect(JSON.stringify(res.body)).not.toMatch(/10\.0\.0\.1|stack|undefined/);
  });

  it('falha no WhatsApp NÃO apaga o agendamento', async () => {
    const whatsapp = {
      provider: 'cloud_api' as const,
      configured: true,
      notifyNewAppointment: vi.fn().mockRejectedValue(new Error('Meta API fora do ar')),
    };
    const { api, container } = await setup({ whatsapp });
    const res = await api.post('/api/public/appointments').send(bookingPayload()).expect(201);
    expect(await container.db.appointments.findById(res.body.appointment.id)).not.toBeNull();
    expect(res.body.whatsappLink).toBe('https://wa.me/5511900000000');
    const logs = await container.db.integrationLogs.list({ appointmentId: res.body.appointment.id });
    expect(logs.find((l) => l.integration === 'whatsapp')?.status).toBe('failed');
  });

  it('falha no Google Sheets NÃO apaga o agendamento', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('erro', { status: 500 }));
    const { WebhookGoogleSheetsService } = await import('../src/integrations/sheets/providers');
    const sheets = new WebhookGoogleSheetsService({ url: 'https://script.google.com/x', timeoutMs: 1000 }, fetchMock as unknown as typeof fetch);
    const { api, container, login } = await setup({ sheets });
    const res = await api.post('/api/public/appointments').send(bookingPayload()).expect(201);
    expect(fetchMock).toHaveBeenCalledOnce();
    const token = await login();
    const detail = await api.get(`/api/admin/appointments/${res.body.appointment.id}`).set('Authorization', token).expect(200);
    expect(detail.body.integrationLogs.find((l: { integration: string }) => l.integration === 'google_sheets').status).toBe('failed');
    expect(await container.db.appointments.findById(res.body.appointment.id)).not.toBeNull();
  });

  it('envia a linha correta para o Google Sheets', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const { WebhookGoogleSheetsService } = await import('../src/integrations/sheets/providers');
    const sheets = new WebhookGoogleSheetsService({ url: 'https://script.google.com/x', secret: 's3', timeoutMs: 1000 }, fetchMock as unknown as typeof fetch);
    const { api } = await setup({ sheets });
    await api.post('/api/public/appointments').send(bookingPayload()).expect(201);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.secret).toBe('s3');
    expect(body.row).toMatchObject({
      Cliente: 'Carlos Pereira',
      WhatsApp: '(11) 95555-4444',
      Pet: 'Bob',
      Espécie: 'Cachorro',
      Porte: 'Grande',
      Serviço: 'Banho + Tosa',
      Adicionais: 'Hidratação, Corte de unhas',
      'Data do agendamento': '08/10/2026',
      Horário: '09:00',
      Valor: 'R$ 195,00',
      Status: 'Pendente',
    });
  });
});

describe('Disponibilidade', () => {
  it('retorna horários considerando duração e ocupação', async () => {
    const { api } = await setup();
    const res = await api
      .get('/api/public/availability')
      .query({ date: TOMORROW, serviceIds: 'banho', sizeId: 'pequeno', addonIds: '' })
      .expect(200);
    expect(res.body.durationMinutes).toBe(60);
    expect(res.body.slots[0]).toEqual({ time: '08:00', available: true });
    expect(res.body.slots.map((s: { time: string }) => s.time)).not.toContain('12:00');
  });

  it('informa dia fechado', async () => {
    const { api } = await setup();
    const res = await api.get('/api/public/availability').query({ date: '2026-10-11', serviceIds: 'banho', sizeId: 'pequeno' }).expect(200);
    expect(res.body.closedMessage).toBe('A Karolla Pet não abre neste dia.');
  });

  it('valida parâmetros', async () => {
    const { api } = await setup();
    await api.get('/api/public/availability').query({ date: 'ontem', serviceIds: '', sizeId: 'x' }).expect(400);
  });
});
