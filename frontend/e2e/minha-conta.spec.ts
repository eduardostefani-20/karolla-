import { expect, test } from '@playwright/test';
import { loginAsAdmin, openAdminMenu } from './helpers';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** Cria a conta (ou entra, se o servidor de teste já tiver essa conta de outra execução). */
async function signUpOrLogin(page: import('@playwright/test').Page, data: { name: string; email: string; whatsapp: string }) {
  await page.goto('/minha-conta/entrar?criar=1');
  await page.getByLabel('Seu nome').fill(data.name);
  await page.getByLabel(/^E-mail/).fill(data.email);
  await page.getByLabel('WhatsApp').fill(data.whatsapp);
  await page.getByLabel(/^Senha/).fill('Cliente2026');
  await page.getByRole('checkbox', { name: /Li e aceito/ }).check();
  await page.getByRole('button', { name: 'CRIAR CONTA' }).click();
  const hello = page.getByRole('heading', { name: /^Olá/ });
  const exists = page.getByText('Este e-mail já tem cadastro');
  await expect(hello.or(exists)).toBeVisible();
  if (await exists.isVisible()) {
    await page.getByRole('tab', { name: 'Entrar' }).click();
    await page.getByLabel(/^E-mail/).fill(data.email);
    await page.getByLabel(/^Senha/).fill('Cliente2026');
    await page.getByRole('button', { name: 'ENTRAR' }).click();
    await expect(hello).toBeVisible();
  }
}

test('cliente cria conta, cadastra pet com foto e referência e edita os dados', async ({ page }) => {
  const id = Date.now();
  await signUpOrLogin(page, { name: 'Paula Teste', email: `paula-${id}@exemplo.com`, whatsapp: `(11) 9${String(id).slice(-8, -4)}-${String(id).slice(-4)}` });
  await expect(page.getByText('Nenhum pet cadastrado ainda')).toBeVisible();

  await page.getByRole('button', { name: 'Adicionar pet' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome do pet').fill('Pipoca');
  await dialog.getByLabel('Porte').selectOption({ index: 1 });
  await dialog.getByLabel(/^Raça/).selectOption({ index: 1 });
  await dialog.getByLabel('Data de nascimento').fill('2024-01-15');
  await dialog.getByLabel('Preferências de tosa').fill('Tosa bebê');
  await dialog.getByRole('button', { name: 'Salvar' }).click();
  await page.getByTestId('portal-pet-Pipoca').click();

  await expect(page.getByRole('heading', { name: 'Pipoca' })).toBeVisible();
  await expect(page.getByText('Tosa bebê')).toBeVisible();
  await page.getByTestId('pet-photo-input').setInputFiles({ name: 'pipoca.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByAltText('Foto de Pipoca')).toBeVisible();
  await page.getByLabel('Descrição (opcional)').fill('Assim, com a franja curta');
  await page.getByTestId('pet-reference-input').setInputFiles({ name: 'ref.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByAltText('Assim, com a franja curta')).toBeVisible();

  await page.getByRole('link', { name: 'Minha conta' }).first().click();
  await page.getByLabel('Rua').fill('Rua das Acácias');
  await page.getByRole('switch', { name: /Não quero receber/ }).click();
  await page.getByRole('button', { name: 'Salvar dados' }).click();
  await expect(page.getByText('Dados atualizados.')).toBeVisible();
});

test('conta com o e-mail do cadastro existente mostra os pets e o histórico', async ({ page }, info) => {
  const who = info.project.name === 'mobile' ? { email: 'maria.demo@exemplo.com', pet: 'Mel' } : { email: 'joao.demo@exemplo.com', pet: 'Thor' };
  await signUpOrLogin(page, { name: 'Tutor', email: who.email, whatsapp: info.project.name === 'mobile' ? '(11) 94444-0002' : '(11) 94444-0001' });
  await expect(page.getByTestId(`portal-pet-${who.pet}`)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Meus agendamentos' })).toBeVisible();
  await expect(page.locator('section[aria-labelledby="historico"]')).toContainText(who.pet);
});

test('área do cliente sem login leva para "Entrar"', async ({ page }) => {
  await page.goto('/minha-conta');
  await expect(page).toHaveURL(/\/minha-conta\/entrar/);
});

test('CRM: equipe abre o WhatsApp com mensagem pronta e registra o envio', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminMenu(page, 'CRM');
  await expect(page.getByRole('heading', { name: 'CRM' })).toBeVisible();
  await page.getByRole('tab', { name: /Todos/ }).click();
  const row = page.getByTestId('crm-Ana Lima (demo)');
  const popup = page.waitForEvent('popup');
  await row.getByRole('button', { name: /WhatsApp|Convidar/ }).click();
  await (await popup).close();
  await expect(page.getByRole('dialog', { name: 'A mensagem foi enviada?' })).toBeVisible();
  await page.getByRole('button', { name: 'Sim, enviei' }).click();
  await expect(row).toContainText('Enviado');
});
