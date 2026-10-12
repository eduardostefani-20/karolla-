import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin, next, openAdminMenu, pickFirstAvailableSlot } from './helpers';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

/** Liga o Taxi Dog pelo painel (todos os dias, região "cidade inteira", um motorista). Pode rodar mais de uma vez. */
async function setUpTaxi(page: Page, id: string) {
  await loginAsAdmin(page);
  await openAdminMenu(page, 'Taxi Dog');
  await page.getByRole('tab', { name: 'Configuração' }).click();

  await page.getByRole('button', { name: 'Nova região' }).click();
  const region = page.getByRole('dialog', { name: 'Nova região' });
  await region.getByLabel(/^Nome da região/).fill(`Cidade ${id}`);
  await region.getByLabel(/^Bairros atendidos/).fill('*');
  await region.getByLabel(/^Taxa só ida/).fill('10');
  await region.getByLabel(/^Taxa ida e volta/).fill('18');
  await region.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Região salva.')).toBeVisible();

  await page.getByRole('button', { name: 'Novo motorista' }).click();
  const driver = page.getByRole('dialog', { name: 'Novo motorista' });
  await driver.getByLabel(/^Nome/).fill(`Motorista ${id}`);
  await driver.getByLabel(/^Pets por viagem/).fill('5');
  await driver.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Motorista salvo.')).toBeVisible();

  const enabled = page.getByRole('switch', { name: 'Oferecer Taxi Dog no site' });
  if ((await enabled.getAttribute('aria-checked')) !== 'true') await enabled.click();
  for (const day of WEEKDAYS) {
    await page.getByRole('checkbox', { name: day, exact: true }).check();
    await page.getByLabel(`${day}: início do Taxi Dog`).fill('06:00');
    await page.getByLabel(`${day}: fim do Taxi Dog`).fill('22:00');
  }
  await page.getByRole('button', { name: 'Salvar funcionamento' }).click();
  await expect(page.getByText('Configuração do Taxi Dog salva.')).toBeVisible();
}

test('tosa e Taxi Dog: cliente escolhe o estilo, envia foto privada e pede transporte; equipe confirma o motorista', async ({ page }) => {
  const id = String(Date.now()).slice(-8);
  const pet = `Fred${id}`;
  await setUpTaxi(page, id);

  await page.goto('/agendar');
  await page.getByTestId('species-dog').click();
  await page.getByLabel(/Nome do pet/).fill(pet);
  await page.getByRole('combobox', { name: 'Raça' }).fill('golden');
  await page.getByRole('option', { name: 'Golden Retriever' }).click();
  await next(page);
  await page.getByTestId('service-banho-tosa').click();
  await next(page);

  // Estilo de tosa: sugestões só da raça do pet (vindas do catálogo de inspirações)
  await expect(page.getByRole('heading', { name: 'Estilo de tosa' })).toBeVisible();
  const suggestions = page.getByTestId('grooming-suggestions').getByRole('button');
  await expect(suggestions).toHaveCount(1);
  await expect(suggestions.first()).toContainText('Golden');
  await suggestions.first().click();
  await expect(suggestions.first()).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Como você quer a tosa?').fill('Patas bem aparadas');
  await page.getByTestId('grooming-reference-input').setInputFiles({ name: 'ref.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Foto de referência enviada ✓ (só a equipe vê)')).toBeVisible();
  await page.getByLabel('Descrição da foto (opcional)').fill('Igual a esta');
  await next(page);

  await pickFirstAvailableSlot(page);
  await next(page);

  await page.getByLabel(/Nome completo/).fill('Tutor Taxi');
  await page.getByLabel(/WhatsApp/).fill(`119${id}`);
  await page.getByLabel(/E-mail/).fill(`taxi-${id}@exemplo.com`);
  await page.getByLabel(/Endereço \(rua/).fill('Rua do Taxi');
  await page.getByLabel(/^Número/).fill('7');
  await page.getByLabel(/Bairro/).fill('Centro');
  await page.getByLabel(/Cidade/).fill('São Paulo');
  await page.getByRole('checkbox', { name: /busque e\/ou leve meu pet/ }).check();
  await expect(page.getByText(/Taxi Dog disponível/)).toBeVisible();
  await page.getByLabel('Observações para o motorista (opcional)').fill('Portão verde');
  await next(page);

  await expect(page.getByRole('heading', { name: 'Resumo do agendamento' })).toBeVisible();
  await page.getByRole('button', { name: /CONFIRMAR AGENDAMENTO/ }).click();
  await expect(page.getByTestId('confirmation-title')).toBeVisible();
  await expect(page.getByText('Taxi Dog solicitado')).toBeVisible();

  // Painel: referência privada + transporte "Solicitado" -> escolher motorista confirma
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: /Olá/ })).toBeVisible();
  await openAdminMenu(page, 'Agendamentos');
  await page.getByPlaceholder('Pet, cliente ou WhatsApp').fill(pet);
  await page.getByTestId('appointment-card').filter({ hasText: pet }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(pet) })).toBeVisible();
  await expect(page.getByTestId('appointment-grooming-references')).toContainText('Igual a esta');
  await expect(page.getByText(/Tosa: Patas bem aparadas/)).toBeVisible();

  const transport = page.getByTestId('taxi-transport');
  await expect(transport).toContainText('Solicitado');
  await expect(transport).toContainText('Portão verde');
  await transport.getByLabel('Motorista').selectOption({ label: `Motorista ${id} (até 5 pets)` });
  await transport.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Transporte confirmado.')).toBeVisible();
  await expect(transport).toContainText('Confirmado');
});

test('comentários: só cliente com conta comenta; a equipe remove sem apagar o cliente', async ({ page }) => {
  const id = String(Date.now()).slice(-8);
  const text = `Amei esse visual ${id}`;
  await page.goto('/minha-conta/entrar?criar=1');
  await page.getByLabel('Seu nome').fill('Rita Comenta');
  await page.getByLabel(/^E-mail/).fill(`rita-${id}@exemplo.com`);
  await page.getByLabel('WhatsApp').fill(`(11) 9${id.slice(0, 4)}-${id.slice(4)}`);
  await page.getByLabel(/^Senha/).fill('Cliente2026');
  await page.getByRole('checkbox', { name: /Li e aceito/ }).check();
  await page.getByRole('button', { name: 'CRIAR CONTA' }).click();
  await expect(page.getByRole('heading', { name: /^Olá/ })).toBeVisible();

  await page.goto('/inspiracoes');
  await page.getByPlaceholder(/Buscar por raça/).fill('poodle');
  await page.getByTestId('inspiration-tile').first().click();
  const viewer = page.getByRole('dialog');
  await viewer.getByLabel('Escreva um comentário').fill(text);
  await viewer.getByRole('button', { name: 'Comentar' }).click();
  await expect(viewer.getByTestId('comments')).toContainText(text);

  await loginAsAdmin(page);
  await openAdminMenu(page, 'Comentários');
  const row = page.getByTestId('admin-comment').filter({ hasText: text });
  await expect(row).toContainText('Rita Comenta');
  await row.getByRole('button', { name: 'Remover comentário' }).click();
  await page.getByRole('dialog', { name: 'Remover comentário?' }).getByRole('button', { name: 'Remover' }).click();
  await expect(page.getByText('Comentário removido da página.')).toBeVisible();
  await expect(page.getByTestId('admin-comment').filter({ hasText: text })).toHaveCount(0);

  await openAdminMenu(page, 'Clientes');
  await expect(page.getByText('Rita Comenta').first()).toBeVisible();
});
