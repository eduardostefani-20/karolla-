import { describe, expect, it } from 'vitest';
import { ADMIN, setup } from './helpers';

describe('Segurança do login', () => {
  it('bloqueia o e-mail depois de 5 senhas erradas (painel), mesmo com a senha certa', async () => {
    const { api, container } = await setup();
    for (let i = 0; i < 5; i++) {
      await api.post('/api/auth/login').send({ email: ADMIN.email, password: 'senha-errada-1' }).expect(401);
    }
    const locked = await api.post('/api/auth/login').send({ email: ADMIN.email.toUpperCase(), password: ADMIN.password }).expect(429);
    expect(locked.body.error.message).toMatch(/Muitas tentativas/);
    // as tentativas ficam no registro de auditoria
    const log = await container.db.audit.list({ limit: 20, entity: 'auth' });
    expect(log.filter((l) => l.action === 'login_failed')).toHaveLength(5);
  });

  it('senha certa não conta como erro e outro e-mail não é afetado', async () => {
    const { api } = await setup();
    for (let i = 0; i < 4; i++) await api.post('/api/auth/login').send({ email: ADMIN.email, password: 'senha-errada-1' }).expect(401);
    await api.post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password }).expect(200);
    await api.post('/api/auth/login').send({ email: 'outra@karollapet.test', password: 'senha-errada-1' }).expect(401);
  });

  it('área do cliente também é bloqueada após 5 erros', async () => {
    const { api } = await setup();
    await api.post('/api/account/signup').send({ name: 'Bia Lima', email: 'bia@exemplo.com', whatsapp: '(11) 95555-7070', password: 'Cliente2026', acceptPrivacy: true }).expect(201);
    for (let i = 0; i < 5; i++) await api.post('/api/account/login').send({ email: 'bia@exemplo.com', password: 'Errada2026' }).expect(401);
    await api.post('/api/account/login').send({ email: 'bia@exemplo.com', password: 'Cliente2026' }).expect(429);
  });
});
