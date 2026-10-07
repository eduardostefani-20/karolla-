import type { ZodTypeAny, z } from 'zod';

/** Valida e converte dados de entrada. Erros viram 400 com mensagens por campo (via errorHandler). */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  return schema.parse(data);
}
