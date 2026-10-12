import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UploadTicket } from '@karolla/shared';
import { InfrastructureError, ValidationError } from '../../utils/errors';
import { logger } from '../../utils/logger';

/**
 * PrivateStorage — arquivos PRIVADOS dos clientes (foto do pet, fotos de referência).
 * Nunca há link público: a leitura é feita por links temporários assinados (expiram em minutos),
 * gerados pelo servidor só para quem tem acesso ao registro.
 *
 *  - SupabasePrivateStorage: bucket privado `karolla-private` (tamanho e tipos limitados no próprio bucket).
 *  - MemoryPrivateStorage: modo DEMO (arquivos em memória, links assinados servidos pela API).
 */
export interface PrivateStorage {
  readonly provider: 'supabase' | 'memory';
  createUploadTicket(path: string, contentType: string, size: number): Promise<UploadTicket>;
  /** Links temporários de leitura (caminhos inexistentes ficam de fora). */
  signedUrls(paths: string[], expiresInSeconds?: number): Promise<Map<string, string>>;
  exists(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
}

export const PRIVATE_BUCKET = 'karolla-private';
const DEFAULT_TTL = 10 * 60;

export class SupabasePrivateStorage implements PrivateStorage {
  readonly provider = 'supabase' as const;

  constructor(
    private readonly client: SupabaseClient,
    private readonly opts: { url: string; anonKey: string },
  ) {}

  async createUploadTicket(path: string): Promise<UploadTicket> {
    const { data, error } = await this.client.storage.from(PRIVATE_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new InfrastructureError(`Storage privado: ${error?.message ?? 'sem URL assinada'}`, error);
    return {
      provider: 'supabase',
      storageUrl: `${this.opts.url.replace(/\/$/, '')}/storage/v1`,
      bucket: PRIVATE_BUCKET,
      token: data.token,
      apiKey: this.opts.anonKey,
      path,
      publicUrl: '',
    };
  }

  async signedUrls(paths: string[], expiresInSeconds = DEFAULT_TTL): Promise<Map<string, string>> {
    const unique = [...new Set(paths.filter(Boolean))];
    const out = new Map<string, string>();
    if (!unique.length) return out;
    const { data, error } = await this.client.storage.from(PRIVATE_BUCKET).createSignedUrls(unique, expiresInSeconds);
    if (error) {
      logger.warn('Falha ao gerar links temporários', { error: error.message });
      return out;
    }
    for (const item of data ?? []) if (item.path && item.signedUrl && !item.error) out.set(item.path, item.signedUrl);
    return out;
  }

  async exists(path: string): Promise<boolean> {
    const { data, error } = await this.client.storage.from(PRIVATE_BUCKET).exists(path);
    return !error && Boolean(data);
  }

  async remove(path: string): Promise<void> {
    if (!path) return;
    const { error } = await this.client.storage.from(PRIVATE_BUCKET).remove([path]);
    if (error) logger.warn('Falha ao remover arquivo privado', { error: error.message });
  }
}

/** ⚠️ DEMO — arquivos em memória; leitura só com token temporário. */
export class MemoryPrivateStorage implements PrivateStorage {
  readonly provider = 'memory' as const;
  private files = new Map<string, { body: Buffer; contentType: string }>();
  private pending = new Map<string, { path: string; contentType: string; maxBytes: number; expiresAt: number }>();
  private reads = new Map<string, { path: string; expiresAt: number }>();

  async createUploadTicket(path: string, contentType: string, size: number): Promise<UploadTicket> {
    const token = randomBytes(24).toString('base64url');
    this.pending.set(token, { path, contentType, maxBytes: size, expiresAt: Date.now() + 10 * 60_000 });
    return { provider: 'memory', uploadUrl: `/api/private-upload/${token}`, path, publicUrl: '' };
  }

  receive(token: string, body: Buffer, contentType: string): void {
    const ticket = this.pending.get(token);
    this.pending.delete(token);
    if (!ticket || ticket.expiresAt < Date.now()) throw new ValidationError('Link de envio expirado. Tente novamente.');
    if (contentType.split(';')[0] !== ticket.contentType) throw new ValidationError('Tipo de arquivo diferente do informado.');
    if (body.length === 0 || body.length > ticket.maxBytes) throw new ValidationError('Tamanho do arquivo diferente do informado.');
    this.files.set(ticket.path, { body, contentType: ticket.contentType });
  }

  async signedUrls(paths: string[], expiresInSeconds = DEFAULT_TTL): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    for (const path of new Set(paths)) {
      if (!this.files.has(path)) continue;
      const token = randomBytes(18).toString('base64url');
      this.reads.set(token, { path, expiresAt: Date.now() + expiresInSeconds * 1000 });
      out.set(path, `/api/private-files/${token}`);
    }
    return out;
  }

  read(token: string) {
    const entry = this.reads.get(token);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return this.files.get(entry.path) ?? null;
  }

  async exists(path: string) {
    return this.files.has(path);
  }

  async remove(path: string) {
    this.files.delete(path);
  }
}
