import { expect, test, type Page } from '@playwright/test';
import { ADMIN, loginAsAdmin, next, openAdminMenu, pickFirstAvailableSlot } from './helpers';

async function fillPetAndService(page: Page, opts: { pet: string; breed: string; option: string; size: string; service: string }) {
  await page.getByTestId('species-dog').click();
  await page.getByLabel(/Nome do pet/).fill(opts.pet);
  await page.getByRole('combobox', { name: 'Raça' }).fill(opts.breed);
  await page.getByRole('option', { name: opts.option }).click();
  await page.getByTestId(`size-${opts.size}`).click();
  await next(page);
  await page.getByTestId(`service-${opts.service}`).click();
  await next(page);
  await next(page); // sem adicionais
}

/** Abre no painel o agendamento do pet indicado (nome único por teste/projeto). */
async function openAppointmentInAdmin(page: Page, pet: string) {
  await loginAsAdmin(page);
  await openAdminMenu(page, 'Agendamentos');
  await page.getByPlaceholder('Pet, cliente ou WhatsApp').fill(pet);
  await page.getByTestId('appointment-card').filter({ hasText: pet }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(pet) })).toBeVisible();
}

async function fillTutor(page: Page, phone: string) {
  await page.getByLabel(/Nome completo/).fill('Cliente Inspiração');
  await page.getByLabel(/WhatsApp/).fill(phone);
  await page.getByLabel(/E-mail/).fill('cliente@exemplo.com');
  await page.getByLabel(/Endereço \(rua/).fill('Rua das Flores');
  await page.getByLabel(/^Número/).fill('10');
  await page.getByLabel(/Bairro/).fill('Centro');
  await page.getByLabel(/Cidade/).fill('São Paulo');
  await next(page);
}

test('catálogo de inspirações: busca, ampliar, favoritar e agendar com a foto — que chega ao painel', async ({ page }) => {
  const mobile = test.info().project.name === 'mobile';
  const pet = mobile ? 'Pipoca Cel' : 'Pipoca Desk';
  await page.goto('/inspiracoes');
  await expect(page.getByRole('heading', { name: 'Escolha o visual do seu pet' })).toBeVisible();
  await page.getByPlaceholder(/Buscar por raça/).fill('poodle');
  await expect(page.getByTestId('inspiration-tile')).toHaveCount(1);
  await page.getByTestId('inspiration-tile').first().click();
  const viewer = page.getByRole('dialog');
  await expect(viewer.getByRole('heading', { name: 'Poodle na tesoura' })).toBeVisible();
  await expect(page).toHaveURL(/foto=demo-poodle-tesoura/);
  await viewer.getByRole('button', { name: 'Favoritar' }).click();
  await expect(viewer.getByRole('button', { name: 'Favorito' })).toHaveAttribute('aria-pressed', 'true');
  await viewer.getByTestId('inspiration-book').click();

  // agendamento existente, com a foto anexada
  await expect(page.getByText('Etapa 1 de 9')).toBeVisible();
  await expect(page.getByTestId('inspiration-chip')).toContainText('Poodle na tesoura');
  await fillPetAndService(page, { pet, breed: 'poodle', option: 'Poodle', size: 'pequeno', service: 'banho' });
  await pickFirstAvailableSlot(page);
  await next(page);
  await fillTutor(page, mobile ? '11981230001' : '11981230002');
  await expect(page.getByText('Inspiração escolhida').first()).toBeVisible();
  await expect(page.getByTestId('summary-total')).toHaveText('R$ 55,00'); // preço do serviço não muda com a foto
  await page.getByRole('button', { name: /CONFIRMAR AGENDAMENTO/ }).click();
  await expect(page.getByTestId('confirmation-title')).toBeVisible();
  await expect(page.getByText('Inspiração enviada')).toBeVisible();
  const whatsapp = await page.getByRole('link', { name: 'Falar no WhatsApp' }).getAttribute('href');
  expect(decodeURIComponent(whatsapp!)).toContain('INSPIRAÇÃO ESCOLHIDA');

  // painel: a foto fica salva no registro do agendamento
  await openAppointmentInAdmin(page, pet);
  await expect(page.getByTestId('appointment-inspiration').locator('img')).toHaveAttribute('src', '/images/inspiracoes/poodle-tesoura.svg');
  await page.reload();
  await expect(page.getByText('Inspiração escolhida pelo cliente')).toBeVisible();
});

test('agenda por profissional: cliente escolhe a profissional e o painel mostra/permite trocar', async ({ page, request }) => {
  const mobile = test.info().project.name === 'mobile';
  const login = await (await request.post('/api/auth/login', { data: ADMIN })).json();
  const auth = { Authorization: `Bearer ${login.token}` };
  const suffix = mobile ? 'M' : 'D';
  const pet = mobile ? 'Bolinha Cel' : 'Bolinha Desk';
  for (const name of [`Ana ${suffix}`, `Bia ${suffix}`]) {
    expect((await request.post('/api/admin/professionals', { headers: auth, data: { name } })).status()).toBe(201);
  }

  await page.goto('/agendar');
  await fillPetAndService(page, { pet, breed: 'shih', option: 'Shih Tzu', size: 'pequeno', service: 'banho' });
  await expect(page.getByText('Escolha a data')).toBeVisible();
  await page.locator('button[data-date]:not([disabled])').nth(2).click();
  await next(page);
  const bia = page.getByRole('radio', { name: `Bia ${suffix}` });
  await expect(bia).toBeVisible();
  await bia.click();
  await expect(page.getByText('Mostrando apenas os horários livres deste profissional.')).toBeVisible();
  await page.locator('[data-testid^="slot-"]').first().click();
  await next(page);
  await fillTutor(page, mobile ? '11981230003' : '11981230004');
  await expect(page.getByText(`Bia ${suffix}`)).toBeVisible();
  await page.getByRole('button', { name: /CONFIRMAR AGENDAMENTO/ }).click();
  await expect(page.getByTestId('confirmation-title')).toBeVisible();

  await openAppointmentInAdmin(page, pet);
  const select = page.getByTestId('appointment-professional');
  await expect(select.locator('option:checked')).toHaveText(`Bia ${suffix}`);
  await select.selectOption({ label: `Ana ${suffix}` });
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Agendamento atualizado.')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('appointment-professional').locator('option:checked')).toHaveText(`Ana ${suffix}`);

  // limpa para não afetar os outros testes (agenda volta a ser por vagas)
  const list = await (await request.get('/api/admin/catalog', { headers: auth })).json();
  for (const p of list.professionals) await request.patch(`/api/admin/professionals/${p.id}`, { headers: auth, data: { active: false } });
});

test('stories: administrador publica com foto, visitante vê no topo e abre em tela cheia', async ({ page }) => {
  const caption = `Story E2E ${test.info().project.name}`;
  await loginAsAdmin(page);
  await openAdminMenu(page, 'Stories');
  await page.getByRole('button', { name: 'Novo story' }).click();
  // PNG 1x1 válido
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.getByTestId('media-input-story').setInputFiles({ name: 'story.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('dialog').getByRole('img', { name: 'Prévia' })).toBeVisible();
  await page.getByLabel('Legenda').fill(caption);
  await page.getByRole('button', { name: 'Publicar por 24 horas' }).click();
  await expect(page.getByText(/Story publicado/)).toBeVisible();
  await expect(page.getByTestId('admin-story').filter({ hasText: caption })).toContainText(/some em 2[34] h/);

  await page.goto('/');
  await page.getByTestId('stories-open').click();
  const viewer = page.getByRole('dialog', { name: 'Stories da Karolla Pet' });
  await expect(viewer).toBeVisible();
  await viewer.getByRole('button', { name: 'Fechar stories' }).click();
  await expect(viewer).toBeHidden();
});
