import { describe, expect, it } from 'vitest';
import { setup } from './helpers';

describe('CRM', () => {
  it('classifica novos, recorrentes e inativos pelo último atendimento concluído', async () => {
    const { api, login, container } = await setup();
    const admin = await login();
    // João: último concluído há 14 dias → com 10 dias de limite fica inativo? Não: tem horário marcado hoje.
    await api.put('/api/admin/settings').set('Authorization', admin).send({ ...(await container.db.settings.get()), crmInactiveDays: 10 }).expect(200);
    const res = await api.get('/api/admin/crm').set('Authorization', admin).expect(200);
    expect(res.body.inactiveDays).toBe(10);
    const joao = res.body.customers.find((c: { name: string }) => c.name.startsWith('João'));
    expect(joao).toMatchObject({ visits: 1, lastVisit: '2026-09-23', daysSinceLastVisit: 14, nextAppointment: '2026-10-07', segment: 'new' });

    // cancela o horário de hoje → passa a inativo
    const appts = await api.get('/api/admin/appointments').set('Authorization', admin).query({ customerId: joao.id }).expect(200);
    const today = appts.body.find((a: { date: string }) => a.date === '2026-10-07');
    await api.patch(`/api/admin/appointments/${today.id}/status`).set('Authorization', admin).send({ status: 'cancelled' }).expect(200);
    const inactive = await api.get('/api/admin/crm').set('Authorization', admin).query({ segment: 'inactive' }).expect(200);
    expect(inactive.body.customers.map((c: { name: string }) => c.name)).toContain('João Silva (demo)');
    expect(inactive.body.counts.inactive).toBeGreaterThanOrEqual(1);
  });

  it('contato de reativação: abre o WhatsApp com mensagem pronta, registra e a equipe confirma o envio', async () => {
    const { api, login } = await setup();
    const admin = await login();
    const list = await api.get('/api/admin/crm').set('Authorization', admin).query({ search: 'joão' }).expect(200);
    const joao = list.body.customers[0];
    const started = await api.post(`/api/admin/customers/${joao.id}/contacts`).set('Authorization', admin).send({ kind: 'reactivation' }).expect(201);
    expect(started.body.contact).toMatchObject({ status: 'opened', kind: 'reactivation', actorName: 'Carol (demo)' });
    expect(started.body.contact.message).toContain('João');
    expect(started.body.contact.message).toContain('Thor');
    expect(started.body.contact.message).toContain('14 dias');
    expect(started.body.whatsappLink).toMatch(/^https:\/\/wa\.me\/5511988887777\?text=/);

    const sent = await api.patch(`/api/admin/contacts/${started.body.contact.id}`).set('Authorization', admin).send({ status: 'sent' }).expect(200);
    expect(sent.body.status).toBe('sent');
    const detail = await api.get(`/api/admin/customers/${joao.id}`).set('Authorization', admin).expect(200);
    expect(detail.body.contacts[0]).toMatchObject({ status: 'sent' });
    const again = await api.get('/api/admin/crm').set('Authorization', admin).query({ search: 'joão' }).expect(200);
    expect(again.body.customers[0].lastContact.status).toBe('sent');
  });

  it('respeita quem pediu para não receber mensagens', async () => {
    const { api, login } = await setup();
    const admin = await login();
    const list = await api.get('/api/admin/crm').set('Authorization', admin).query({ search: 'maria' }).expect(200);
    const maria = list.body.customers[0];
    await api.patch(`/api/admin/customers/${maria.id}`).set('Authorization', admin).send({ marketingOptOut: true }).expect(200);
    const denied = await api.post(`/api/admin/customers/${maria.id}/contacts`).set('Authorization', admin).send({ kind: 'reactivation' }).expect(409);
    expect(denied.body.error.code).toBe('OPT_OUT');
  });

  it('exige permissão de CRM e de clientes', async () => {
    const { api, login } = await setup();
    const owner = await login();
    await api
      .post('/api/admin/team')
      .set('Authorization', owner)
      .send({ name: 'Sem CRM', email: 'semcrm@karollapet.test', password: 'Equipe2026', role: 'freelance', customPermissions: { grants: ['crm.view'], agendaScope: 'all' } })
      .expect(201);
    const res = await api.post('/api/auth/login').send({ email: 'semcrm@karollapet.test', password: 'Equipe2026' }).expect(200);
    await api.get('/api/admin/crm').set('Authorization', `Bearer ${res.body.token}`).expect(403);
  });
});
