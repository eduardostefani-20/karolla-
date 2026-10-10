import { describe, expect, it, vi } from 'vitest';
import { bookingPayload, setup, NOW, TOMORROW } from './helpers';
import { GraphInstagramFeed } from '../src/integrations/instagram/InstagramFeedService';

type Api = Awaited<ReturnType<typeof setup>>['api'];

const withPhone = (p: ReturnType<typeof bookingPayload>, whatsapp: string, extra: Record<string, unknown> = {}) => ({
  ...p,
  ...extra,
  tutor: { ...(p.tutor as object), whatsapp },
});

async function createPro(api: Api, token: string, body: Record<string, unknown>) {
  const res = await api.post('/api/admin/professionals').set('Authorization', token).send(body).expect(201);
  return res.body.id as string;
}

describe('Agenda por profissional', () => {
  it('distribui agendamentos simultâneos entre profissionais e bloqueia quando todos estão ocupados', async () => {
    const { api, login } = await setup();
    const token = await login();
    const ana = await createPro(api, token, { name: 'Ana', serviceIds: [] });
    const bia = await createPro(api, token, { name: 'Bia', serviceIds: [] });

    const catalog = await api.get('/api/public/catalog').expect(200);
    expect(catalog.body.professionals.map((p: { name: string }) => p.name)).toEqual(['Ana', 'Bia']);

    const a1 = await api.post('/api/public/appointments').send(withPhone(bookingPayload(), '(11) 91111-0001')).expect(201);
    const a2 = await api.post('/api/public/appointments').send(withPhone(bookingPayload(), '(11) 91111-0002')).expect(201);
    expect(new Set([a1.body.appointment.professionalId, a2.body.appointment.professionalId])).toEqual(new Set([ana, bia]));
    const third = await api.post('/api/public/appointments').send(withPhone(bookingPayload(), '(11) 91111-0003')).expect(409);
    expect(third.body.error.code).toBe('SLOT_UNAVAILABLE');
  });

  it('cliente pode escolher o profissional; serviço que ele não faz é recusado', async () => {
    const { api, login } = await setup();
    const token = await login();
    const banhista = await createPro(api, token, { name: 'Banhista', serviceIds: ['banho'] });
    await createPro(api, token, { name: 'Tosador', serviceIds: ['tosa', 'banho-tosa'] });

    const avail = await api.get('/api/public/availability').query({ date: TOMORROW, serviceIds: 'banho', sizeId: 'mini' }).expect(200);
    expect(avail.body.professionals.map((p: { name: string }) => p.name)).toEqual(['Banhista']);

    const p = bookingPayload({ serviceIds: ['banho'], addonIds: [] });
    const ok = await api.post('/api/public/appointments').send(withPhone(p, '(11) 92222-0001', { professionalId: banhista })).expect(201);
    expect(ok.body.appointment.professionalId).toBe(banhista);
    // Banhista ocupado às 09:00 e o tosador não faz banho
    await api.post('/api/public/appointments').send(withPhone(p, '(11) 92222-0002')).expect(409);
    const wrong = await api.post('/api/public/appointments').send(withPhone(bookingPayload(), '(11) 92222-0003', { professionalId: banhista, time: '14:00' })).expect(409);
    expect(wrong.body.error.message).toMatch(/Nenhum profissional/);
  });

  it('painel troca o profissional sem permitir conflito e não exclui profissional com histórico', async () => {
    const { api, login } = await setup();
    const token = await login();
    const ana = await createPro(api, token, { name: 'Ana' });
    const bia = await createPro(api, token, { name: 'Bia' });
    const a1 = await api.post('/api/public/appointments').send(withPhone(bookingPayload(), '(11) 93333-0001', { professionalId: ana })).expect(201);
    const a2 = await api.post('/api/public/appointments').send(withPhone(bookingPayload(), '(11) 93333-0002', { professionalId: bia })).expect(201);
    const conflict = await api.patch(`/api/admin/appointments/${a2.body.appointment.id}`).set('Authorization', token).send({ professionalId: ana }).expect(409);
    expect(conflict.body.error.code).toBe('SLOT_UNAVAILABLE');
    await api.patch(`/api/admin/appointments/${a1.body.appointment.id}`).set('Authorization', token).send({ time: '14:00' }).expect(200);
    const moved = await api.patch(`/api/admin/appointments/${a2.body.appointment.id}`).set('Authorization', token).send({ professionalId: ana }).expect(200);
    expect(moved.body.professionalId).toBe(ana);

    const del = await api.delete(`/api/admin/professionals/${ana}`).set('Authorization', token).expect(409);
    expect(del.body.error.message).toMatch(/Desative/);
    await api.patch(`/api/admin/professionals/${ana}`).set('Authorization', token).send({ active: false }).expect(200);
    const catalog = await api.get('/api/public/catalog').expect(200);
    expect(catalog.body.professionals.map((p: { id: string }) => p.id)).toEqual([bia]);
  });

  it('sem profissionais cadastrados a regra de vagas por horário continua valendo', async () => {
    const { api, container } = await setup();
    await container.db.settings.update({ capacity: 1 });
    const r = await api.post('/api/public/appointments').send(bookingPayload()).expect(201);
    expect(r.body.appointment.professionalId).toBeNull();
    await api.post('/api/public/appointments').send(withPhone(bookingPayload(), '(11) 94444-0001')).expect(409);
  });
});

describe('Inspirações de tosa', () => {
  const inspiration = { title: 'Tosa bebê', description: 'Pelagem curtinha', speciesId: 'dog', breedId: 'dog-shih-tzu', imageUrl: 'https://cdn.exemplo.com/foto.jpg' };

  it('a foto escolhida chega ao agendamento e fica salva no painel', async () => {
    const { api, login } = await setup();
    const token = await login();
    const before = (await api.get('/api/public/inspirations').expect(200)).body.length;
    const created = await api.post('/api/admin/inspirations').set('Authorization', token).send(inspiration).expect(201);
    expect(created.body.breedName).toBe('Shih Tzu');

    const list = await api.get('/api/public/inspirations').expect(200);
    expect(list.body).toHaveLength(before + 1);
    expect(list.body.every((i: object) => !('storagePath' in i))).toBe(true);

    const booked = await api.post('/api/public/appointments').send(bookingPayload({ inspirationId: created.body.id })).expect(201);
    expect(booked.body.appointment.inspiration).toEqual({ id: created.body.id, title: 'Tosa bebê', imageUrl: inspiration.imageUrl, breedName: 'Shih Tzu' });
    // preço e serviços continuam iguais (a foto é só referência)
    expect(booked.body.appointment.totalCents).toBe(19500);

    const detail = await api.get(`/api/admin/appointments/${booked.body.appointment.id}`).set('Authorization', token).expect(200);
    expect(detail.body.inspiration.imageUrl).toBe(inspiration.imageUrl);

    // editar a inspiração depois não altera o que ficou gravado no agendamento
    await api.patch(`/api/admin/inspirations/${created.body.id}`).set('Authorization', token).send({ title: 'Novo título' }).expect(200);
    const again = await api.get(`/api/admin/appointments/${booked.body.appointment.id}`).set('Authorization', token).expect(200);
    expect(again.body.inspiration.title).toBe('Tosa bebê');

    // foto usada em agendamento não pode ser excluída (só desativada)
    await api.delete(`/api/admin/inspirations/${created.body.id}`).set('Authorization', token).expect(409);
    await api.patch(`/api/admin/inspirations/${created.body.id}`).set('Authorization', token).send({ active: false }).expect(200);
    expect((await api.get('/api/public/inspirations').expect(200)).body).toHaveLength(before);
    const blocked = await api.post('/api/public/appointments').send(bookingPayload({ date: '2026-10-09', inspirationId: created.body.id })).expect(400);
    expect(blocked.body.error.fields.inspirationId).toBeDefined();
  });

  it('agendamentos sem inspiração continuam funcionando', async () => {
    const { api } = await setup();
    const r = await api.post('/api/public/appointments').send(bookingPayload()).expect(201);
    expect(r.body.appointment.inspiration).toBeNull();
  });

  it('visitante não cria inspiração; URL de mídia é validada', async () => {
    const { api, login } = await setup();
    await api.post('/api/admin/inspirations').send(inspiration).expect(401);
    const token = await login();
    await api.post('/api/admin/inspirations').set('Authorization', token).send({ ...inspiration, imageUrl: 'javascript:alert(1)' }).expect(400);
  });
});

describe('Stories (24 horas)', () => {
  it('somem automaticamente após 24h pela data gravada e são removidos pela limpeza', async () => {
    const clock = { current: NOW, now() { return this.current; } };
    const { api, login, container } = await setup({ clock });
    const token = await login();
    for (const s of await container.db.stories.list()) await container.db.stories.delete(s.id); // remove o exemplo do modo demo
    const story = await api.post('/api/admin/stories').set('Authorization', token).send({ mediaType: 'image', mediaUrl: 'https://cdn.exemplo.com/s.jpg', caption: 'Banho do Thor' }).expect(201);
    expect(Date.parse(story.body.expiresAt) - NOW.getTime()).toBe(24 * 3_600_000);
    expect((await api.get('/api/public/stories').expect(200)).body).toHaveLength(1);

    clock.current = new Date(NOW.getTime() + 23 * 3_600_000 + 59 * 60_000);
    expect((await api.get('/api/public/stories').expect(200)).body).toHaveLength(1);

    clock.current = new Date(NOW.getTime() + 24 * 3_600_000 + 1);
    expect((await api.get('/api/public/stories').expect(200)).body).toHaveLength(0);
    expect((await api.get('/api/admin/stories').set('Authorization', token).expect(200)).body).toHaveLength(0);

    expect(await container.media.purgeExpiredStories()).toBe(1);
    expect(await container.db.stories.findById(story.body.id)).toBeNull();
  });

  it('visitante não publica stories; administrador exclui', async () => {
    const { api, login, container } = await setup();
    for (const s of await container.db.stories.list()) await container.db.stories.delete(s.id);
    await api.post('/api/admin/stories').send({ mediaType: 'image', mediaUrl: 'https://x/y.jpg' }).expect(401);
    const token = await login();
    const s = await api.post('/api/admin/stories').set('Authorization', token).send({ mediaType: 'video', mediaUrl: 'https://x/y.mp4' }).expect(201);
    await api.delete(`/api/admin/stories/${s.body.id}`).set('Authorization', token).expect(204);
    expect((await api.get('/api/public/stories').expect(200)).body).toHaveLength(0);
  });
});

describe('Upload de mídia', () => {
  it('valida tipo e tamanho e recebe o arquivo pela URL temporária (modo demo)', async () => {
    const { api, login } = await setup();
    const token = await login();
    await api.post('/api/admin/media/upload-ticket').set('Authorization', token).send({ kind: 'inspiration', contentType: 'video/mp4', size: 1000 }).expect(400);
    await api.post('/api/admin/media/upload-ticket').set('Authorization', token).send({ kind: 'story', contentType: 'video/mp4', size: 60 * 1024 * 1024 }).expect(400);
    await api.post('/api/admin/media/upload-ticket').set('Authorization', token).send({ kind: 'story', contentType: 'application/pdf', size: 10 }).expect(400);
    await api.post('/api/admin/media/upload-ticket').send({ kind: 'story', contentType: 'image/png', size: 10 }).expect(401);

    const body = Buffer.from('fake-png-bytes');
    const ticket = await api.post('/api/admin/media/upload-ticket').set('Authorization', token).send({ kind: 'inspiration', contentType: 'image/png', size: body.length }).expect(200);
    expect(ticket.body.provider).toBe('memory');
    await api.put(ticket.body.uploadUrl).set('Content-Type', 'image/png').send(body).expect(204);
    const file = await api.get(ticket.body.publicUrl).expect(200);
    expect(file.headers['content-type']).toBe('image/png');
    // o link de envio é de uso único
    await api.put(ticket.body.uploadUrl).set('Content-Type', 'image/png').send(body).expect(400);
  });
});

describe('Instagram (API oficial)', () => {
  it('sem token não inventa publicações', async () => {
    const { api } = await setup();
    expect((await api.get('/api/public/instagram-feed').expect(200)).body).toEqual({ configured: false, posts: [] });
  });

  it('com token, converte a resposta da Graph API e usa cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ data: [{ id: '1', caption: 'Banho', media_type: 'IMAGE', media_url: 'https://cdn/1.jpg', permalink: 'https://instagram.com/p/1', timestamp: '2026-10-01T10:00:00+0000' }] }),
    );
    const feed = new GraphInstagramFeed({ accessToken: 'tok', apiVersion: 'v21.0', limit: 12, cacheMs: 60_000, timeoutMs: 1000 }, fetchMock as unknown as typeof fetch);
    const r1 = await feed.getFeed();
    await feed.getFeed();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]![0])).toContain('graph.instagram.com/v21.0/me/media');
    expect(r1.posts[0]).toMatchObject({ id: '1', mediaUrl: 'https://cdn/1.jpg', permalink: 'https://instagram.com/p/1' });
  });

  it('falha na API não derruba o site', async () => {
    const feed = new GraphInstagramFeed({ accessToken: 'tok', apiVersion: 'v21.0', limit: 12, cacheMs: 0, timeoutMs: 1000 }, vi.fn().mockRejectedValue(new Error('rede')) as unknown as typeof fetch);
    expect(await feed.getFeed()).toEqual({ configured: true, posts: [] });
  });
});
