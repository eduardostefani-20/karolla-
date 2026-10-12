import { describe, expect, it } from 'vitest';
import { setup } from './helpers';

const PASSWORD = 'Cliente2026';
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

async function portal() {
  const ctx = await setup();
  const signUp = async (body: Record<string, unknown>) => {
    const res = await ctx.api.post('/api/account/signup').send({ password: PASSWORD, acceptPrivacy: true, ...body });
    expect(res.status).toBe(201);
    return `Bearer ${res.body.session.token as string}`;
  };
  return { ...ctx, signUp };
}

describe('Portal do cliente', () => {
  it('cadastro novo cria o próprio cadastro (WhatsApp ainda não usado)', async () => {
    const { api, signUp } = await portal();
    const token = await signUp({ name: 'Paula Nova', email: 'paula@exemplo.com', whatsapp: '(11) 95555-1212' });
    const me = await api.get('/api/account/me').set('Authorization', token).expect(200);
    expect(me.body).toMatchObject({ status: 'linked', email: 'paula@exemplo.com', customer: { name: 'Paula Nova', whatsapp: '11955551212' } });
    expect(me.headers['cache-control']).toContain('no-store');
    const pets = await api.get('/api/account/me/pets').set('Authorization', token).expect(200);
    expect(pets.body).toEqual([]);
  });

  it('e-mail confirmado igual ao do cadastro existente liga a conta e mostra o histórico', async () => {
    const { api, signUp } = await portal();
    const token = await signUp({ name: 'João', email: 'JOAO.demo@exemplo.com', whatsapp: '(11) 95555-0000' });
    const me = await api.get('/api/account/me').set('Authorization', token).expect(200);
    expect(me.body.customer.name).toBe('João Silva (demo)');
    const pets = await api.get('/api/account/me/pets').set('Authorization', token).expect(200);
    expect(pets.body.map((p: { name: string }) => p.name)).toEqual(['Thor']);
    const history = await api.get('/api/account/me/appointments').set('Authorization', token).expect(200);
    expect(history.body.length).toBe(2);
    expect(history.body.every((a: { petName: string }) => a.petName === 'Thor')).toBe(true);
    expect(history.body[0]).not.toHaveProperty('notes');
    expect(history.body[0]).not.toHaveProperty('attribution');
  });

  it('WhatsApp de outro cadastro (sem e-mail igual) NÃO liga sozinho: fica pendente até a equipe confirmar', async () => {
    const { api, signUp, login } = await portal();
    const token = await signUp({ name: 'Golpista', email: 'outra@pessoa.com', whatsapp: '(11) 97777-6666' }); // WhatsApp da Maria
    const me = await api.get('/api/account/me').set('Authorization', token).expect(200);
    expect(me.body).toMatchObject({ status: 'pending', customer: null });
    const denied = await api.get('/api/account/me/pets').set('Authorization', token).expect(403);
    expect(denied.body.error.code).toBe('ACCOUNT_PENDING');
    await api.get('/api/account/me/appointments').set('Authorization', token).expect(403);

    // a equipe confirma o vínculo pelo e-mail da conta
    const admin = await login();
    const customers = await api.get('/api/admin/customers').set('Authorization', admin).expect(200);
    const maria = customers.body.find((c: { name: string }) => c.name.startsWith('Maria'));
    const linked = await api.post(`/api/admin/customers/${maria.id}/link-account`).set('Authorization', admin).send({ email: 'outra@pessoa.com' }).expect(200);
    expect(linked.body.accountEmail).toBe('outra@pessoa.com');
    const pets = await api.get('/api/account/me/pets').set('Authorization', token).expect(200);
    expect(pets.body.map((p: { name: string }) => p.name).sort()).toEqual(['Luna', 'Mel']);
  });

  it('um cliente não acessa pets, fotos nem histórico de outro (nem trocando o id na URL)', async () => {
    const { api, signUp, login } = await portal();
    const joao = await signUp({ name: 'João', email: 'joao.demo@exemplo.com', whatsapp: '(11) 95555-0001' });
    const maria = await signUp({ name: 'Maria', email: 'maria.demo@exemplo.com', whatsapp: '(11) 95555-0002' });
    const thor = (await api.get('/api/account/me/pets').set('Authorization', joao).expect(200)).body[0];
    const mel = (await api.get('/api/account/me/pets').set('Authorization', maria).expect(200)).body[0];

    await api.get(`/api/account/me/pets/${thor.id}`).set('Authorization', maria).expect(404);
    await api.patch(`/api/account/me/pets/${thor.id}`).set('Authorization', maria).send({ name: 'Hackeado' }).expect(404);
    await api.post(`/api/account/me/pets/${thor.id}/upload-ticket`).set('Authorization', maria).send({ kind: 'pet-photo', contentType: 'image/png', size: PNG.length }).expect(404);

    // João envia uma referência; Maria não consegue apagar nem usar o caminho dele
    const ticket = (await api.post(`/api/account/me/pets/${thor.id}/upload-ticket`).set('Authorization', joao).send({ kind: 'pet-reference', contentType: 'image/png', size: PNG.length }).expect(200)).body;
    await api.put(ticket.uploadUrl).set('Content-Type', 'image/png').send(PNG).expect(204);
    const withRef = await api.post(`/api/account/me/pets/${thor.id}/references`).set('Authorization', joao).send({ path: ticket.path, description: 'Tosa bebê' }).expect(201);
    const ref = withRef.body.references[0];
    expect(ref.description).toBe('Tosa bebê');
    await api.post(`/api/account/me/pets/${mel.id}/references`).set('Authorization', maria).send({ path: ticket.path }).expect(403);
    await api.delete(`/api/account/me/references/${ref.id}`).set('Authorization', maria).expect(404);

    // observações internas da equipe nunca aparecem no portal
    const admin = await login();
    await api.patch(`/api/admin/pets/${thor.id}`).set('Authorization', admin).send({ internalNotes: 'Mordeu na última vez' }).expect(200);
    const seen = await api.get(`/api/account/me/pets/${thor.id}`).set('Authorization', joao).expect(200);
    expect(JSON.stringify(seen.body)).not.toContain('Mordeu');
    const meJoao = await api.get('/api/account/me').set('Authorization', joao).expect(200);
    expect(meJoao.body.customer).not.toHaveProperty('notes');

    await api.delete(`/api/account/me/references/${ref.id}`).set('Authorization', joao).expect(204);
  });

  it('pet com nascimento, preferências e foto privada (link temporário)', async () => {
    const { api, signUp } = await portal();
    const token = await signUp({ name: 'Bia', email: 'bia@exemplo.com', whatsapp: '(11) 95555-3333' });
    const created = await api
      .post('/api/account/me/pets')
      .set('Authorization', token)
      .send({ name: 'Pipoca', speciesId: 'dog', breedId: 'dog-shih-tzu', breedName: 'x', sizeId: 'pequeno', birthDate: '2024-10-01', characteristics: 'Medrosa com secador', groomingPreferences: 'Tosa bebê, orelhas redondas' })
      .expect(201);
    expect(created.body).toMatchObject({ breedName: 'Shih Tzu', ageMonths: 24, groomingPreferences: 'Tosa bebê, orelhas redondas', photoUrl: null });
    expect(created.body).not.toHaveProperty('internalNotes');

    const id = created.body.id;
    // caminho inventado / não enviado é recusado
    await api.put(`/api/account/me/pets/${id}/photo`).set('Authorization', token).send({ path: 'clientes/outro/pets/x/foto/a.png' }).expect(403);
    const ticket = (await api.post(`/api/account/me/pets/${id}/upload-ticket`).set('Authorization', token).send({ kind: 'pet-photo', contentType: 'image/png', size: PNG.length }).expect(200)).body;
    await api.put(`/api/account/me/pets/${id}/photo`).set('Authorization', token).send({ path: ticket.path }).expect(400);
    await api.put(ticket.uploadUrl).set('Content-Type', 'image/png').send(PNG).expect(204);
    const withPhoto = await api.put(`/api/account/me/pets/${id}/photo`).set('Authorization', token).send({ path: ticket.path }).expect(200);
    expect(withPhoto.body.photoUrl).toMatch(/^\/api\/private-files\//);
    const file = await api.get(withPhoto.body.photoUrl).expect(200);
    expect(file.headers['cache-control']).toContain('no-store');

    // formatos e tamanhos não permitidos
    await api.post(`/api/account/me/pets/${id}/upload-ticket`).set('Authorization', token).send({ kind: 'pet-photo', contentType: 'image/gif', size: 10 }).expect(400);
    await api.post(`/api/account/me/pets/${id}/upload-ticket`).set('Authorization', token).send({ kind: 'pet-photo', contentType: 'image/png', size: 9 * 1024 * 1024 }).expect(400);
  });

  it('perfil: edita dados, não pega WhatsApp de outro cadastro e pode recusar mensagens', async () => {
    const { api, signUp } = await portal();
    const token = await signUp({ name: 'Caio', email: 'caio@exemplo.com', whatsapp: '(11) 95555-4444' });
    await api.patch('/api/account/me').set('Authorization', token).send({ whatsapp: '(11) 98888-7777' }).expect(409);
    const updated = await api
      .patch('/api/account/me')
      .set('Authorization', token)
      .send({ name: 'Caio Lima', marketingOptOut: true, address: { street: 'Rua A', number: '1', complement: '', neighborhood: 'Centro', city: 'São Paulo' } })
      .expect(200);
    expect(updated.body).toMatchObject({ name: 'Caio Lima', marketingOptOut: true });
  });

  it('sem login ou com token inválido não acessa nada', async () => {
    const { api } = await portal();
    await api.get('/api/account/me').expect(401);
    await api.get('/api/account/me/pets').set('Authorization', 'Bearer falso').expect(401);
  });

  it('aceite da política de privacidade é obrigatório e senha fraca é recusada', async () => {
    const { api } = await portal();
    await api.post('/api/account/signup').send({ name: 'X', email: 'x@exemplo.com', whatsapp: '(11) 95555-9999', password: PASSWORD }).expect(400);
    await api.post('/api/account/signup').send({ name: 'X', email: 'x@exemplo.com', whatsapp: '(11) 95555-9999', password: 'fraca', acceptPrivacy: true }).expect(400);
  });

  it('login de cliente não abre o painel administrativo', async () => {
    const { api, signUp } = await portal();
    const token = await signUp({ name: 'Dani', email: 'dani@exemplo.com', whatsapp: '(11) 95555-5656' });
    await api.get('/api/admin/customers').set('Authorization', token).expect(401);
    await api.post('/api/auth/login').send({ email: 'dani@exemplo.com', password: PASSWORD }).expect(401);
  });
});
