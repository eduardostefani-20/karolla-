import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@karolla/shared';
import { AppError } from '../utils/errors';
import { errorMeta, logger } from '../utils/logger';

export function zodToFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.') || '_';
    if (!fields[path]) fields[path] = issue.message;
  }
  return fields;
}

/**
 * Tratamento centralizado de erros.
 * O usuário final recebe SEMPRE uma mensagem amigável — nunca stack trace, SQL ou "undefined".
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let body: ApiErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir agora. Tente novamente em instantes.' },
  };

  if (err instanceof ZodError) {
    status = 400;
    body = { error: { code: 'VALIDATION_ERROR', message: 'Verifique os campos destacados.', fields: zodToFields(err) } };
  } else if (err instanceof AppError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) } };
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    body = { error: { code: 'INVALID_JSON', message: 'Requisição inválida.' } };
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    body = { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Requisição muito grande.' } };
  }

  if (status >= 500) logger.error('Erro inesperado', { method: req.method, path: req.path, ...errorMeta(err) });
  res.status(status).json(body);
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' } } satisfies ApiErrorBody);
};
