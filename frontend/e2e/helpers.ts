import { expect, type Page } from '@playwright/test';

export const ADMIN = { email: 'carol@karollapet.test', password: 'senha-e2e-123' };

/** Clica em "Continuar" (botão principal da navegação do agendamento). */
export async function next(page: Page) {
  await page.getByRole('button', { name: /^Continuar/ }).click();
}

/** Escolhe a primeira data com horário livre e o primeiro horário disponível. */
export async function pickFirstAvailableSlot(page: Page): Promise<{ time: string }> {
  for (let attempt = 0; attempt < 15; attempt++) {
    await expect(page.getByText('Escolha a data')).toBeVisible();
    const days = page.locator('button[data-date]:not([disabled])');
    const count = await days.count();
    if (attempt >= count) {
      await page.getByRole('button', { name: 'Próximo mês' }).click();
      continue;
    }
    await days.nth(attempt).click();
    await next(page);
    await expect(page.getByText('Escolha o horário')).toBeVisible();
    const slot = page.locator('[data-testid^="slot-"]').first();
    const empty = page.getByText('Sem horários livres nesta data');
    await expect(slot.or(empty)).toBeVisible();
    if (await slot.isVisible()) {
      const time = (await slot.textContent())!.trim();
      await slot.click();
      return { time };
    }
    await page.getByRole('button', { name: 'Escolher outra data' }).click();
  }
  throw new Error('Nenhum horário disponível encontrado');
}

export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('E-mail').fill(ADMIN.email);
  await page.getByLabel('Senha').fill(ADMIN.password);
  await page.getByRole('button', { name: 'ENTRAR' }).click();
  await expect(page.getByRole('heading', { name: /Olá/ })).toBeVisible();
}

/** Abre um item do menu administrativo (sidebar no desktop, gaveta no celular). */
export async function openAdminMenu(page: Page, label: string) {
  const menuButton = page.getByRole('button', { name: 'Abrir menu' });
  if (await menuButton.isVisible()) await menuButton.click();
  await page.getByRole('navigation', { name: 'Painel administrativo' }).getByRole('link', { name: label, exact: true }).click();
}
