import { loadEnv } from './config/env';
import { buildContainer } from './container';
import { createApp } from './app';
import { errorMeta, logger } from './utils/logger';

async function main() {
  const env = loadEnv();
  const container = await buildContainer(env);
  const app = createApp(container);
  app.listen(env.PORT, () => {
    logger.info(`Karolla Pet API ouvindo em http://localhost:${env.PORT}`, {
      mode: env.APP_MODE,
      database: container.db.provider,
      auth: container.auth.provider,
      whatsapp: container.whatsapp.provider,
      sheets: container.sheets.provider,
    });
    if (env.APP_MODE === 'demo') {
      logger.warn('MODO DEMO: dados fictícios em memória. Nenhuma integração real está conectada além das configuradas no .env.');
    }
  });
}

main().catch((err) => {
  logger.error('Falha ao iniciar a API', errorMeta(err));
  process.exit(1);
});
