import { randomBytes } from 'node:crypto';
import type { Env } from './config/env';
import type { DatabaseService } from './repositories/types';
import { MemoryDatabase } from './repositories/memory/MemoryDatabase';
import { SupabaseDatabase } from './repositories/supabase/SupabaseDatabase';
import { demoSettings, seedDemoData } from './seed/demoData';
import type { AuthService } from './integrations/auth/AuthService';
import { MockAuthService } from './integrations/auth/MockAuthService';
import { SupabaseAuthService } from './integrations/auth/SupabaseAuthService';
import type { WhatsAppService } from './integrations/whatsapp/WhatsAppService';
import { DisabledWhatsAppProvider, WhatsAppCloudApiProvider, WhatsAppLinkProvider } from './integrations/whatsapp/providers';
import type { GoogleSheetsService } from './integrations/sheets/GoogleSheetsService';
import { DisabledGoogleSheetsService, WebhookGoogleSheetsService } from './integrations/sheets/providers';
import type { MediaStorage } from './integrations/storage/MediaStorage';
import { MemoryMediaStorage, SupabaseMediaStorage } from './integrations/storage/providers';
import { DisabledInstagramFeed, GraphInstagramFeed, type InstagramFeedService } from './integrations/instagram/InstagramFeedService';
import { MediaService } from './services/MediaService';
import { CatalogService } from './services/CatalogService';
import { ScheduleService } from './services/ScheduleService';
import { NotificationService } from './services/NotificationService';
import { BookingService } from './services/BookingService';
import { AppointmentService } from './services/AppointmentService';
import { CustomerService } from './services/CustomerService';
import { systemClock, type Clock } from './utils/clock';
import { logger } from './utils/logger';

/**
 * Composição de dependências (injeção manual).
 * É AQUI que se escolhe cada implementação: demo × produção, mock × real.
 */
export interface Container {
  env: Env;
  clock: Clock;
  db: DatabaseService;
  auth: AuthService;
  whatsapp: WhatsAppService;
  sheets: GoogleSheetsService;
  catalog: CatalogService;
  schedule: ScheduleService;
  notifications: NotificationService;
  booking: BookingService;
  appointments: AppointmentService;
  customers: CustomerService;
  storage: MediaStorage;
  instagram: InstagramFeedService;
  media: MediaService;
}

export interface ContainerOverrides {
  clock?: Clock;
  db?: DatabaseService;
  auth?: AuthService;
  whatsapp?: WhatsAppService;
  sheets?: GoogleSheetsService;
  storage?: MediaStorage;
  instagram?: InstagramFeedService;
}

export async function buildContainer(env: Env, overrides: ContainerOverrides = {}): Promise<Container> {
  const clock = overrides.clock ?? systemClock;

  let db = overrides.db;
  if (!db) {
    if (env.DATABASE_PROVIDER === 'supabase') {
      db = new SupabaseDatabase(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);
    } else {
      const memory = new MemoryDatabase(demoSettings(env));
      await seedDemoData(memory, { now: clock.now(), timezone: env.TIMEZONE, adminEmail: env.DEMO_ADMIN_EMAIL });
      db = memory;
    }
  }

  let auth = overrides.auth;
  if (!auth) {
    if (env.AUTH_PROVIDER === 'supabase') {
      auth = new SupabaseAuthService(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, db.admins);
    } else {
      const email = env.DEMO_ADMIN_EMAIL ?? 'admin@karollapet.demo';
      // Sem senha no código: se não definida no .env, gera uma aleatória e mostra no console.
      const password = env.DEMO_ADMIN_PASSWORD ?? randomBytes(9).toString('base64url');
      if (!env.DEMO_ADMIN_PASSWORD) {
        logger.warn(`[DEMO] DEMO_ADMIN_PASSWORD não definida. Login temporário: ${email} / ${password}`);
      }
      auth = new MockAuthService({
        email,
        password,
        secret: env.AUTH_TOKEN_SECRET ?? randomBytes(32).toString('hex'),
        ttlHours: env.AUTH_TOKEN_TTL_HOURS,
      });
    }
  }

  const whatsapp =
    overrides.whatsapp ??
    (env.WHATSAPP_PROVIDER === 'cloud_api'
      ? new WhatsAppCloudApiProvider({
          token: env.WHATSAPP_CLOUD_TOKEN!,
          phoneNumberId: env.WHATSAPP_CLOUD_PHONE_NUMBER_ID!,
          apiVersion: env.WHATSAPP_CLOUD_API_VERSION,
          timeoutMs: env.INTEGRATION_TIMEOUT_MS,
        })
      : env.WHATSAPP_PROVIDER === 'disabled'
        ? new DisabledWhatsAppProvider()
        : new WhatsAppLinkProvider());

  const sheets =
    overrides.sheets ??
    (env.GOOGLE_SHEETS_WEBHOOK
      ? new WebhookGoogleSheetsService({ url: env.GOOGLE_SHEETS_WEBHOOK, secret: env.GOOGLE_SHEETS_WEBHOOK_SECRET, timeoutMs: env.INTEGRATION_TIMEOUT_MS })
      : new DisabledGoogleSheetsService());

  const storage =
    overrides.storage ??
    (db instanceof SupabaseDatabase
      ? new SupabaseMediaStorage(db.rawClient, { url: env.SUPABASE_URL!, anonKey: env.SUPABASE_ANON_KEY ?? '' })
      : new MemoryMediaStorage());

  const instagram =
    overrides.instagram ??
    (env.INSTAGRAM_ACCESS_TOKEN
      ? new GraphInstagramFeed({ accessToken: env.INSTAGRAM_ACCESS_TOKEN, apiVersion: env.INSTAGRAM_API_VERSION, limit: 12, cacheMs: 30 * 60_000, timeoutMs: env.INTEGRATION_TIMEOUT_MS })
      : new DisabledInstagramFeed());

  const catalog = new CatalogService(db, env.APP_MODE, clock);
  const schedule = new ScheduleService(db, clock);
  const notifications = new NotificationService(db, whatsapp, sheets);
  const booking = new BookingService(db, catalog, schedule, notifications);
  const appointments = new AppointmentService(db, catalog, schedule, notifications, clock);
  const customers = new CustomerService(db);

  const media = new MediaService(db, storage, clock);

  return { env, clock, db, auth, whatsapp, sheets, catalog, schedule, notifications, booking, appointments, customers, storage, instagram, media };
}
