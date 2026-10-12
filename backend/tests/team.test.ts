import { describe, expect, it } from 'vitest';
import type { MockAuthService } from '../src/integrations/auth/MockAuthService';
import { ADMIN, setup } from './helpers';

const PASSWORD = 'equipe-1234';

async function withTeam() {
  const ctx = await setup();
  const owner = await ctx.login();
  const create = async (body: Record<string, unknown>) => {
    const res = await ctx.api.post('/api/admin/team').set('Authorization', owner).send({ password: PASSWORD, ...body });
    expect(res.status).toBe(201);
    return res.body as { id: string };
  };
  const loginAs = async (email: string, password = PASSWORD) => {
    const res = await ctx.api.post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return { token: `Bearer ${res.body.token as string}`, refreshToken: res.body.refreshToken as string, user: res.body.user };
  };
  return { ...ctx, owner, create, loginAs };
}

describe('Equipe e permissões', () => {
  it('gerente opera a agenda, mas valores financeiros nunca chegam ao navegador', async () => {
    const { api, create, loginAs } = await withTeam();
    await create({ name: 'Gerente', email: 'gerente@karollapet.test', role: 'manager' });
    const { token, user } = await loginAs('gerente@karollapet.test');
    expect(user.role).toBe('manager');
    expect(user.permissions.grants).not.toContain('finance.view');

    const list = await api.get('/api/admin/appointments').set('Authorization', token).expect(200);
    expect(list.body.length).toBeGreaterThan(0);
    expect(JSON.stringify(list.body)).not.toMatch(/totalCents|priceCents/);
    const dash = await api.get('/api/admin/dashboard').set('Authorization', token).expect(200);
    expect(dash.body.stats.revenueTodayCents).toBeUndefined();
    const catalog = await api.get('/api/admin/catalog').set('Authorization', token).expect(200);
    expect(JSON.stringify(catalog.body)).not.toMatch(/priceCents|servicePrices/);

    await api.put('/api/admin/prices').set('Authorization', token).send({ prices: [] }).expect(403);
    await api.post('/api/admin/services').set('Authorization', token).send({ name: 'X', category: 'Y', durationMinutes: 30 }).expect(403);
    await api.get('/api/admin/team').set('Authorization', token).expect(403);
    await api.put('/api/admin/settings').set('Authorization', token).send({}).expect(403);
  });

  it('dona vê os valores', async () => {
    const { api, owner } = await withTeam();
    const list = await api.get('/api/admin/appointments').set('Authorization', owner).expect(200);
    expect(list.body[0].totalCents).toEqual(expect.any(Number));
  });

  it('profissional vê só os próprios atendimentos (inclusive por URL direta), sem contato do tutor', async () => {
    const { api, owner, create, loginAs } = await withTeam();
    const pro = await api.post('/api/admin/professionals').set('Authorization', owner).send({ name: 'Ana' }).expect(201);
    const all = (await api.get('/api/admin/appointments').set('Authorization', owner).expect(200)).body as { id: string; customerId: string; petId: string }[];
    const [mine, other] = all;
    await api.patch(`/api/admin/appointments/${mine!.id}`).set('Authorization', owner).send({ professionalId: pro.body.id }).expect(200);

    await create({ name: 'Ana', email: 'ana@karollapet.test', role: 'professional', professionalId: pro.body.id });
    const { token } = await loginAs('ana@karollapet.test');

    const list = await api.get('/api/admin/appointments').set('Authorization', token).expect(200);
    expect(list.body.map((a: { id: string }) => a.id)).toEqual([mine!.id]);
    expect(list.body[0].customer.name).toBeTruthy();
    expect(list.body[0].customer.whatsapp).toBeUndefined();
    expect(list.body[0].customer.address).toBeUndefined();
    expect(list.body[0].totalCents).toBeUndefined();

    await api.get(`/api/admin/appointments/${other!.id}`).set('Authorization', token).expect(404);
    await api.patch(`/api/admin/appointments/${other!.id}/status`).set('Authorization', token).send({ status: 'completed' }).expect(404);
    await api.patch(`/api/admin/appointments/${mine!.id}/status`).set('Authorization', token).send({ status: 'in_progress' }).expect(200);
    await api.patch(`/api/admin/appointments/${mine!.id}`).set('Authorization', token).send({ notes: 'x' }).expect(403); // sem agenda.edit
    await api.get('/api/admin/customers').set('Authorization', token).expect(403);
    const pets = await api.get('/api/admin/pets').set('Authorization', token).expect(200);
    expect(pets.body.map((p: { id: string }) => p.id)).toEqual([mine!.petId]);
    await api.get(`/api/admin/pets/${other!.petId === mine!.petId ? 'nao-existe' : other!.petId}`).set('Authorization', token).expect(404);
    await api.get('/api/admin/dashboard').set('Authorization', token).expect(403);
  });

  it('conta sem profissional vinculado e escopo "own" não vê nenhum atendimento', async () => {
    const { api, create, loginAs } = await withTeam();
    await create({ name: 'Free', email: 'free@karollapet.test', role: 'freelance' });
    const { token } = await loginAs('free@karollapet.test');
    const list = await api.get('/api/admin/appointments').set('Authorization', token).expect(200);
    expect(list.body).toEqual([]);
  });

  it('permissões personalizadas valem no servidor', async () => {
    const { api, create, loginAs } = await withTeam();
    await create({
      name: 'Recepção',
      email: 'recepcao@karollapet.test',
      role: 'freelance',
      customPermissions: { grants: ['agenda.view', 'customers.view', 'finance.view', 'inexistente.view'], agendaScope: 'all' },
    });
    const { token, user } = await loginAs('recepcao@karollapet.test');
    expect(user.permissions.grants).toEqual(['agenda.view', 'customers.view', 'finance.view']);
    const list = await api.get('/api/admin/appointments').set('Authorization', token).expect(200);
    expect(list.body.length).toBeGreaterThan(1);
    expect(list.body[0].totalCents).toEqual(expect.any(Number));
    expect(list.body[0].customer.whatsapp).toBeTruthy();
    await api.patch(`/api/admin/appointments/${list.body[0].id}/status`).set('Authorization', token).send({ status: 'confirmed' }).expect(403);
  });

  it('ninguém concede permissão que não tem; a conta principal não pode ser alterada', async () => {
    const { api, owner, create, loginAs, container } = await withTeam();
    await create({
      name: 'Gerente RH',
      email: 'rh@karollapet.test',
      role: 'manager',
      customPermissions: { grants: ['team.view', 'team.admin', 'agenda.view'], agendaScope: 'all' },
    });
    const { token, user } = await loginAs('rh@karollapet.test');
    const denied = await api.post('/api/admin/team').set('Authorization', token).send({ name: 'X', email: 'x@karollapet.test', password: PASSWORD, role: 'admin' }).expect(403);
    expect(denied.body.error.message).toMatch(/não pode conceder/);
    await api.patch('/api/admin/team/demo-admin').set('Authorization', token).send({ active: false }).expect(403);
    await api.patch(`/api/admin/team/${user.id}`).set('Authorization', token).send({ customPermissions: null, role: 'admin' }).expect(403);
    await api.patch('/api/admin/team/demo-admin').set('Authorization', owner).send({ active: false }).expect(403);
    await api.put('/api/admin/team/demo-admin/password').set('Authorization', token).send({ password: 'outra-senha-1' }).expect(403);
    expect((await container.db.admins.findByUserId('demo-admin'))?.active).toBe(true);
  });

  it('desativar a conta corta o acesso na hora, mesmo com token válido', async () => {
    const { api, owner, create, loginAs } = await withTeam();
    const member = await create({ name: 'Temp', email: 'temp@karollapet.test', role: 'manager' });
    const { token, refreshToken } = await loginAs('temp@karollapet.test');
    await api.get('/api/admin/appointments').set('Authorization', token).expect(200);
    await api.patch(`/api/admin/team/${member.id}`).set('Authorization', owner).send({ active: false }).expect(200);
    await api.get('/api/admin/appointments').set('Authorization', token).expect(401);
    await api.post('/api/auth/refresh').send({ refreshToken }).expect(401);
    const relog = await api.post('/api/auth/login').send({ email: 'temp@karollapet.test', password: PASSWORD });
    expect(relog.status).toBe(401);
    // reativada: volta a entrar
    await api.patch(`/api/admin/team/${member.id}`).set('Authorization', owner).send({ active: true }).expect(200);
    await loginAs('temp@karollapet.test');
  });

  it('cliente/usuário sem registro na equipe não entra no painel', async () => {
    const { api, container } = await withTeam();
    await container.auth.createUser({ email: 'cliente@exemplo.com', password: PASSWORD, name: 'Cliente' });
    await api.post('/api/auth/login').send({ email: 'cliente@exemplo.com', password: PASSWORD }).expect(401);
  });

  it('renovação de sessão troca o refresh token (cada um vale uma vez)', async () => {
    const { api } = await withTeam();
    const first = await api.post('/api/auth/login').send(ADMIN).expect(200);
    const renewed = await api.post('/api/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(200);
    expect(renewed.body.token).toBeTruthy();
    expect(renewed.body.user.role).toBe('owner');
    await api.post('/api/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(401);
  });

  it('recuperação de senha: não revela e-mail e o link só vale uma vez', async () => {
    const { api, container } = await withTeam();
    const auth = container.auth as MockAuthService;
    await api.post('/api/auth/forgot-password').send({ email: 'ninguem@exemplo.com' }).expect(204);
    expect(auth.lastRecoveryLink).toBeNull();
    await api.post('/api/auth/forgot-password').send({ email: ADMIN.email }).expect(204);
    expect(auth.lastRecoveryLink).toContain('/redefinir-senha#');
    const token = new URLSearchParams(auth.lastRecoveryLink!.split('#')[1]).get('access_token')!;
    await api.post('/api/auth/reset-password').send({ token, password: 'fraca' }).expect(400);
    await api.post('/api/auth/reset-password').send({ token, password: 'NovaSenha2026' }).expect(204);
    await api.post('/api/auth/reset-password').send({ token, password: 'OutraSenha2026' }).expect(401);
    await api.post('/api/auth/login').send(ADMIN).expect(401);
    await api.post('/api/auth/login').send({ email: ADMIN.email, password: 'NovaSenha2026' }).expect(200);
  });

  it('um token de sessão comum não serve como link de redefinição', async () => {
    const { api } = await withTeam();
    const session = await api.post('/api/auth/login').send(ADMIN).expect(200);
    await api.post('/api/auth/reset-password').send({ token: session.body.token, password: 'NovaSenha2026' }).expect(401);
  });

  it('troca da própria senha exige a senha atual', async () => {
    const { api, owner } = await withTeam();
    await api.post('/api/auth/change-password').set('Authorization', owner).send({ currentPassword: 'errada', newPassword: 'NovaSenha2026' }).expect(400);
    await api.post('/api/auth/change-password').set('Authorization', owner).send({ currentPassword: ADMIN.password, newPassword: 'NovaSenha2026' }).expect(204);
    await api.post('/api/auth/login').send({ email: ADMIN.email, password: 'NovaSenha2026' }).expect(200);
  });

  it('auditoria registra quem fez o quê, sem gravar o conteúdo enviado', async () => {
    const { api, owner, create } = await withTeam();
    const member = await create({ name: 'Audit', email: 'audit@karollapet.test', role: 'manager' });
    await api.patch(`/api/admin/team/${member.id}`).set('Authorization', owner).send({ name: 'Auditada' }).expect(200);
    const logs = await api.get('/api/admin/audit').set('Authorization', owner).expect(200);
    const actions = logs.body.map((l: { action: string }) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['POST /team', 'PATCH /team/:id', 'login']));
    const patch = logs.body.find((l: { action: string }) => l.action === 'PATCH /team/:id');
    expect(patch).toMatchObject({ actorEmail: ADMIN.email, entity: 'team', entityId: member.id, status: 200 });
    expect(JSON.stringify(logs.body)).not.toContain(PASSWORD);
  });

  it('lista da equipe não expõe senhas e mostra o perfil efetivo', async () => {
    const { api, owner, create } = await withTeam();
    await create({ name: 'Ver', email: 'ver@karollapet.test', role: 'freelance' });
    const res = await api.get('/api/admin/team').set('Authorization', owner).expect(200);
    expect(res.body.map((m: { email: string }) => m.email)).toEqual(expect.arrayContaining([ADMIN.email, 'ver@karollapet.test']));
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash|salt/i);
  });
});
