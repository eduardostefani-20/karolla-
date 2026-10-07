/**
 * Erros de aplicação. Toda mensagem aqui é amigável e segura para exibir ao usuário final.
 * Erros inesperados são convertidos em mensagem genérica pelo errorHandler (sem stack/detalhes).
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Verifique os campos destacados.', fields?: Record<string, string>) {
    super(400, 'VALIDATION_ERROR', message, fields);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Registro não encontrado.') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Sua sessão expirou. Faça login novamente.') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Você não tem permissão para esta ação.') {
    super(403, 'FORBIDDEN', message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.') {
    super(429, 'TOO_MANY_REQUESTS', message);
  }
}

/** Falha de infraestrutura (banco indisponível etc.). A mensagem detalhada vai só para o log. */
export class InfrastructureError extends Error {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = 'InfrastructureError';
  }
}

/** Conflito de horário detectado no momento da gravação (garantia atômica do repositório). */
export class SlotConflictError extends ConflictError {
  constructor(message = 'Este horário acabou de ser ocupado. Escolha outro horário.') {
    super('SLOT_UNAVAILABLE', message);
  }
}
