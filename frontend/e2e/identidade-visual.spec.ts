import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers';

/** Contraste WCAG AA (axe-core) e ausência de rolagem horizontal nas telas principais. */
async function checkPage(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400); // animações de entrada
  const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  const problems = results.violations.flatMap((v) => v.nodes.map((n) => `${path}: ${n.target.join(' ')} — ${n.any[0]?.message ?? v.help}`));
  expect(problems, problems.join('\n')).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${path} tem rolagem horizontal`).toBeLessThanOrEqual(0);
}

test('celular de 320px: título do hero e agenda do painel cabem na tela', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const right = await page.evaluate(() => Math.max(...[...document.querySelectorAll('#hero-titulo, #hero-titulo span, #hero-titulo ~ p, #hero-titulo ~ div a')].map((e) => e.getBoundingClientRect().right)));
  expect(right).toBeLessThanOrEqual(320);
  await loginAsAdmin(page);
  await page.goto('/admin/agenda');
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

for (const path of ['/', '/inspiracoes', '/agendar', '/privacidade', '/pagina-que-nao-existe']) {
  test(`contraste AA e sem rolagem horizontal: ${path}`, async ({ page }) => {
    await checkPage(page, path);
  });
}

test('contraste AA no painel: login, dashboard e configurações', async ({ page }) => {
  await checkPage(page, '/admin/login');
  await loginAsAdmin(page);
  await checkPage(page, '/admin');
  await checkPage(page, '/admin/configuracoes');
});

test('logo oficial no cabeçalho com alt, link para a home e favicons novos', async ({ page }) => {
  await page.goto('/inspiracoes');
  const logo = page.getByRole('banner').getByRole('img', { name: 'KarollaPet' });
  await expect(logo).toBeVisible();
  await logo.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#6A1FA0');
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return { title: getComputedStyle(document.querySelector('h1')!).fontFamily, body: getComputedStyle(document.body).fontFamily };
  });
  expect(fonts.body).toContain('Nunito');
  expect(fonts.title).toContain('Pacifico');
});
