import { expect, test } from '@playwright/test';
import { loginAsAdmin, openAdminMenu } from './helpers';

/**
 * Digitação contínua nos formulários do painel: o campo não pode perder o foco a cada letra
 * (antes, o diálogo devolvia o foco ao primeiro campo a cada tecla).
 */
const LONG = 'Banho completo com shampoo neutro, secagem cuidadosa e perfume suave — ideal para pele sensível.';

test('serviço: descrição longa digitada letra por letra, sem perder o foco, e salva', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminMenu(page, 'Serviços');
  await page.getByRole('button', { name: 'Novo serviço' }).click();
  const dialog = page.getByRole('dialog');
  const name = dialog.getByLabel(/^Nome/);
  await name.click();
  await page.keyboard.type('Banho Relax');
  await expect(name).toHaveValue('Banho Relax');
  const desc = dialog.getByLabel(/^Descrição/);
  await desc.click();
  await page.keyboard.type(LONG, { delay: 5 });
  await expect(desc).toBeFocused();
  await expect(desc).toHaveValue(LONG);
  // volta ao nome e continua escrevendo no meio do texto (posição do cursor preservada)
  await name.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Premium');
  await expect(name).toHaveValue('Banho Relax Premium');
  await expect(name).toBeFocused();
});

test('adicional e tutor: digitação contínua em vários campos', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminMenu(page, 'Adicionais');
  await page.getByRole('button', { name: /ADICIONAR/ }).click();
  const desc = page.getByRole('dialog').getByLabel(/^Descrição/);
  await desc.click();
  await page.keyboard.type(LONG, { delay: 5 });
  await expect(desc).toHaveValue(LONG);
  await expect(desc).toBeFocused();
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await openAdminMenu(page, 'Clientes');
  await page.locator('a[href^="/admin/clientes/"]').first().click();
  await page.getByRole('button', { name: /Editar/ }).first().click();
  const street = page.getByRole('dialog').getByLabel(/^Endereço/);
  await street.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Rua das Hortênsias, travessa da praça central', { delay: 5 });
  await expect(street).toHaveValue('Rua das Hortênsias, travessa da praça central');
  await expect(street).toBeFocused();
});
