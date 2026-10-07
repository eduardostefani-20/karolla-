import { expect, test } from '@playwright/test';
import { next, pickFirstAvailableSlot } from './helpers';

test.describe('Cliente — agendamento completo', () => {
  test('entra no site, conhece serviços e agenda do início ao fim', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Karolla Pet/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Seu pet cheiroso');
    await expect(page.locator('#servicos').getByText('Banho + Tosa')).toBeVisible();
    await expect(page.getByText('MODO DEMONSTRAÇÃO').first()).toBeVisible();

    await page.getByRole('link', { name: 'AGENDAR AGORA' }).first().click();
    await expect(page.getByText('Etapa 1 de 9')).toBeVisible();
    await page.getByTestId('species-dog').click();

    // Etapa 2 — dados do pet (com validação de formulário incompleto)
    await expect(page.getByText('Etapa 2 de 9')).toBeVisible();
    await next(page);
    await expect(page.getByText('Informe o nome do pet.')).toBeVisible();
    await expect(page.getByText('Escolha a raça ou "Outra raça".')).toBeVisible();

    await page.getByLabel(/Nome do pet/).fill('Thor');
    const breed = page.getByRole('combobox', { name: 'Raça' });
    await breed.fill('golden');
    await page.getByRole('option', { name: 'Golden Retriever' }).click();
    await expect(page.getByTestId('size-grande')).toHaveAttribute('aria-checked', 'true'); // porte sugerido pela raça
    await page.getByLabel(/Peso aproximado/).fill('32');
    await page.getByLabel(/^Idade/).fill('4');
    await next(page);

    // Etapa 3 — serviço com preço por porte
    await expect(page.getByText('Etapa 3 de 9')).toBeVisible();
    await page.getByTestId('service-banho-tosa').click();
    const total = page.getByTestId(test.info().project.name === 'mobile' ? 'mobile-total' : 'price-total');
    await expect(total).toHaveText('R$ 165,00');
    await next(page);

    // Etapa 4 — adicionais com preço em tempo real
    await expect(page.getByText('Quer adicionar algum cuidado?')).toBeVisible();
    await page.getByTestId('addon-hidratacao').click();
    await expect(total).toHaveText('R$ 185,00');
    await page.getByTestId('addon-corte-unhas').click();
    await expect(total).toHaveText('R$ 195,00');
    await next(page);

    // Etapas 5 e 6 — data e horário livres
    const { time } = await pickFirstAvailableSlot(page);
    await next(page);

    // Etapa 7 — tutor (telefone e e-mail inválidos primeiro)
    await expect(page.getByText('Etapa 7 de 9')).toBeVisible();
    await page.getByLabel(/Nome completo/).fill('João Silva');
    await page.getByLabel(/WhatsApp/).fill('1199');
    await page.getByLabel(/E-mail/).fill('joao@');
    await next(page);
    await expect(page.getByText(/Informe um WhatsApp válido/)).toBeVisible();
    await expect(page.getByText(/Informe um e-mail válido/)).toBeVisible();
    await page.getByLabel(/WhatsApp/).fill('11987654321');
    await expect(page.getByLabel(/WhatsApp/)).toHaveValue('(11) 98765-4321'); // máscara
    await page.getByLabel(/E-mail/).fill('joao@email.com');
    await page.getByLabel(/Endereço \(rua/).fill('Rua das Acácias');
    await page.getByLabel(/^Número/).fill('100');
    await page.getByLabel(/Bairro/).fill('Centro');
    await page.getByLabel(/Cidade/).fill('São Paulo');
    await next(page);

    // Etapa 8 — resumo; voltar não perde dados
    await expect(page.getByRole('heading', { name: 'Resumo do agendamento' })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByLabel(/Nome completo/)).toHaveValue('João Silva');
    await next(page);
    await expect(page.getByTestId('summary-total')).toHaveText('R$ 195,00');
    await expect(page.getByText('Golden Retriever')).toBeVisible();
    await expect(page.getByText(time, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /CONFIRMAR AGENDAMENTO/ }).click();

    // Etapa 9 — confirmação
    await expect(page.getByTestId('confirmation-title')).toBeVisible();
    await expect(page.getByText('R$ 195,00')).toBeVisible();
    const whatsapp = page.getByRole('link', { name: 'Falar no WhatsApp' });
    await expect(whatsapp).toHaveAttribute('href', /wa\.me\/5511900000000\?text=.*NOVO%20AGENDAMENTO/);
    await page.getByRole('link', { name: 'Voltar para o início' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('aceita raça digitada manualmente e não permite pular etapas pela URL', async ({ page }) => {
    await page.goto('/agendar?etapa=7');
    await expect(page.getByText('Etapa 1 de 9')).toBeVisible();
    await page.getByTestId('species-cat').click();
    await page.getByLabel(/Nome do pet/).fill('Mimi');
    await page.getByRole('combobox', { name: 'Raça' }).fill('xyz');
    await page.getByRole('option', { name: /Outra raça/ }).click();
    await page.getByLabel('Digite a raça *').fill('Exótico de pelo curto');
    await page.getByTestId('size-pequeno').click();
    await next(page);
    await expect(page.getByText('Etapa 3 de 9')).toBeVisible();
    // serviço apenas para cães não aparece para gatos
    await expect(page.getByTestId('service-tosa-tesoura')).toHaveCount(0);
    await page.reload();
    await expect(page.getByText('Etapa 3 de 9')).toBeVisible(); // rascunho preservado
  });
});
