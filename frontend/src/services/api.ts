import type { ApiErrorBody } from '@karolla/shared';

/**
 * Cliente HTTP da aplicação. Todas as chamadas ao back-end passam por aqui.
 * Converte qualquer falha em ApiError com mensagem AMIGÁVEL — o usuário nunca vê
 * "500 error", "undefined" ou mensagens técnicas.
 */

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const FRIENDLY_FALLBACK = 'Não foi possível concluir agora. Tente novamente em instantes.';
const OFFLINE = 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';

let authTokenGetter: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

/** Conectado pelo AuthContext — mantém a camada HTTP desacoplada do React. */
export function configureApiAuth(getter: () => string | null, unauthorized: () => void) {
  authTokenGetter = getter;
  onUnauthorized = unauthorized;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export async function apiRequest<T>(
  method: Method,
  path: string,
  options: { body?: unknown; query?: Record<string, string | undefined>; auth?: boolean; signal?: AbortSignal } = {},
): Promise<T> {
  const url = new URL(`${BASE_URL}/api${path}`, window.location.origin);
  for (const [k, v] of Object.entries(options.query ?? {})) if (v !== undefined && v !== '') url.searchParams.set(k, v);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth) {
    const token = authTokenGetter();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(OFFLINE, 0, 'NETWORK_ERROR');
  }

  if (response.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    /* corpo vazio ou não-JSON */
  }

  if (!response.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    if (response.status === 401 && options.auth) onUnauthorized();
    const message = err?.message && response.status < 500 ? err.message : FRIENDLY_FALLBACK;
    throw new ApiError(message, response.status, err?.code ?? 'UNKNOWN', err?.fields ?? {});
  }
  return data as T;
}

export function friendlyMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return FRIENDLY_FALLBACK;
}
