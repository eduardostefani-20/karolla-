import { describe, expect, it } from 'vitest';
import {
  bookingRequestSchema,
  DEFAULT_FORM_FIELDS,
  formatCents,
  formatPhone,
  isValidBrazilianMobile,
  parseMoneyInput,
  resolveFormConfig,
  sanitizeSpreadsheetCell,
  validateConfigurableFields,
} from '../src';

const valid = {
  pet: { name: 'Thor', speciesId: 'dog', breedId: 'golden', breedName: 'Golden Retriever', sizeId: 'grande', weightKg: 32, ageMonths: 36, notes: '' },
  serviceIds: ['banho'],
  addonIds: [],
  date: '2026-10-10',
  time: '14:00',
  tutor: {
    name: 'João Silva',
    whatsapp: '(11) 98888-7777',
    email: 'joao@email.com',
    address: { street: 'Rua A', number: '10', complement: '', neighborhood: 'Centro', city: 'São Paulo' },
    notes: '',
  },
};

describe('telefone', () => {
  it('valida celular brasileiro', () => {
    expect(isValidBrazilianMobile('(11) 98888-7777')).toBe(true);
    expect(isValidBrazilianMobile('5511988887777')).toBe(true);
    expect(isValidBrazilianMobile('(11) 8888-7777')).toBe(false);
    expect(isValidBrazilianMobile('(01) 98888-7777')).toBe(false);
    expect(isValidBrazilianMobile('99999999999')).toBe(false);
    expect(isValidBrazilianMobile('abc')).toBe(false);
  });
  it('aplica máscara', () => {
    expect(formatPhone('11988887777')).toBe('(11) 98888-7777');
    expect(formatPhone('1198')).toBe('(11) 98');
  });
});

describe('bookingRequestSchema', () => {
  it('aceita agendamento válido e normaliza telefone', () => {
    const r = bookingRequestSchema.parse(valid);
    expect(r.tutor.whatsapp).toBe('11988887777');
  });
  it('rejeita telefone e e-mail inválidos', () => {
    const r = bookingRequestSchema.safeParse({ ...valid, tutor: { ...valid.tutor, whatsapp: '123', email: 'x@' } });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('tutor.whatsapp');
    expect(paths).toContain('tutor.email');
  });
  it('rejeita formulário incompleto', () => {
    const r = bookingRequestSchema.safeParse({ ...valid, pet: { ...valid.pet, name: '   ' }, serviceIds: [] });
    expect(r.success).toBe(false);
  });
  it('remove HTML de textos livres', () => {
    const r = bookingRequestSchema.parse({ ...valid, pet: { ...valid.pet, name: '<b>Thor</b>' } });
    expect(r.pet.name).toBe('Thor');
  });
  it('rejeita honeypot preenchido', () => {
    expect(bookingRequestSchema.safeParse({ ...valid, website: 'spam' }).success).toBe(false);
  });
});

describe('campos configuráveis', () => {
  it('exige campos marcados como obrigatórios', () => {
    const config = resolveFormConfig([{ ...DEFAULT_FORM_FIELDS['pet.weight'], required: true }]);
    const errors = validateConfigurableFields(
      { pet: { weightKg: null, ageMonths: null, notes: '' }, tutor: { email: '', address: { street: '', number: '', complement: '', neighborhood: '', city: '' }, notes: '' } },
      config,
    );
    expect(errors['pet.weightKg']).toBeDefined();
    expect(errors['tutor.email']).toBeDefined();
    expect(errors['tutor.address.street']).toBeDefined();
    expect(errors['pet.ageMonths']).toBeUndefined();
  });
  it('ignora campos desativados', () => {
    const config = resolveFormConfig([
      { ...DEFAULT_FORM_FIELDS['tutor.email'], enabled: false },
      { ...DEFAULT_FORM_FIELDS['tutor.address'], enabled: false },
    ]);
    const errors = validateConfigurableFields(
      { pet: { weightKg: null, ageMonths: null, notes: '' }, tutor: { email: '', address: { street: '', number: '', complement: '', neighborhood: '', city: '' }, notes: '' } },
      config,
    );
    expect(errors).toEqual({});
  });
});

describe('utilitários', () => {
  it('formata e interpreta dinheiro', () => {
    expect(formatCents(12345)).toBe('R$ 123,45');
    expect(parseMoneyInput('1.234,50')).toBe(123450);
    expect(parseMoneyInput('45.9')).toBe(4590);
    expect(parseMoneyInput('-1')).toBeNull();
  });
  it('protege planilhas contra fórmulas', () => {
    expect(sanitizeSpreadsheetCell('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(sanitizeSpreadsheetCell('Thor')).toBe('Thor');
  });
});
