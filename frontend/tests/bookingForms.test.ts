import { describe, expect, it } from 'vitest';
import { DEFAULT_FORM_FIELDS, resolveFormConfig } from '@karolla/shared';
import { petFormSchema, tutorFormSchema } from '@/validations/bookingForms';

const config = resolveFormConfig([]);
const pet = { name: 'Thor', breedId: 'dog-pug', breedName: 'Pug', isOtherBreed: false, sizeId: 'pequeno', weight: '8,5', ageValue: '3', ageUnit: 'anos' as const, notes: '' };
const tutor = { name: 'João Silva', whatsapp: '(11) 98765-4321', email: 'joao@email.com', address: { street: 'Rua A', number: '1', complement: '', neighborhood: 'Centro', city: 'SP' }, notes: '' };

describe('petFormSchema', () => {
  it('converte peso com vírgula e idade', () => {
    const r = petFormSchema(config).parse(pet);
    expect(r.weight).toBe(8.5);
    expect(r.ageValue).toBe(3);
  });
  it('exige raça ou "Outra raça" digitada', () => {
    expect(petFormSchema(config).safeParse({ ...pet, breedId: null, breedName: '' }).success).toBe(false);
    expect(petFormSchema(config).safeParse({ ...pet, breedId: null, isOtherBreed: true, breedName: '' }).success).toBe(false);
    expect(petFormSchema(config).safeParse({ ...pet, breedId: null, isOtherBreed: true, breedName: 'Vira-lata' }).success).toBe(true);
  });
  it('respeita campo obrigatório configurado no painel', () => {
    const strict = resolveFormConfig([{ ...DEFAULT_FORM_FIELDS['pet.weight'], required: true }]);
    const r = petFormSchema(strict).safeParse({ ...pet, weight: '' });
    expect(r.success).toBe(false);
  });
  it('rejeita peso inválido', () => {
    expect(petFormSchema(config).safeParse({ ...pet, weight: 'abc' }).success).toBe(false);
  });
});

describe('tutorFormSchema', () => {
  it('normaliza o WhatsApp', () => {
    expect(tutorFormSchema(config).parse(tutor).whatsapp).toBe('11987654321');
  });
  it('rejeita telefone e e-mail inválidos', () => {
    const r = tutorFormSchema(config).safeParse({ ...tutor, whatsapp: '1234', email: 'x@' });
    expect(r.success).toBe(false);
  });
  it('endereço obrigatório por padrão, opcional quando desativado', () => {
    const empty = { ...tutor, address: { street: '', number: '', complement: '', neighborhood: '', city: '' } };
    expect(tutorFormSchema(config).safeParse(empty).success).toBe(false);
    const relaxed = resolveFormConfig([{ ...DEFAULT_FORM_FIELDS['tutor.address'], required: false }]);
    expect(tutorFormSchema(relaxed).safeParse(empty).success).toBe(true);
  });
});

describe('idade', () => {
  it('recusa idade em anos acima de 30 (ex.: 188 anos)', () => {
    const r = petFormSchema(config).safeParse({ ...pet, ageValue: '188', ageUnit: 'anos' });
    expect(r.success).toBe(false);
  });
  it('aceita 300 meses', () => {
    expect(petFormSchema(config).safeParse({ ...pet, ageValue: '300', ageUnit: 'meses' }).success).toBe(true);
  });
});
