import { expect, test } from '@playwright/test';
import { ADMIN, loginAsAdmin, openAdminMenu } from './helpers';

test.describe('Administradora', () => {
  test('rotas administrativas exigem login e login inválido é recusado', async ({ page }) => {
    for (const path of ['/admin', '/admin/agenda', '/admin/clientes', '/admin/servicos', '/admin/configuracoes']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
    }
    await page.getByLabel('E-mail').fill(ADMIN.email);
    await page.getByLabel('Senha').fill('errada');
    await page.getByRole('button', { name: 'ENTRAR' }).click();
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();
  });

  test('dashboard → agendamento → editar → status', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByText('Agendamentos hoje')).toBeVisible();
    await expect(page.getByText('Agenda de hoje')).toBeVisible();

    await openAdminMenu(page, 'Agendamentos');
    await page.getByTestId('appointment-card').first().click();
    await expect(page.getByRole('heading', { name: 'Status' })).toBeVisible();

    const status = test.info().project.name === 'mobile' ? 'Em atendimento' : 'Confirmado';
    await page.getByRole('button', { name: status, exact: true }).click();
    await expect(page.getByText(`Status alterado para "${status}".`)).toBeVisible();

    await page.getByLabel('Observações internas').fill('Chegou com a coleira azul');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Agendamento atualizado.')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Observações internas')).toHaveValue('Chegou com a coleira azul');

    await openAdminMenu(page, 'Agenda');
    await page.getByRole('tab', { name: 'Semana' }).click();
    await page.getByRole('tab', { name: 'Lista' }).click();
    await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible();
  });

  test('edita serviço, preço, adicional e formulário — e o site reflete', async ({ page }) => {
    const suffix = test.info().project.name;
    await loginAsAdmin(page);

    // Novo serviço
    await openAdminMenu(page, 'Serviços');
    await page.getByRole('button', { name: 'Novo serviço' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^Nome/).fill(`Spa relaxante ${suffix}`);
    await dialog.getByLabel(/Descrição/).fill('Banho com aromaterapia');
    await dialog.getByLabel(/Duração/).fill('80');
    await dialog.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText(`Spa relaxante ${suffix}`)).toBeVisible();

    // Preço do novo serviço + edição de um preço existente
    await openAdminMenu(page, 'Preços');
    await page.getByLabel(`Preço de Spa relaxante ${suffix} porte Mini`).fill('77,00');
    await page.getByLabel('Preço de Escovação porte Mini').fill('21,00');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText(/Preços salvos/)).toBeVisible();

    // Adicional
    await openAdminMenu(page, 'Adicionais');
    await page.getByTestId('admin-addon-perfume').getByRole('button', { name: 'Editar Perfume' }).click();
    await page.getByRole('dialog').getByLabel(/^Preço/).fill('6,50');
    await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Adicional atualizado.')).toBeVisible();
    await expect(page.getByTestId('admin-addon-perfume')).toContainText('R$ 6,50');

    // Editor do formulário: e-mail deixa de ser obrigatório
    await openAdminMenu(page, 'Formulário');
    const email = page.getByTestId('field-tutor.email');
    await email.getByRole('switch', { name: 'Obrigatório' }).click();
    await page.getByRole('button', { name: 'Salvar formulário' }).click();
    await expect(page.getByText(/Formulário atualizado/)).toBeVisible();

    // Verifica no site público
    await page.goto('/');
    const card = page.locator('#servicos li', { hasText: `Spa relaxante ${suffix}` });
    await expect(card).toContainText('R$ 77,00');
    await expect(page.locator('#servicos li').filter({ has: page.getByRole('heading', { name: 'Escovação', exact: true }) })).toContainText('R$ 21,00');
    await page.goto('/agendar');
    await page.getByTestId('species-dog').click();
    await page.getByLabel(/Nome do pet/).fill('Rex');
    await page.getByRole('combobox', { name: 'Raça' }).fill('pug');
    await page.getByRole('option', { name: 'Pug' }).click();
    await page.getByTestId('size-mini').click();
    await page.getByRole('button', { name: /^Continuar/ }).click();
    await expect(page.getByTestId(`service-${'escovacao'}`)).toContainText('R$ 21,00');
  });
});

test('vagas por horário: com 1 vaga, o horário escolhido some para o próximo cliente', async ({ page, request }) => {
  await loginAsAdmin(page);
  await openAdminMenu(page, 'Horários');
  await page.getByLabel(/Pets atendidos ao mesmo tempo/).fill('1');
  await page.getByRole('button', { name: 'Salvar vagas' }).click();
  await expect(page.getByText(/Vagas da agenda salvas/)).toBeVisible();
  const catalog = await (await request.get('/api/public/catalog')).json();
  // dia útil daqui a 10 dias
  let date = '';
  for (let i = 10; i < 20 && !date; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    if (catalog.businessHours.find((h: { weekday: number; isOpen: boolean }) => h.weekday === d.getUTCDay())?.isOpen) date = d.toISOString().slice(0, 10);
  }
  const query = `date=${date}&serviceIds=escovacao&sizeId=mini`;
  const before = await (await request.get(`/api/public/availability?${query}`)).json();
  const slot = before.slots.find((s: { available: boolean }) => s.available).time;
  const booking = {
    pet: { name: 'Vaga', speciesId: 'dog', breedId: 'dog-pug', breedName: 'Pug', sizeId: 'mini', weightKg: null, ageMonths: null, notes: '' },
    serviceIds: ['escovacao'], addonIds: [], date, time: slot,
    tutor: { name: 'Teste Vagas', whatsapp: '11912340000', email: 'vagas@teste.com', address: { street: 'Rua A', number: '1', complement: '', neighborhood: 'B', city: 'C' }, notes: '' },
  };
  expect((await request.post('/api/public/appointments', { data: booking })).status()).toBe(201);
  const after = await (await request.get(`/api/public/availability?${query}`)).json();
  expect(after.slots.find((s: { time: string }) => s.time === slot).available).toBe(false);
  const second = await request.post('/api/public/appointments', { data: { ...booking, tutor: { ...booking.tutor, whatsapp: '11912340001' } } });
  expect(second.status()).toBe(409);
});
