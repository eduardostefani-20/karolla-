import { z } from 'zod';
import { birthDateSchema, emailSchema, idSchema, optionalText, phoneSchema, requiredText } from './primitives';
import { addressSchema } from './booking';
import { newPasswordSchema } from './admin';

/** Portal do cliente: cadastro, perfil e pets (validados de novo no servidor). */

export const accountSignupSchema = z.object({
  name: requiredText('seu nome', 120),
  email: emailSchema,
  whatsapp: phoneSchema,
  password: newPasswordSchema,
  acceptPrivacy: z.literal(true, { errorMap: () => ({ message: 'Para criar a conta, aceite a política de privacidade.' }) }),
});
export type AccountSignupInput = z.input<typeof accountSignupSchema>;

export const accountLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha.').max(200),
});

export const accountProfileSchema = z
  .object({
    name: requiredText('seu nome', 120),
    whatsapp: phoneSchema,
    address: addressSchema,
    marketingOptOut: z.boolean(),
  })
  .partial();
export type AccountProfileInput = z.input<typeof accountProfileSchema>;

export const accountEmailSchema = z.object({ email: emailSchema });

export const accountPetSchema = z.object({
  name: requiredText('o nome do pet', 60),
  speciesId: idSchema,
  breedId: idSchema.nullable().default(null),
  breedName: requiredText('a raça', 80),
  sizeId: idSchema,
  weightKg: z.number().positive().max(150).nullable().default(null),
  birthDate: birthDateSchema.nullable().default(null),
  characteristics: optionalText(500),
  groomingPreferences: optionalText(500),
  notes: optionalText(1000),
});
export type AccountPetInput = z.input<typeof accountPetSchema>;
export const accountPetUpdateSchema = accountPetSchema.partial();

/** Fotos privadas (foto do pet e fotos de referência): só imagens, até 8 MB. */
export const PRIVATE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PRIVATE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export const privateUploadSchema = z.object({
  kind: z.enum(['pet-photo', 'pet-reference']),
  contentType: z.enum(PRIVATE_IMAGE_TYPES, { errorMap: () => ({ message: 'Envie uma foto JPG, PNG ou WebP.' }) }),
  size: z.number().int().positive().max(PRIVATE_IMAGE_MAX_BYTES, 'A foto deve ter no máximo 8 MB.'),
});

export const petPhotoSchema = z.object({ path: z.string().min(5).max(300) });
export const petReferenceSchema = z.object({
  path: z.string().min(5).max(300),
  description: optionalText(300),
  appointmentId: idSchema.nullable().default(null),
});
