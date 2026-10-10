import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { ADMIN, loginAsAdmin, next, openAdminMenu, pickFirstAvailableSlot } from './helpers';

const PIXELS = { metaPixelId: '123456789012345', googleAdsId: 'AW-987654321', googleAdsBookingLabel: 'AgendLabel1', googleAdsWhatsappLabel: '', tiktokPixelId: 'C4ABCDEF123GHIJ456KL' };

async function adminAuth(request: APIRequestContext) {
  const login = await (await request.post('/api/auth/login', { data: ADMIN })).json();
  return { Authorization: `Bearer ${login.token}` };
}

async function setPixels(request: APIRequestContext, values: Partial<typeof PIXELS>) {
  const headers = await adminAuth(request);
  const current = await (await request.get('/api/admin/settings', { headers })).json();
  const res = await request.put('/api/admin/settings', { headers, data: { ...current, ...values } });
  expect(res.status()).toBe(200);
}

/** Os scripts reais da Meta/Google/TikTok não são baixados no teste: respondemos com um arquivo vazio e contamos os pedidos. */
async function stubPixelScripts(page: Page) {
  const requested: string[] = [];
  for (const pattern of ['**/connect.facebook.net/**', '**/www.googletagmanager.com/**', '**/analytics.tiktok.com/**']) {
    await page.route(pattern, (route) => {
      requested.push(new URL(route.request().url()).hostname);
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    });
  }
  return requested;
}

test.afterEach(async ({ request }) => {
  // os outros testes rodam sem pixels (e sem o aviso de cookies)
  await setPixels(request, { metaPixelId: '', googleAdsId: '', googleAdsBookingLabel: '', googleAdsWhatsappLabel: '', tiktokPixelId: '' });
});

test('sem pixels configurados não há aviso de cookies nem scripts de anúncio', async ({ page }) => {
  const requested = await stubPixelScripts(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('consent-banner')).toHaveCount(0);
  await page.goto('/privacidade');
  await expect(page.getByRole('heading', { name: 'Política de privacidade' })).toBeVisible();
  await expect(page.getByText('No momento o site não usa cookies de anúncios.')).toBeVisible();
  expect(requested).toEqual([]);
});

test('LGPD + anúncios: nada carrega antes do "Aceitar"; agendamento vira conversão e a origem aparece no painel', async ({ page, request }) => {
  const project = test.info().project.name;
  const campaign = `e2e-${project}`;
  const pet = project === 'mobile' ? 'Fubá Cel' : 'Fubá Desk';
  await setPixels(request, PIXELS);
  const requested = await stubPixelScripts(page);

  // 1. Chega por um link de anúncio do Instagram; recusa os cookies → nenhum pixel
  await page.goto(`/?utm_source=instagram&utm_medium=paid&utm_campaign=${campaign}&fbclid=IwAR-teste`);
  const banner = page.getByTestId('consent-banner');
  await expect(banner).toContainText('Meta (Instagram/Facebook), Google Ads e TikTok');
  await banner.getByRole('button', { name: 'Recusar' }).click();
  await expect(banner).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(banner).toHaveCount(0);
  expect(requested).toEqual([]);
  expect(await page.evaluate(() => typeof window.fbq)).toBe('undefined');

  // 2. Muda de ideia pelo rodapé e aceita → os três pixels carregam
  await page.getByRole('button', { name: 'Preferências de cookies' }).click();
  await banner.getByRole('button', { name: 'Aceitar' }).click();
  await expect.poll(() => [...new Set(requested)].sort()).toEqual(['analytics.tiktok.com', 'connect.facebook.net', 'www.googletagmanager.com']);

  // 3. Agenda: InitiateCheckout + Schedule (com valor) para Meta, TikTok e conversão do Google Ads
  await page.goto('/agendar');
  await page.getByTestId('species-dog').click();
  await page.getByLabel(/Nome do pet/).fill(pet);
  await page.getByRole('combobox', { name: 'Raça' }).fill('pug');
  await page.getByRole('option', { name: 'Pug' }).click();
  await page.getByTestId('size-pequeno').click();
  await next(page);
  await page.getByTestId('service-banho').click();
  await next(page);
  await next(page);
  await pickFirstAvailableSlot(page);
  await next(page);
  await page.getByLabel(/Nome completo/).fill('Cliente Anúncio');
  await page.getByLabel(/WhatsApp/).fill(project === 'mobile' ? '11981239001' : '11981239002');
  await page.getByLabel(/E-mail/).fill('anuncio@exemplo.com');
  await page.getByLabel(/Endereço \(rua/).fill('Rua das Flores');
  await page.getByLabel(/^Número/).fill('10');
  await page.getByLabel(/Bairro/).fill('Centro');
  await page.getByLabel(/Cidade/).fill('São Paulo');
  await next(page);
  await page.getByRole('button', { name: /CONFIRMAR AGENDAMENTO/ }).click();
  await expect(page.getByTestId('confirmation-title')).toBeVisible();

  const events = await page.evaluate(() => ({
    meta: ((window.fbq as unknown as { queue: unknown[][] }).queue ?? []).map((a) => Array.from(a as ArrayLike<unknown>)),
    google: (window.dataLayer ?? []).map((a) => Array.from(a as ArrayLike<unknown>)),
    tiktok: Array.from(window.ttq as unknown as unknown[][]).filter(Array.isArray),
  }));
  expect(events.meta).toContainEqual(['init', PIXELS.metaPixelId]);
  expect(events.meta.some((e) => e[0] === 'track' && e[1] === 'InitiateCheckout')).toBe(true);
  const metaSchedule = events.meta.find((e) => e[0] === 'track' && e[1] === 'Schedule');
  expect(metaSchedule?.[2]).toMatchObject({ value: 55, currency: 'BRL' });
  expect((metaSchedule?.[3] as { eventID: string }).eventID).toBeTruthy();
  const conversion = events.google.find((e) => e[0] === 'event' && e[1] === 'conversion');
  expect(conversion?.[2]).toMatchObject({ send_to: 'AW-987654321/AgendLabel1', value: 55, currency: 'BRL' });
  expect(events.tiktok.find((e) => e[0] === 'track' && e[1] === 'Schedule')?.[2]).toMatchObject({ value: 55, currency: 'BRL' });

  // 4. Painel (sem pixels nem aviso) mostra a origem no agendamento e no dashboard
  await loginAsAdmin(page);
  await expect(banner).toHaveCount(0);
  await expect(page.getByTestId('dashboard-channels')).toContainText('Meta Ads (Instagram/Facebook)');
  await openAdminMenu(page, 'Agendamentos');
  await page.getByPlaceholder('Pet, cliente ou WhatsApp').fill(pet);
  await page.getByTestId('appointment-card').filter({ hasText: pet }).first().click();
  await expect(page.getByTestId('appointment-origin')).toContainText('Meta Ads (Instagram/Facebook)');
  await expect(page.getByText(campaign)).toBeVisible();
});

test('painel valida e salva os IDs dos pixels', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminMenu(page, 'Configurações');
  await page.getByLabel('Pixel da Meta (Instagram/Facebook)').fill('<script>fbq()</script>');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(page.getByText('O ID do Pixel da Meta tem só números')).toBeVisible();
  await page.getByLabel('Pixel da Meta (Instagram/Facebook)').fill('123456789012345');
  await page.getByLabel('Google Ads — ID da tag').fill('aw-987654321');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(page.getByText('Configurações salvas.')).toBeVisible();
  await expect(page.getByLabel('Google Ads — ID da tag')).toHaveValue('AW-987654321');
});
