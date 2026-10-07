import { z } from 'zod';
import { isValidBrazilianMobile, normalizeBrazilianPhone } from '../utils/phone';
import { sanitizeText } from '../utils/sanitize';
import { isValidDateString, TIME_RE } from '../utils/date';

/** Texto livre sanitizado com limite de tamanho. */
export const text = (max: number) => z.string().max(max * 2).transform(sanitizeText).pipe(z.string().max(max, `Use no máximo ${max} caracteres.`));

export const requiredText = (label: string, max = 120) =>
  z
    .string({ required_error: `Informe ${label}.`, invalid_type_error: `Informe ${label}.` })
    .max(max * 2)
    .transform(sanitizeText)
    .pipe(z.string().min(1, `Informe ${label}.`).max(max, `Use no máximo ${max} caracteres.`));

export const optionalText = (max: number) => text(max).optional().default('');

export const idSchema = z.string().min(1, 'Identificador inválido.').max(64);

export const phoneSchema = z
  .string({ required_error: 'Informe o WhatsApp.' })
  .refine(isValidBrazilianMobile, 'Informe um WhatsApp válido com DDD. Ex.: (11) 99999-9999')
  .transform(normalizeBrazilianPhone);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(160)
  .email('Informe um e-mail válido. Ex.: nome@email.com');

export const dateSchema = z.string().refine(isValidDateString, 'Data inválida.');
export const timeSchema = z.string().regex(TIME_RE, 'Horário inválido.');

export const centsSchema = z
  .number({ invalid_type_error: 'Informe um valor.' })
  .int('Valor inválido.')
  .min(0, 'O valor não pode ser negativo.')
  .max(10_000_000, 'Valor muito alto.');

export const durationSchema = z
  .number({ invalid_type_error: 'Informe a duração.' })
  .int()
  .min(5, 'Duração mínima de 5 minutos.')
  .max(720, 'Duração máxima de 12 horas.');

export const sortOrderSchema = z.number().int().min(0).max(10_000);
