import { expect, test } from '@playwright/test';
import { loginAsAdmin, openAdminMenu } from './helpers';

/**
 * Equipe e permissões: a dona cria uma conta de profissional; essa pessoa entra com o próprio login,
 * vê só as áreas liberadas e nenhum valor financeiro.
 */
test('conta de profissional vê só o que foi liberado e nenhum valor', async ({ page, browser }) => {
  const email = `pro-${Date.now()}@karollapet.test`;
  await loginAsAdmin(page);
  await openAdminMenu(page, 'Equipe e acessos');
  await expect(page.getByRole('heading', { name: 'Equipe e acessos' })).toBeVisible();
  await page.getByRole('button', { name: 'Nova conta' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome').fill('Bia Tosadora');
  await dialog.getByLabel('E-mail (login)').fill(email);
  await dialog.getByLabel('Senha inicial').fill('Tosa2026bia');
  await dialog.getByLabel('Perfil').selectOption('manager');
  // personaliza: tira "Agendamentos → Confirmar"
  await dialog.getByText('Personalizar permissões desta conta').click();
  await dialog.getByLabel('Agenda e agendamentos: Confirmar').uncheck();
  await dialog.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByTestId(`staff-${email}`)).toContainText('Personalizado');

  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto('/admin/login');
  await p2.getByLabel('E-mail').fill(email);
  await p2.getByLabel('Senha').fill('Tosa2026bia');
  await p2.getByRole('button', { name: 'ENTRAR' }).click();
  await expect(p2.getByRole('heading', { name: /Olá/ })).toBeVisible();
  const menuButton = p2.getByRole('button', { name: 'Abrir menu' });
  if (await menuButton.isVisible()) await menuButton.click();
  const nav = p2.getByRole('navigation', { name: 'Painel administrativo' }).filter({ visible: true });
  await expect(nav.getByRole('link', { name: 'Agenda', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Preços' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Equipe e acessos' })).toHaveCount(0);

  // URL direta para área sem permissão → redireciona
  await p2.goto('/admin/precos');
  await expect(p2).not.toHaveURL(/\/admin\/precos/);

  // Detalhe do agendamento: sem valores e sem poder mudar status
  await p2.goto('/admin/agendamentos');
  await p2.locator('a[href^="/admin/agendamentos/"]').first().click();
  await expect(p2.getByRole('heading', { name: 'Itens', exact: true })).toBeVisible();
  await expect(p2.getByText('R$')).toHaveCount(0);
  await expect(p2.getByRole('group', { name: 'Alterar status' }).getByRole('button').first()).toBeDisabled();
  await other.close();

  // Desativar corta o acesso
  await page.getByTestId(`staff-${email}`).getByRole('switch').click();
  await expect(page.getByTestId(`staff-${email}`)).toContainText('Desativada');
});

test('esqueci minha senha responde sem revelar se o e-mail existe', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await page.getByLabel('E-mail da sua conta').fill('ninguem@exemplo.com');
  await page.getByRole('button', { name: 'Enviar link de redefinição' }).click();
  await expect(page.getByText('Se este e-mail tiver acesso ao painel')).toBeVisible();
});

test('link de redefinição inválido mostra aviso amigável', async ({ page }) => {
  await page.goto('/redefinir-senha#error=access_denied&error_description=expired');
  await expect(page.getByText('Este link expirou ou já foi usado.')).toBeVisible();
  await expect(page).toHaveURL(/\/redefinir-senha$/);
});
