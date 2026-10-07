import { expect, test } from '@playwright/test';
import { ADMIN, next } from './helpers';

test('dia sem horários oferece escolher outra data', async ({ page, request }) => {
  const login = await request.post('/api/auth/login', { data: ADMIN });
  const { token } = await login.json();
  const catalog = await (await request.get('/api/public/catalog')).json();
  // bloqueia o dia inteiro de 2 dias à frente, se for dia útil, com bloqueio de horário (o dia continua clicável)
  const base = new Date(Date.now() + 3 * 86_400_000);
  let date = base.toISOString().slice(0, 10);
  for (let i = 0; i < 7; i++) {
    const d = new Date(base.getTime() + i * 86_400_000);
    const h = catalog.businessHours.find((x: { weekday: number }) => x.weekday === d.getUTCDay());
    if (h?.isOpen) { date = d.toISOString().slice(0, 10); break; }
  }
  await request.post('/api/admin/blocked-times', { headers: { Authorization: `Bearer ${token}` }, data: { date, startTime: '00:00', endTime: '23:59', reason: 'teste' } });

  await page.goto('/agendar');
  await page.getByTestId('species-cat').click();
  await page.getByLabel(/Nome do pet/).fill('Lua');
  await page.getByRole('combobox', { name: 'Raça' }).fill('pers');
  await page.getByRole('option', { name: 'Persa' }).click();
  await page.getByTestId('size-pequeno').click();
  await next(page);
  await page.getByTestId('service-banho').click();
  await next(page);
  await next(page);
  if (date.slice(0, 7) !== new Date().toISOString().slice(0, 7)) await page.getByRole('button', { name: 'Próximo mês' }).click();
  await page.locator(`button[data-date="${date}"]`).click();
  await next(page);
  await expect(page.getByText('Sem horários livres nesta data')).toBeVisible();
  await page.getByRole('button', { name: 'Escolher outra data' }).click();
  await expect(page.getByText('Escolha a data')).toBeVisible();
});
