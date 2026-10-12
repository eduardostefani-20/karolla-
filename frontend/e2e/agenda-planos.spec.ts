import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin, openAdminMenu } from './helpers';

/** Próximo dia útil (seg–sex) a partir de amanhã. */
function nextWeekday(offset = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-CA');
}

async function createManual(page: Page, tutor: string, whatsapp: string, pet: string) {
  await openAdminMenu(page, 'Agendamentos');
  await page.getByRole('button', { name: 'Novo agendamento' }).click();
  const dialog = page.getByRole('dialog', { name: 'Novo agendamento' });
  await dialog.getByRole('button', { name: 'Cadastrar novo tutor' }).click();
  await dialog.getByLabel(/^Nome do tutor/).fill(tutor);
  await dialog.getByLabel(/^WhatsApp/).fill(whatsapp);
  await dialog.getByLabel(/^Nome do pet/).fill(pet);
  await dialog.getByLabel(/^Raça/).selectOption({ index: 1 });
  await dialog.getByLabel(/^Porte/).selectOption({ index: 1 });
  await dialog.getByRole('checkbox', { name: 'Banho', exact: true }).check();
  await dialog.getByLabel(/^Data/).fill(nextWeekday(2));
  await dialog.getByLabel(/^Origem/).selectOption('phone');
  const slot = dialog.locator('button', { hasText: /^\d{2}:\d{2}$/ }).first();
  await expect(slot).toBeVisible();
  await slot.click();
  await dialog.getByRole('button', { name: 'Criar agendamento' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(pet) })).toBeVisible();
}

test('equipe cria agendamento pelo painel, segue o fluxo de status e avisa o tutor', async ({ page }) => {
  const id = String(Date.now()).slice(-8);
  await loginAsAdmin(page);
  await createManual(page, `Tutor ${id}`, `(11) 9${id.slice(0, 4)}-${id.slice(4)}`, `Pipoca${id}`);
  await expect(page.getByText(/Origem: Telefone • criado por Carol/)).toBeVisible();

  const statuses = page.getByRole('group', { name: 'Alterar status' });
  await statuses.getByRole('button', { name: 'Aguardando atendimento' }).click();
  await expect(page.getByText('Status alterado para "Aguardando atendimento".')).toBeVisible();
  await statuses.getByRole('button', { name: 'Pronto para retirada' }).click();
  await expect(page.getByText('Status alterado para "Pronto para retirada".')).toBeVisible();

  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Avisar que está pronto' }).click();
  await (await popup).close();
  const confirm = page.getByRole('dialog', { name: 'A mensagem foi enviada?' });
  await expect(confirm).toContainText(`Pipoca${id}`);
  await confirm.getByRole('button', { name: 'Sim, enviei' }).click();
  await expect(page.getByText('Contato registrado como enviado.')).toBeVisible();
});

test('plano: criar, contratar, registrar pagamento e usar no atendimento', async ({ page }) => {
  const id = String(Date.now()).slice(-8);
  await loginAsAdmin(page);
  await openAdminMenu(page, 'Planos');
  await page.getByRole('tab', { name: 'Planos oferecidos' }).click();
  await page.getByRole('button', { name: 'Novo plano' }).click();
  const planDialog = page.getByRole('dialog', { name: 'Novo plano' });
  await planDialog.getByLabel(/^Nome/).fill(`Banho Mensal ${id}`);
  await planDialog.getByLabel(/^Valor/).fill('150,00');
  await planDialog.getByLabel(/^Usos por período/).fill('4');
  await planDialog.getByRole('checkbox', { name: 'Banho', exact: true }).check();
  await planDialog.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByTestId(`plan-Banho Mensal ${id}`)).toBeVisible();

  await createManual(page, `Plano ${id}`, `(11) 9${id.slice(0, 4)}-${id.slice(4)}`, `Bolt${id}`);
  const appointmentUrl = page.url();
  await page.getByRole('link', { name: `Plano ${id}` }).first().click();

  await page.getByRole('button', { name: 'Contratar plano' }).click();
  await page.getByLabel(/^Plano/).selectOption({ label: `Banho Mensal ${id}` });
  await page.getByRole('button', { name: 'Contratar', exact: true }).click();
  await expect(page.getByText('Pendente').first()).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`Banho Mensal ${id}`) }).click();
  const sub = page.getByRole('dialog');
  await sub.getByRole('button', { name: 'Registrar pagamento recebido' }).click();
  await sub.getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(sub.getByText('Ativo').first()).toBeVisible();
  await sub.getByRole('button', { name: 'Fechar' }).last().click();

  await page.goto(appointmentUrl);
  await page.getByRole('button', { name: 'Usar para Banho' }).click();
  await expect(page.getByText(/coberto pelo plano/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Usar para Banho' })).toHaveCount(0);
});
