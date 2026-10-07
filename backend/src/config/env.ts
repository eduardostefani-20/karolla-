import { z } from 'zod';

/**
 * Configuração do servidor, lida APENAS de variáveis de ambiente.
 * Segredos (service role, tokens, senhas) nunca são enviados ao front-end.
 */

// Carrega ../.env ou ./.env se existir (Node >= 20.12). Variáveis já definidas não são sobrescritas.
for (const file of ['.env', '../.env']) {
  try {
    process.loadEnvFile(file);
    break;
  } catch {
    /* arquivo ausente: segue com o ambiente atual */
  }
}

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optional = z.preprocess(emptyToUndefined, z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3333),
  APP_MODE: z.enum(['demo', 'production']).default('demo'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  PUBLIC_SITE_URL: z.string().default('http://localhost:5173'),
  TIMEZONE: z.string().default('America/Sao_Paulo'),

  DATABASE_PROVIDER: z.preprocess(emptyToUndefined, z.enum(['memory', 'supabase']).optional()),
  SUPABASE_URL: optional,
  SUPABASE_ANON_KEY: optional,
  SUPABASE_SERVICE_ROLE_KEY: optional,

  AUTH_PROVIDER: z.preprocess(emptyToUndefined, z.enum(['mock', 'supabase']).optional()),
  AUTH_TOKEN_SECRET: optional,
  AUTH_TOKEN_TTL_HOURS: z.coerce.number().positive().default(12),
  DEMO_ADMIN_EMAIL: optional,
  DEMO_ADMIN_PASSWORD: optional,

  WHATSAPP_PROVIDER: z.preprocess(emptyToUndefined, z.enum(['link', 'cloud_api', 'disabled']).default('link')),
  WHATSAPP_NUMBER: optional,
  WHATSAPP_CLOUD_TOKEN: optional,
  WHATSAPP_CLOUD_PHONE_NUMBER_ID: optional,
  WHATSAPP_CLOUD_API_VERSION: z.string().default('v21.0'),

  GOOGLE_SHEETS_WEBHOOK: optional,
  GOOGLE_SHEETS_WEBHOOK_SECRET: optional,

  INTEGRATION_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
});

export type Env = z.infer<typeof envSchema> & {
  DATABASE_PROVIDER: 'memory' | 'supabase';
  AUTH_PROVIDER: 'mock' | 'supabase';
};

export class ConfigError extends Error {}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ConfigError(`Configuração inválida: ${details}`);
  }
  const e = parsed.data;
  const isProd = e.APP_MODE === 'production';
  const env: Env = {
    ...e,
    DATABASE_PROVIDER: e.DATABASE_PROVIDER ?? (isProd ? 'supabase' : 'memory'),
    AUTH_PROVIDER: e.AUTH_PROVIDER ?? (isProd ? 'supabase' : 'mock'),
  };

  // Regras de segurança: produção nunca roda com banco em memória ou autenticação mock.
  if (isProd) {
    if (env.DATABASE_PROVIDER !== 'supabase') throw new ConfigError('APP_MODE=production exige DATABASE_PROVIDER=supabase.');
    if (env.AUTH_PROVIDER !== 'supabase') throw new ConfigError('APP_MODE=production exige AUTH_PROVIDER=supabase.');
  }
  if (env.DATABASE_PROVIDER === 'supabase' && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new ConfigError('DATABASE_PROVIDER=supabase exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  }
  if (env.AUTH_PROVIDER === 'supabase' && (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new ConfigError('AUTH_PROVIDER=supabase exige SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.');
  }
  if (env.WHATSAPP_PROVIDER === 'cloud_api' && (!env.WHATSAPP_CLOUD_TOKEN || !env.WHATSAPP_CLOUD_PHONE_NUMBER_ID)) {
    throw new ConfigError('WHATSAPP_PROVIDER=cloud_api exige WHATSAPP_CLOUD_TOKEN e WHATSAPP_CLOUD_PHONE_NUMBER_ID.');
  }
  return env;
}
