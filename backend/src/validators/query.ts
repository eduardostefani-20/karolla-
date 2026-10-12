import { z } from 'zod';
import { dateSchema, idSchema, TAXI_DIRECTIONS } from '@karolla/shared';

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []))
  .pipe(z.array(idSchema).max(20));

export const availabilityQuerySchema = z.object({
  date: dateSchema,
  serviceIds: csv.pipe(z.array(idSchema).min(1, 'Escolha um serviço.')),
  addonIds: csv,
  sizeId: idSchema,
  speciesId: idSchema.optional(),
  professionalId: idSchema.optional(),
});

export const searchQuerySchema = z.object({ search: z.string().trim().max(80).optional() });

export const idParamSchema = z.object({ id: idSchema });

export const taxiQuoteQuerySchema = z.object({
  date: dateSchema,
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido.'),
  serviceIds: csv.pipe(z.array(idSchema).min(1, 'Escolha um serviço.')),
  addonIds: csv,
  sizeId: idSchema,
  speciesId: idSchema.optional(),
  neighborhood: z.string().trim().min(1, 'Informe o bairro.').max(80),
  direction: z.enum(TAXI_DIRECTIONS),
});
