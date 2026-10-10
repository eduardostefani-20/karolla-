import { z } from 'zod';
import type { FormFieldConfig, FormFieldKey } from '../types/domain';
import { DEFAULT_FORM_FIELDS } from '../constants';
import { dateSchema, emailSchema, idSchema, optionalText, phoneSchema, requiredText, timeSchema } from './primitives';

/**
 * Schemas do agendamento público. Usados no navegador (React Hook Form) e
 * revalidados no back-end — a validação do navegador nunca é suficiente sozinha.
 */

export const petStepSchema = z
  .object({
    name: requiredText('o nome do pet', 60),
    speciesId: idSchema,
    breedId: idSchema.nullable(),
    breedName: requiredText('a raça', 80),
    sizeId: idSchema,
    weightKg: z.number().positive('Peso inválido.').max(150, 'Peso inválido.').nullable(),
    ageMonths: z.number().int().min(0, 'Idade inválida.').max(360, 'Idade inválida.').nullable(),
    notes: optionalText(500),
  });
export type PetStepInput = z.input<typeof petStepSchema>;
export type PetStepData = z.output<typeof petStepSchema>;

export const addressSchema = z.object({
  street: optionalText(160),
  number: optionalText(20),
  complement: optionalText(80),
  neighborhood: optionalText(80),
  city: optionalText(80),
});

export const tutorStepSchema = z.object({
  name: requiredText('o nome completo', 120).refine(
    (v) => v.split(' ').filter(Boolean).length >= 2,
    'Informe nome e sobrenome.',
  ),
  whatsapp: phoneSchema,
  email: z.union([z.literal(''), emailSchema]).default(''),
  address: addressSchema,
  notes: optionalText(500),
});
export type TutorStepInput = z.input<typeof tutorStepSchema>;
export type TutorStepData = z.output<typeof tutorStepSchema>;

export const bookingRequestSchema = z.object({
  pet: petStepSchema,
  serviceIds: z.array(idSchema).min(1, 'Escolha um serviço.').max(5),
  addonIds: z.array(idSchema).max(20).default([]),
  date: dateSchema,
  time: timeSchema,
  tutor: tutorStepSchema,
  /** Profissional escolhido pelo cliente (null/ausente = sem preferência). */
  professionalId: idSchema.nullable().optional(),
  /** Inspiração de tosa escolhida no catálogo (só a referência; o servidor busca os dados). */
  inspirationId: idSchema.nullable().optional(),
  /** Total que o cliente viu na tela. Se divergir do recálculo do servidor, o cliente é avisado. */
  expectedTotalCents: z.number().int().min(0).optional(),
  /** Honeypot anti-spam: deve chegar vazio. */
  website: z.string().max(0, 'Requisição inválida.').optional(),
});
export type BookingRequestInput = z.input<typeof bookingRequestSchema>;
export type BookingRequest = z.output<typeof bookingRequestSchema>;

export type FormConfigMap = Record<FormFieldKey, FormFieldConfig>;

export function resolveFormConfig(fields: FormFieldConfig[]): FormConfigMap {
  const map = { ...DEFAULT_FORM_FIELDS };
  for (const f of fields) if (f.key in map) map[f.key] = f;
  return map;
}

export type FieldErrors = Record<string, string>;

/**
 * Regras configuráveis pela administradora no Editor do Formulário (campo ativo/obrigatório).
 * Retorna erros por caminho de campo (ex.: "tutor.email"). Vazio = válido.
 */
export function validateConfigurableFields(
  data: { pet: Pick<PetStepData, 'weightKg' | 'ageMonths' | 'notes'>; tutor: Pick<TutorStepData, 'email' | 'address' | 'notes'> },
  config: FormConfigMap,
): FieldErrors {
  const errors: FieldErrors = {};
  const need = (key: FormFieldKey) => config[key].enabled && config[key].required;

  if (need('pet.weight') && data.pet.weightKg == null) errors['pet.weightKg'] = 'Informe o peso do pet.';
  if (need('pet.age') && data.pet.ageMonths == null) errors['pet.ageMonths'] = 'Informe a idade do pet.';
  if (need('pet.notes') && !data.pet.notes) errors['pet.notes'] = 'Preencha as observações do pet.';
  if (need('tutor.email') && !data.tutor.email) errors['tutor.email'] = 'Informe o e-mail.';
  if (need('tutor.notes') && !data.tutor.notes) errors['tutor.notes'] = 'Preencha as observações.';
  if (need('tutor.address')) {
    const a = data.tutor.address;
    if (!a.street) errors['tutor.address.street'] = 'Informe a rua.';
    if (!a.number) errors['tutor.address.number'] = 'Informe o número.';
    if (!a.neighborhood) errors['tutor.address.neighborhood'] = 'Informe o bairro.';
    if (!a.city) errors['tutor.address.city'] = 'Informe a cidade.';
  }
  return errors;
}

/** Remove valores de campos desativados (o servidor não grava o que o formulário não pediu). */
export function stripDisabledFields<T extends { pet: PetStepData; tutor: TutorStepData }>(data: T, config: FormConfigMap): T {
  const pet = { ...data.pet };
  const tutor = { ...data.tutor, address: { ...data.tutor.address } };
  if (!config['pet.weight'].enabled) pet.weightKg = null;
  if (!config['pet.age'].enabled) pet.ageMonths = null;
  if (!config['pet.notes'].enabled) pet.notes = '';
  if (!config['tutor.email'].enabled) tutor.email = '';
  if (!config['tutor.notes'].enabled) tutor.notes = '';
  if (!config['tutor.address'].enabled) {
    tutor.address = { street: '', number: '', complement: '', neighborhood: '', city: '' };
  }
  return { ...data, pet, tutor };
}
