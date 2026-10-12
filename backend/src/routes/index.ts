import express, { Router, type RequestHandler } from 'express';
import { MemoryMediaStorage } from '../integrations/storage/providers';
import type { Container } from '../container';
import { asyncHandler as h } from '../utils/asyncHandler';
import { auditTrail, can, canAny, linkedCustomer, redactResponses, requireCustomer, requireFeatures, requireStaff } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { publicController } from '../controllers/publicController';
import { authController } from '../controllers/authController';
import { adminController } from '../controllers/adminController';
import { teamController } from '../controllers/teamController';
import { accountController } from '../controllers/accountController';
import { planController } from '../controllers/planController';
import { MemoryPrivateStorage } from '../integrations/storage/PrivateStorage';

/** Dados pessoais: o navegador/proxy não guarda cópia. */
const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
};

export function buildRoutes(c: Container): Router {
  const router = Router();
  const pub = publicController(c);
  const auth = authController(c);
  const admin = adminController(c);
  const team = teamController(c);
  const acc = accountController(c);
  const plan = planController(c);
  const isTest = c.env.NODE_ENV === 'test';
  const ready = requireFeatures(c.db); // recursos que dependem da migração 0009
  const ready10 = requireFeatures(c.db, 10); // novos status, agenda por profissional e planos (0010)

  router.get('/health', (_req, res) => {
    res.json({ ok: true, mode: c.env.APP_MODE });
  });

  // ---------------- Público ----------------
  router.get('/public/catalog', h(pub.catalog));
  router.get('/public/availability', h(pub.availability));
  router.get('/public/inspirations', h(pub.inspirations));
  router.get('/public/inspirations/:id', h(pub.inspiration));
  router.get('/public/stories', h(pub.stories));
  router.get('/public/instagram-feed', h(pub.instagramFeed));
  router.post(
    '/public/appointments',
    rateLimit({ keyPrefix: 'booking', windowMs: 60 * 60 * 1000, max: isTest ? 10_000 : 20, message: 'Muitos agendamentos em sequência. Fale com a Karolla Pet pelo WhatsApp.' }),
    h(pub.createAppointment),
  );

  // ---------------- Autenticação (equipe) ----------------
  const loginLimit = rateLimit({ keyPrefix: 'login', windowMs: 15 * 60 * 1000, max: isTest ? 10_000 : 10 });
  const resetLimit = rateLimit({ keyPrefix: 'pwreset', windowMs: 60 * 60 * 1000, max: isTest ? 10_000 : 5, message: 'Muitos pedidos de redefinição. Tente de novo mais tarde.' });
  const staffOnly = requireStaff(c.auth, c.staff);
  router.post('/auth/login', loginLimit, h(auth.login));
  router.post('/auth/refresh', rateLimit({ keyPrefix: 'refresh', windowMs: 15 * 60 * 1000, max: isTest ? 10_000 : 60 }), h(auth.refresh));
  router.get('/auth/me', staffOnly, h(auth.me));
  router.post('/auth/logout', h(auth.logout));
  router.post('/auth/forgot-password', resetLimit, h(auth.forgotPassword));
  router.post('/auth/reset-password', resetLimit, h(auth.resetPassword));
  router.post('/auth/change-password', loginLimit, staffOnly, auditTrail(c.db), h(auth.changePassword));

  // ---------------- Administrativo (sempre autenticado; permissão conferida em cada rota) ----------------
  const a = Router();
  a.use(staffOnly, redactResponses(), auditTrail(c.db));

  a.get('/dashboard', can('dashboard.view'), h(admin.dashboard));
  a.get('/system-status', can('settings.view'), h(admin.systemStatus));

  a.get('/appointments', can('agenda.view'), h(admin.listAppointments));
  a.post('/appointments', can('agenda.create'), h(admin.createAppointment));
  a.post('/appointments/:id/notify-pickup', ready, can('agenda.confirm', 'customers.view'), h(admin.notifyPickup));
  a.get('/appointments/:id', can('agenda.view'), h(admin.getAppointment));
  a.patch('/appointments/:id', can('agenda.edit'), h(admin.updateAppointment));
  a.patch('/appointments/:id/status', can('agenda.confirm'), h(admin.updateAppointmentStatus));
  a.post('/appointments/:id/resend-notifications', can('agenda.edit'), h(admin.resendNotifications));

  a.get('/customers', can('customers.view'), h(admin.listCustomers));
  a.get('/customers/:id', can('customers.view'), h(admin.getCustomer));
  a.patch('/customers/:id', can('customers.edit'), h(admin.updateCustomer));
  a.get('/pets', can('pets.view'), h(admin.listPets));
  a.get('/pets/:id', can('pets.view'), h(admin.getPet));
  a.patch('/pets/:id', can('pets.edit'), h(admin.updatePet));
  a.post('/pets/:id/upload-ticket', ready, can('pets.edit'), h(admin.petUploadTicket));
  a.put('/pets/:id/photo', ready, can('pets.edit'), h(admin.setPetPhoto));
  a.post('/pets/:id/references', ready, can('pets.edit'), h(admin.addPetReference));
  a.delete('/pets/:id/references/:refId', ready, can('pets.edit'), h(admin.removePetReference));
  a.post('/customers/:id/link-account', can('customers.edit'), h(admin.linkAccount));
  a.delete('/customers/:id/link-account', can('customers.edit'), h(admin.unlinkAccount));

  // CRM (o telefone aparece na lista, por isso exige também "Clientes → Ver")
  a.get('/crm', ready, can('crm.view', 'customers.view'), h(admin.crm));
  a.post('/customers/:id/contacts', ready, can('crm.edit', 'customers.view'), h(admin.startContact));
  a.patch('/contacts/:id', ready, can('crm.edit'), h(admin.updateContact));

  // Catálogo: leitura liberada para quem usa a agenda (nomes de serviços/portes). Valores saem sem "finance.view".
  a.get('/catalog', canAny('services.view', 'agenda.view', 'professionals.view'), h(admin.catalog));
  a.post('/services', can('services.create'), h(admin.createService));
  a.post('/services/reorder', can('services.edit'), h(admin.reorder('services')));
  a.patch('/services/:id', can('services.edit'), h(admin.updateService));
  a.delete('/services/:id', can('services.delete'), h(admin.deleteService));
  a.put('/prices', can('services.edit', 'finance.edit'), h(admin.savePrices));
  a.post('/addons', can('services.create'), h(admin.createAddon));
  a.post('/addons/reorder', can('services.edit'), h(admin.reorder('addons')));
  a.patch('/addons/:id', can('services.edit'), h(admin.updateAddon));
  a.delete('/addons/:id', can('services.delete'), h(admin.deleteAddon));
  a.post('/species', can('services.create'), h(admin.createSpecies));
  a.patch('/species/:id', can('services.edit'), h(admin.updateSpecies));
  a.delete('/species/:id', can('services.delete'), h(admin.deleteSpecies));
  a.post('/breeds', can('services.create'), h(admin.createBreed));
  a.patch('/breeds/:id', can('services.edit'), h(admin.updateBreed));
  a.delete('/breeds/:id', can('services.delete'), h(admin.deleteBreed));
  a.post('/sizes', can('services.create'), h(admin.createSize));
  a.post('/sizes/reorder', can('services.edit'), h(admin.reorder('sizes')));
  a.patch('/sizes/:id', can('services.edit'), h(admin.updateSize));
  a.delete('/sizes/:id', can('services.delete'), h(admin.deleteSize));
  a.put('/form-fields', can('services.edit'), h(admin.saveFormFields));

  a.post('/professionals', can('professionals.create'), h(admin.createProfessional));
  a.post('/professionals/reorder', can('professionals.edit'), h(admin.reorder('professionals')));
  a.patch('/professionals/:id', can('professionals.edit'), h(admin.updateProfessional));
  a.delete('/professionals/:id', can('professionals.delete'), h(admin.deleteProfessional));
  a.post('/professional-time-off', ready10, can('professionals.edit'), h(admin.addProfessionalTimeOff));
  a.delete('/professional-time-off/:id', ready10, can('professionals.edit'), h(admin.removeProfessionalTimeOff));

  a.post('/media/upload-ticket', canAny('inspirations.create', 'inspirations.edit'), h(admin.uploadTicket));
  a.get('/inspirations', can('inspirations.view'), h(admin.listInspirations));
  a.post('/inspirations', can('inspirations.create'), h(admin.createInspiration));
  a.patch('/inspirations/:id', can('inspirations.edit'), h(admin.updateInspiration));
  a.delete('/inspirations/:id', can('inspirations.delete'), h(admin.deleteInspiration));
  a.get('/stories', can('inspirations.view'), h(admin.listStories));
  a.post('/stories', can('inspirations.create'), h(admin.createStory));
  a.delete('/stories/:id', can('inspirations.delete'), h(admin.deleteStory));

  a.get('/schedule', canAny('settings.view', 'agenda.view'), h(admin.getSchedule));
  a.put('/business-hours', can('settings.edit'), h(admin.saveBusinessHours));
  a.post('/blocked-dates', can('settings.edit'), h(admin.addBlockedDate));
  a.delete('/blocked-dates/:id', can('settings.edit'), h(admin.removeBlockedDate));
  a.post('/blocked-times', can('settings.edit'), h(admin.addBlockedTime));
  a.delete('/blocked-times/:id', can('settings.edit'), h(admin.removeBlockedTime));
  a.get('/settings', canAny('settings.view', 'agenda.view'), h(admin.getSettings));
  a.put('/settings', can('settings.edit'), h(admin.updateSettings));

  // Planos e mensalidades (sem pagamento online; pagamento registrado por quem tem "Planos → Confirmar")
  a.get('/plans', ready10, can('plans.view'), h(plan.list));
  a.post('/plans', ready10, can('plans.create'), h(plan.create));
  a.patch('/plans/:id', ready10, can('plans.edit'), h(plan.update));
  a.delete('/plans/:id', ready10, can('plans.delete'), h(plan.remove));
  a.get('/customer-plans', ready10, can('plans.view'), h(plan.subscriptions));
  a.post('/customer-plans', ready10, can('plans.create'), h(plan.subscribe));
  a.get('/customer-plans/:id', ready10, can('plans.view'), h(plan.subscription));
  a.patch('/customer-plans/:id', ready10, can('plans.edit'), h(plan.updateSubscription));
  a.post('/customer-plans/:id/payments', ready10, can('plans.confirm'), h(plan.recordPayment));
  a.get('/appointments/:id/plans', ready10, can('plans.view', 'agenda.view'), h(plan.forAppointment));
  a.post('/appointments/:id/plan-usages', ready10, can('plans.edit', 'agenda.view'), h(plan.use));
  a.delete('/plan-usages/:id', ready10, can('plans.edit'), h(plan.revertUsage));

  // Equipe e permissões
  a.get('/team', can('team.view'), h(team.list));
  a.post('/team', can('team.admin'), h(team.create));
  a.patch('/team/:id', can('team.admin'), h(team.update));
  a.put('/team/:id/password', can('team.admin'), h(team.setPassword));
  a.post('/team/:id/send-reset', can('team.admin'), h(team.sendReset));
  a.get('/audit', can('team.admin'), h(team.audit));

  router.use('/admin', a);

  // ---------------- Portal do cliente (cada um só acessa o próprio cadastro) ----------------
  const accountLimit = rateLimit({ keyPrefix: 'account', windowMs: 15 * 60 * 1000, max: isTest ? 10_000 : 10 });
  const signupLimit = rateLimit({ keyPrefix: 'signup', windowMs: 60 * 60 * 1000, max: isTest ? 10_000 : 5, message: 'Muitos cadastros em sequência. Tente mais tarde.' });
  router.post('/account/signup', ready, signupLimit, h(acc.signUp));
  router.post('/account/login', ready, accountLimit, h(acc.login));
  router.post('/account/refresh', ready, rateLimit({ keyPrefix: 'account-refresh', windowMs: 15 * 60 * 1000, max: isTest ? 10_000 : 60 }), h(acc.refresh));
  router.post('/account/logout', h(acc.logout));
  const me = Router();
  me.use(ready, requireCustomer(c.auth, c.account), noStore);
  me.get('/', h(acc.me));
  me.patch('/', linkedCustomer, h(acc.updateProfile));
  me.post('/email', accountLimit, h(acc.changeEmail));
  me.get('/pets', linkedCustomer, h(acc.pets));
  me.post('/pets', linkedCustomer, h(acc.createPet));
  me.get('/pets/:id', linkedCustomer, h(acc.pet));
  me.patch('/pets/:id', linkedCustomer, h(acc.updatePet));
  me.post('/pets/:id/upload-ticket', linkedCustomer, rateLimit({ keyPrefix: 'upload', windowMs: 60 * 60 * 1000, max: isTest ? 10_000 : 40 }), h(acc.uploadTicket));
  me.put('/pets/:id/photo', linkedCustomer, h(acc.setPhoto));
  me.post('/pets/:id/references', linkedCustomer, h(acc.addReference));
  me.delete('/references/:id', linkedCustomer, h(acc.removeReference));
  me.get('/appointments', linkedCustomer, h(acc.appointments));
  me.get('/plans', ready10, linkedCustomer, h(acc.plans));
  router.use('/account/me', me);

  // ---------------- Arquivos PRIVADOS do modo DEMO (em produção: bucket privado do Supabase) ----------------
  if (c.privateStorage instanceof MemoryPrivateStorage) {
    const priv = c.privateStorage;
    router.put('/private-upload/:token', express.raw({ type: () => true, limit: '10mb' }), (req, res) => {
      priv.receive(String(req.params.token), req.body as Buffer, String(req.headers['content-type'] ?? ''));
      res.status(204).end();
    });
    router.get('/private-files/:token', (req, res) => {
      const file = priv.read(String(req.params.token));
      if (!file) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Link expirado.' } });
      res.set('Content-Type', file.contentType).set('Cache-Control', 'private, no-store').send(file.body);
    });
  }

  // ---------------- Mídia do modo DEMO (em produção os arquivos ficam no Supabase Storage) ----------------
  if (c.storage instanceof MemoryMediaStorage) {
    const storage = c.storage;
    router.put('/media/upload/:token', express.raw({ type: () => true, limit: '60mb' }), (req, res) => {
      storage.receive(String(req.params.token), req.body as Buffer, String(req.headers['content-type'] ?? ''));
      res.status(204).end();
    });
    router.get('/media/files/*', (req, res) => {
      const file = storage.get(String((req.params as Record<string, string>)[0]));
      if (!file) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Arquivo não encontrado.' } });
      res.set('Content-Type', file.contentType).set('Cache-Control', 'public, max-age=3600').send(file.body);
    });
  }
  return router;
}
