import { z } from 'zod';
import { dateSchema, idSchema } from '@karolla/shared';

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
});

export const searchQuerySchema = z.object({ search: z.string().trim().max(80).optional() });

export const idParamSchema = z.object({ id: idSchema });
