/**
 * Netlify Function que hospeda a API da Karolla Pet (o mesmo app Express de backend/).
 * Todas as chamadas /api/* do site são encaminhadas para cá (veja netlify.toml).
 * Configuração 100% por variáveis de ambiente do Netlify (Site settings → Environment variables).
 */
import serverless from 'serverless-http';
import { loadEnv } from '../../backend/src/config/env';
import { buildContainer } from '../../backend/src/container';
import { createApp } from '../../backend/src/app';

// Montado uma vez por instância da função (reaproveitado entre requisições).
const appPromise = (async () => createApp(await buildContainer(loadEnv())))();

export const handler = async (event: Parameters<ReturnType<typeof serverless>>[0], context: Parameters<ReturnType<typeof serverless>>[1]) => {
  const app = await appPromise;
  return serverless(app, {
    // Aceita tanto /api/... (rewrite) quanto /.netlify/functions/api/... (chamada direta)
    request(req: { url: string }) {
      req.url = req.url.replace(/^\/\.netlify\/functions\/api/, '/api');
    },
  })(event, context);
};
