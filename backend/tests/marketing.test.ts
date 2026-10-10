import { describe, expect, it } from 'vitest';
import { bookingPayload, setup } from './helpers';

const PIXELS = {
  metaPixelId: '123456789012345',
  googleAdsId: 'aw-987654321',
  googleAdsBookingLabel: 'AbC-123_xyz',
  googleAdsWhatsappLabel: '',
  tiktokPixelId: 'c4abcdef123ghij456kl',
};

describe('Anúncios: IDs dos pixels', () => {
  it('administradora salva os IDs (normalizados) e o site público recebe só os IDs', async () => {
    const { api, login } = await setup();
    const token = await login();
    const current = await api.get('/api/admin/settings').set('Authorization', token).expect(200);
    expect(current.body.metaPixelId).toBe('');

    const saved = await api.put('/api/admin/settings').set('Authorization', token).send({ ...current.body, ...PIXELS }).expect(200);
    expect(saved.body.googleAdsId).toBe('AW-987654321');
    expect(saved.body.tiktokPixelId).toBe('C4ABCDEF123GHIJ456KL');

    const catalog = await api.get('/api/public/catalog').expect(200);
    expect(catalog.body.settings).toMatchObject({
      metaPixelId: '123456789012345',
      googleAdsId: 'AW-987654321',
      googleAdsBookingLabel: 'AbC-123_xyz',
      googleAdsWhatsappLabel: '',
      tiktokPixelId: 'C4ABCDEF123GHIJ456KL',
    });
  });

  it('recusa IDs em formato errado (ex.: colar o código inteiro do pixel)', async () => {
    const { api, login } = await setup();
    const token = await login();
    const current = (await api.get('/api/admin/settings').set('Authorization', token).expect(200)).body;
    const bad = await api.put('/api/admin/settings').set('Authorization', token).send({ ...current, metaPixelId: '<script>fbq("init")</script>' }).expect(400);
    expect(bad.body.error.fields.metaPixelId).toBeDefined();
    await api.put('/api/admin/settings').set('Authorization', token).send({ ...current, googleAdsId: '987654321' }).expect(400);
    await api.put('/api/admin/settings').set('Authorization', token).send({ ...current, googleAdsBookingLabel: 'AW-1/abc' }).expect(400);
  });

  it('visitante não altera os IDs', async () => {
    const { api } = await setup();
    await api.put('/api/admin/settings').send(PIXELS).expect(401);
  });
});

describe('Origem dos agendamentos (UTM / anúncios)', () => {
  it('grava a origem limpa, mostra no painel e soma no dashboard por canal', async () => {
    const { api, login } = await setup();
    const token = await login();
    const attribution = {
      utmSource: 'instagram',
      utmMedium: 'paid',
      utmCampaign: 'tosa-outubro',
      fbclid: 'IwAR123',
      referrer: 'https://l.instagram.com/?u=https%3A%2F%2Fkarollapet.com.br',
      landingPage: '/inspiracoes?utm_source=instagram&nome=Fulano',
      capturedAt: '2026-10-07T12:00:00.000Z',
      hacker: 'campo desconhecido',
    };
    const booked = await api.post('/api/public/appointments').send(bookingPayload({ attribution })).expect(201);
    const saved = booked.body.appointment.attribution;
    expect(saved).toEqual({
      utmSource: 'instagram',
      utmMedium: 'paid',
      utmCampaign: 'tosa-outubro',
      fbclid: 'IwAR123',
      referrer: 'l.instagram.com',
      landingPage: '/inspiracoes',
      capturedAt: '2026-10-07T12:00:00.000Z',
    });

    const detail = await api.get(`/api/admin/appointments/${booked.body.appointment.id}`).set('Authorization', token).expect(200);
    expect(detail.body.attribution.utmCampaign).toBe('tosa-outubro');

    await api.post('/api/public/appointments').send(bookingPayload({ date: '2026-10-09', attribution: { gclid: 'Cj0KCQ' } })).expect(201);
    await api.post('/api/public/appointments').send(bookingPayload({ date: '2026-10-13' })).expect(201);

    const dash = await api.get('/api/admin/dashboard').set('Authorization', token).expect(200);
    const byKey = Object.fromEntries((dash.body.channels as { key: string; count: number; paid: boolean; revenueCents: number }[]).map((c) => [c.key, c]));
    expect(byKey.meta_ads).toMatchObject({ count: 1, paid: true, label: 'Meta Ads (Instagram/Facebook)' });
    expect(byKey.google_ads).toMatchObject({ count: 1, paid: true });
    expect(byKey.meta_ads.revenueCents).toBe(booked.body.appointment.totalCents);
  });

  it('origem inválida é ignorada e nunca impede o agendamento', async () => {
    const { api } = await setup();
    const a = await api.post('/api/public/appointments').send(bookingPayload({ attribution: 'texto qualquer' })).expect(201);
    expect(a.body.appointment.attribution).toBeNull();
    const b = await api.post('/api/public/appointments').send(bookingPayload({ date: '2026-10-09', attribution: { utmSource: 'x'.repeat(5000) } })).expect(201);
    expect(b.body.appointment.attribution.utmSource).toHaveLength(200);
    const c = await api.post('/api/public/appointments').send(bookingPayload({ date: '2026-10-13' })).expect(201);
    expect(c.body.appointment.attribution).toBeNull();
  });
});
