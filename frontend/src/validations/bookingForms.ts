import { z } from 'zod';
import {
  addressSchema,
  emailSchema,
  optionalText,
  phoneSchema,
  requiredText,
  type FormConfigMap,
} from '@karolla/shared';

/**
 * Schemas dos formulários do agendamento no navegador.
 * Reaproveitam as regras do pacote compartilhado — o back-end valida tudo de novo.
 * Os campos marcados como obrigatórios no Editor do Formulário são aplicados via `config`.
 */

const optionalNumber = (label: string, max: number) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v.replace(',', '.'));
      if (!Number.isFinite(n) || n <= 0 || n > max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Informe ${label} válido.` });
        return z.NEVER;
      }
      return n;
    });

export function petFormSchema(config: FormConfigMap) {
  return z
    .object({
      name: requiredText('o nome do pet', 60),
      breedId: z.string().nullable(),
      breedName: z.string().trim().max(80),
      isOtherBreed: z.boolean(),
      sizeId: z.string().min(1, 'Escolha o porte do pet.'),
      weight: optionalNumber('um peso', 150),
      ageValue: optionalNumber('uma idade', 360),
      ageUnit: z.enum(['anos', 'meses']),
      notes: optionalText(500),
    })
    .superRefine((v, ctx) => {
      if (!v.breedId && !v.isOtherBreed) ctx.addIssue({ code: 'custom', path: ['breedName'], message: 'Escolha a raça ou "Outra raça".' });
      if (v.isOtherBreed && !v.breedName) ctx.addIssue({ code: 'custom', path: ['breedName'], message: 'Digite a raça do seu pet.' });
      const need = (k: keyof FormConfigMap) => config[k].enabled && config[k].required;
      if (need('pet.weight') && v.weight == null) ctx.addIssue({ code: 'custom', path: ['weight'], message: 'Informe o peso do pet.' });
      if (need('pet.age') && v.ageValue == null) ctx.addIssue({ code: 'custom', path: ['ageValue'], message: 'Informe a idade do pet.' });
      if (need('pet.notes') && !v.notes) ctx.addIssue({ code: 'custom', path: ['notes'], message: 'Preencha as observações.' });
      if (v.ageValue != null && !Number.isInteger(v.ageValue)) ctx.addIssue({ code: 'custom', path: ['ageValue'], message: 'Use um número inteiro.' });
      // o servidor aceita até 360 meses (30 anos)
      if (v.ageValue != null && v.ageUnit === 'anos' && v.ageValue > 30) {
        ctx.addIssue({ code: 'custom', path: ['ageValue'], message: 'Confira a idade: use no máximo 30 anos.' });
      }
    });
}
export type PetFormInput = z.input<ReturnType<typeof petFormSchema>>;
export type PetFormOutput = z.output<ReturnType<typeof petFormSchema>>;

export function tutorFormSchema(config: FormConfigMap) {
  return z
    .object({
      name: requiredText('o nome completo', 120).refine((v) => v.split(' ').filter(Boolean).length >= 2, 'Informe nome e sobrenome.'),
      whatsapp: phoneSchema,
      email: z.union([z.literal(''), emailSchema]),
      address: addressSchema,
      notes: optionalText(500),
    })
    .superRefine((v, ctx) => {
      const need = (k: keyof FormConfigMap) => config[k].enabled && config[k].required;
      if (need('tutor.email') && !v.email) ctx.addIssue({ code: 'custom', path: ['email'], message: 'Informe o e-mail.' });
      if (need('tutor.notes') && !v.notes) ctx.addIssue({ code: 'custom', path: ['notes'], message: 'Preencha as observações.' });
      if (need('tutor.address')) {
        if (!v.address.street) ctx.addIssue({ code: 'custom', path: ['address', 'street'], message: 'Informe a rua.' });
        if (!v.address.number) ctx.addIssue({ code: 'custom', path: ['address', 'number'], message: 'Informe o número.' });
        if (!v.address.neighborhood) ctx.addIssue({ code: 'custom', path: ['address', 'neighborhood'], message: 'Informe o bairro.' });
        if (!v.address.city) ctx.addIssue({ code: 'custom', path: ['address', 'city'], message: 'Informe a cidade.' });
      }
    });
}
export type TutorFormInput = z.input<ReturnType<typeof tutorFormSchema>>;
export type TutorFormOutput = z.output<ReturnType<typeof tutorFormSchema>>;
