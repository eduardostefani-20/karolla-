import { z } from 'zod';
import { ADMIN_ROLES, APPOINTMENT_STATUSES, FORM_FIELD_KEYS } from '../types/domain';
import {
  centsSchema,
  dateSchema,
  durationSchema,
  emailSchema,
  idSchema,
  optionalText,
  phoneSchema,
  requiredText,
  sortOrderSchema,
  timeSchema,
} from './primitives';
import { addressSchema } from './booking';
import { timeToMinutes } from '../utils/date';

/** Schemas usados pelo painel administrativo (validados novamente no back-end). */

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha.').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const speciesSchema = z.object({
  name: requiredText('o nome', 40),
  emoji: optionalText(8),
  active: z.boolean().default(true),
  sortOrder: sortOrderSchema.default(0),
});

export const breedSchema = z.object({
  speciesId: idSchema,
  name: requiredText('o nome da raça', 80),
  defaultSizeId: idSchema.nullable().default(null),
  active: z.boolean().default(true),
  sortOrder: sortOrderSchema.default(0),
});

export const sizeSchema = z
  .object({
    name: requiredText('o nome do porte', 40),
    description: optionalText(160),
    minWeightKg: z.number().min(0).max(200).nullable().default(null),
    maxWeightKg: z.number().min(0).max(200).nullable().default(null),
    active: z.boolean().default(true),
    sortOrder: sortOrderSchema.default(0),
  })
  .refine((s) => s.minWeightKg == null || s.maxWeightKg == null || s.minWeightKg <= s.maxWeightKg, {
    message: 'O peso mínimo deve ser menor que o máximo.',
    path: ['maxWeightKg'],
  });

export const serviceSchema = z.object({
  name: requiredText('o nome do serviço', 80),
  description: optionalText(400),
  category: requiredText('a categoria', 40),
  durationMinutes: durationSchema,
  active: z.boolean().default(true),
  sortOrder: sortOrderSchema.default(0),
  speciesIds: z.array(idSchema).default([]),
});
export type ServiceInput = z.input<typeof serviceSchema>;

export const addonSchema = z.object({
  name: requiredText('o nome do adicional', 80),
  description: optionalText(300),
  priceCents: centsSchema,
  durationMinutes: z.number().int().min(0).max(240),
  active: z.boolean().default(true),
  sortOrder: sortOrderSchema.default(0),
});
export type AddonInput = z.input<typeof addonSchema>;

export const servicePricesSchema = z.object({
  prices: z
    .array(
      z.object({
        serviceId: idSchema,
        sizeId: idSchema,
        /** `null` remove o preço (serviço indisponível para o porte). */
        priceCents: centsSchema.nullable(),
        durationMinutes: durationSchema.nullable().default(null),
      }),
    )
    .max(500),
});
export type ServicePricesInput = z.input<typeof servicePricesSchema>;

const hoursRefine = (h: { isOpen: boolean; openTime: string; closeTime: string; breakStart: string | null; breakEnd: string | null }) => {
  if (!h.isOpen) return true;
  if (timeToMinutes(h.openTime) >= timeToMinutes(h.closeTime)) return false;
  if ((h.breakStart == null) !== (h.breakEnd == null)) return false;
  if (h.breakStart && h.breakEnd) {
    const bs = timeToMinutes(h.breakStart);
    const be = timeToMinutes(h.breakEnd);
    return bs < be && bs >= timeToMinutes(h.openTime) && be <= timeToMinutes(h.closeTime);
  }
  return true;
};

export const businessHoursSchema = z.object({
  days: z
    .array(
      z
        .object({
          weekday: z.number().int().min(0).max(6),
          isOpen: z.boolean(),
          openTime: timeSchema,
          closeTime: timeSchema,
          breakStart: timeSchema.nullable(),
          breakEnd: timeSchema.nullable(),
        })
        .refine(hoursRefine, { message: 'Horários inválidos: verifique abertura, fechamento e intervalo.' }),
    )
    .length(7, 'Informe os 7 dias da semana.'),
});

export const blockedDateSchema = z.object({
  date: dateSchema,
  reason: optionalText(160),
});

export const blockedTimeSchema = z
  .object({
    date: dateSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    reason: optionalText(160),
  })
  .refine((b) => timeToMinutes(b.startTime) < timeToMinutes(b.endTime), {
    message: 'O horário final deve ser depois do inicial.',
    path: ['endTime'],
  });

function trackingId(pattern: RegExp, message: string, normalize: (v: string) => string = (v) => v) {
  return z
    .string()
    .default('')
    .transform((v) => normalize(v.replace(/\s+/g, '')))
    .pipe(z.union([z.literal(''), z.string().regex(pattern, message)]));
}

export const settingsSchema = z.object({
  businessName: requiredText('o nome', 80),
  whatsappNumber: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{12,13}$/, 'Use o formato com DDI: 5511999999999')),
  contactEmail: z.union([z.literal(''), emailSchema]).default(''),
  addressLine: optionalText(200),
  city: optionalText(80),
  instagram: optionalText(80),
  timezone: z.string().min(3).max(60).default('America/Sao_Paulo'),
  slotIntervalMinutes: z.number().int().min(5).max(240),
  capacity: z.number().int().min(1).max(50),
  minAdvanceMinutes: z.number().int().min(0).max(60 * 24 * 14),
  maxAdvanceDays: z.number().int().min(1).max(365),
  bookingNotice: optionalText(500),
  // Anúncios: IDs públicos (aparecem no código da página de qualquer site que usa pixel). Vazio = desligado.
  metaPixelId: trackingId(/^\d{8,20}$/, 'O ID do Pixel da Meta tem só números (ex.: 123456789012345).'),
  googleAdsId: trackingId(/^AW-\d{6,15}$/, 'Use o formato AW-123456789.', (v) => v.toUpperCase()),
  googleAdsBookingLabel: trackingId(/^[A-Za-z0-9_-]{4,64}$/, 'Rótulo de conversão inválido (copie só o trecho depois da barra em send_to).'),
  googleAdsWhatsappLabel: trackingId(/^[A-Za-z0-9_-]{4,64}$/, 'Rótulo de conversão inválido (copie só o trecho depois da barra em send_to).'),
  tiktokPixelId: trackingId(/^[A-Z0-9]{10,40}$/, 'O ID do Pixel do TikTok tem letras maiúsculas e números (ex.: C4ABCDEF123GHIJ456KL).', (v) => v.toUpperCase()),
});
export type SettingsInput = z.input<typeof settingsSchema>;

export const formFieldSchema = z.object({
  key: z.enum(FORM_FIELD_KEYS),
  label: requiredText('o rótulo', 80),
  helpText: optionalText(200),
  enabled: z.boolean(),
  required: z.boolean(),
});
export const formFieldsSchema = z.object({ fields: z.array(formFieldSchema).max(FORM_FIELD_KEYS.length) });

export const reorderSchema = z.object({ ids: z.array(idSchema).min(1).max(500) });

export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES);

export const appointmentUpdateSchema = z
  .object({
    date: dateSchema,
    time: timeSchema,
    status: appointmentStatusSchema,
    serviceIds: z.array(idSchema).min(1, 'Escolha pelo menos um serviço.').max(5),
    addonIds: z.array(idSchema).max(20),
    sizeId: idSchema,
    professionalId: idSchema.nullable(),
    notes: optionalText(1000),
    customerNotes: optionalText(500),
    /** Recalcula o valor com a tabela de preços atual. Se false, mantém valores gravados quando os itens não mudarem. */
    recalculatePrice: z.boolean().default(false),
  })
  .partial();
export type AppointmentUpdateInput = z.input<typeof appointmentUpdateSchema>;

export const customerUpdateSchema = z
  .object({
    name: requiredText('o nome', 120),
    whatsapp: phoneSchema,
    email: z.union([z.literal(''), emailSchema]),
    address: addressSchema,
    notes: optionalText(1000),
  })
  .partial();

export const petUpdateSchema = z
  .object({
    name: requiredText('o nome do pet', 60),
    speciesId: idSchema,
    breedId: idSchema.nullable(),
    breedName: requiredText('a raça', 80),
    sizeId: idSchema,
    weightKg: z.number().positive().max(150).nullable(),
    ageMonths: z.number().int().min(0).max(360).nullable(),
    notes: optionalText(1000),
  })
  .partial();

export const appointmentListQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  status: appointmentStatusSchema.optional(),
  serviceId: idSchema.optional(),
  petId: idSchema.optional(),
  customerId: idSchema.optional(),
  professionalId: idSchema.optional(),
  search: z.string().trim().max(80).optional(),
});
export type AppointmentListQuery = z.infer<typeof appointmentListQuerySchema>;

export const adminRoleSchema = z.enum(ADMIN_ROLES);

export const professionalSchema = z.object({
  name: requiredText('o nome', 80),
  serviceIds: z.array(idSchema).max(100).default([]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida.').default('#279790'),
  active: z.boolean().default(true),
  sortOrder: sortOrderSchema.default(0),
});
export type ProfessionalInput = z.input<typeof professionalSchema>;

/** URL de mídia: https (armazenamento) ou caminho local do próprio site/API. */
export const mediaUrlSchema = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => /^https:\/\//.test(v) || /^\/(?!\/)/.test(v), 'Endereço de mídia inválido.');

export const inspirationSchema = z.object({
  title: requiredText('o título', 80),
  description: optionalText(300),
  speciesId: idSchema,
  breedId: idSchema.nullable().default(null),
  breedName: optionalText(80),
  imageUrl: mediaUrlSchema,
  storagePath: z.string().max(300).default(''),
  serviceId: idSchema.nullable().default(null),
  active: z.boolean().default(true),
  sortOrder: sortOrderSchema.default(0),
});
export type InspirationInput = z.input<typeof inspirationSchema>;

export const storySchema = z.object({
  mediaType: z.enum(['image', 'video']),
  mediaUrl: mediaUrlSchema,
  storagePath: z.string().max(300).default(''),
  caption: optionalText(200),
});
export type StoryInput = z.input<typeof storySchema>;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export const uploadRequestSchema = z
  .object({
    kind: z.enum(['inspiration', 'story']),
    contentType: z.enum([...IMAGE_TYPES, ...VIDEO_TYPES], { errorMap: () => ({ message: 'Use foto JPG, PNG ou WebP, ou vídeo MP4, WebM ou MOV.' }) }),
    size: z.number().int().positive(),
  })
  .superRefine((v, ctx) => {
    const isVideo = (VIDEO_TYPES as readonly string[]).includes(v.contentType);
    if (isVideo && v.kind !== 'story') ctx.addIssue({ code: 'custom', path: ['contentType'], message: 'Inspirações aceitam apenas fotos.' });
    const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (v.size > max) ctx.addIssue({ code: 'custom', path: ['size'], message: `Arquivo muito grande (máximo ${max / 1024 / 1024} MB).` });
  });
export type UploadRequest = z.infer<typeof uploadRequestSchema>;
