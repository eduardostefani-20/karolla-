import { Router } from 'express';
import type { Container } from '../container';
import { asyncHandler as h } from '../utils/asyncHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { publicController } from '../controllers/publicController';
import { authController } from '../controllers/authController';
import { adminController } from '../controllers/adminController';

export function buildRoutes(c: Container): Router {
  const router = Router();
  const pub = publicController(c);
  const auth = authController(c);
  const admin = adminController(c);
  const isTest = c.env.NODE_ENV === 'test';

  router.get('/health', (_req, res) => {
    res.json({ ok: true, mode: c.env.APP_MODE });
  });

  // ---------------- Público ----------------
  router.get('/public/catalog', h(pub.catalog));
  router.get('/public/availability', h(pub.availability));
  router.post(
    '/public/appointments',
    rateLimit({ keyPrefix: 'booking', windowMs: 60 * 60 * 1000, max: isTest ? 10_000 : 20, message: 'Muitos agendamentos em sequência. Fale com a Karolla Pet pelo WhatsApp.' }),
    h(pub.createAppointment),
  );

  // ---------------- Autenticação ----------------
  router.post(
    '/auth/login',
    rateLimit({ keyPrefix: 'login', windowMs: 15 * 60 * 1000, max: isTest ? 10_000 : 10 }),
    h(auth.login),
  );
  router.get('/auth/me', requireAuth(c.auth), h(auth.me));
  router.post('/auth/logout', h(auth.logout));

  // ---------------- Administrativo (sempre autenticado) ----------------
  const a = Router();
  a.use(requireAuth(c.auth));
  const manage = requireRole('admin'); // configurações: owner/admin. Equipe (staff) opera a agenda.

  a.get('/dashboard', h(admin.dashboard));
  a.get('/system-status', h(admin.systemStatus));

  a.get('/appointments', h(admin.listAppointments));
  a.get('/appointments/:id', h(admin.getAppointment));
  a.patch('/appointments/:id', h(admin.updateAppointment));
  a.patch('/appointments/:id/status', h(admin.updateAppointmentStatus));
  a.post('/appointments/:id/resend-notifications', h(admin.resendNotifications));

  a.get('/customers', h(admin.listCustomers));
  a.get('/customers/:id', h(admin.getCustomer));
  a.patch('/customers/:id', h(admin.updateCustomer));
  a.get('/pets', h(admin.listPets));
  a.get('/pets/:id', h(admin.getPet));
  a.patch('/pets/:id', h(admin.updatePet));

  a.get('/catalog', h(admin.catalog));
  a.post('/services', manage, h(admin.createService));
  a.post('/services/reorder', manage, h(admin.reorder('services')));
  a.patch('/services/:id', manage, h(admin.updateService));
  a.delete('/services/:id', manage, h(admin.deleteService));
  a.put('/prices', manage, h(admin.savePrices));
  a.post('/addons', manage, h(admin.createAddon));
  a.post('/addons/reorder', manage, h(admin.reorder('addons')));
  a.patch('/addons/:id', manage, h(admin.updateAddon));
  a.delete('/addons/:id', manage, h(admin.deleteAddon));
  a.post('/species', manage, h(admin.createSpecies));
  a.patch('/species/:id', manage, h(admin.updateSpecies));
  a.delete('/species/:id', manage, h(admin.deleteSpecies));
  a.post('/breeds', manage, h(admin.createBreed));
  a.patch('/breeds/:id', manage, h(admin.updateBreed));
  a.delete('/breeds/:id', manage, h(admin.deleteBreed));
  a.post('/sizes', manage, h(admin.createSize));
  a.post('/sizes/reorder', manage, h(admin.reorder('sizes')));
  a.patch('/sizes/:id', manage, h(admin.updateSize));
  a.delete('/sizes/:id', manage, h(admin.deleteSize));
  a.put('/form-fields', manage, h(admin.saveFormFields));

  a.get('/schedule', h(admin.getSchedule));
  a.put('/business-hours', manage, h(admin.saveBusinessHours));
  a.post('/blocked-dates', manage, h(admin.addBlockedDate));
  a.delete('/blocked-dates/:id', manage, h(admin.removeBlockedDate));
  a.post('/blocked-times', manage, h(admin.addBlockedTime));
  a.delete('/blocked-times/:id', manage, h(admin.removeBlockedTime));
  a.get('/settings', h(admin.getSettings));
  a.put('/settings', manage, h(admin.updateSettings));

  router.use('/admin', a);
  return router;
}
