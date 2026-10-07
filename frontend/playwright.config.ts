import { defineConfig, devices } from '@playwright/test';

/**
 * Testes ponta a ponta: sobem a API em modo DEMO (porta 3334) e o front-end (porta 5174).
 * Rodam o fluxo completo em desktop e em celular.
 */
const API_PORT = 3334;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'npx tsx src/server.ts',
      cwd: '../backend',
      port: API_PORT,
      reuseExistingServer: false,
      env: {
        PORT: String(API_PORT),
        APP_MODE: 'demo',
        DEMO_ADMIN_EMAIL: 'carol@karollapet.test',
        DEMO_ADMIN_PASSWORD: 'senha-e2e-123',
        AUTH_TOKEN_SECRET: 'e2e-secret',
        WHATSAPP_NUMBER: '5511900000000',
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        NODE_ENV: 'test',
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      port: WEB_PORT,
      reuseExistingServer: false,
      env: { VITE_DEV_API_PROXY: `http://localhost:${API_PORT}` },
    },
  ],
});
