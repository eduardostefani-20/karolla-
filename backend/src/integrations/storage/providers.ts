import { randomBytes, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UploadTicket } from '@karolla/shared';
import { InfrastructureError, ValidationError } from '../../utils/errors';
import { logger, errorMeta } from '../../utils/logger';
import { newMediaPath, type MediaStorage } from './MediaStorage';

export const MEDIA_BUCKET = 'karolla-media';

export class SupabaseMediaStorage implements MediaStorage {
  readonly provider = 'supabase' as const;

  constructor(
    private readonly client: SupabaseClient,
    private readonly opts: { url: string; anonKey: string },
  ) {}

  async createUploadTicket(kind: 'inspiration' | 'story', contentType: string): Promise<UploadTicket> {
    const path = newMediaPath(kind, contentType, randomUUID());
    const { data, error } = await this.client.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new InfrastructureError(`Storage: ${error?.message ?? 'sem URL assinada'}`, error);
    const publicUrl = this.client.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
    return {
      provider: 'supabase',
      storageUrl: `${this.opts.url.replace(/\/$/, '')}/storage/v1`,
      bucket: MEDIA_BUCKET,
      token: data.token,
      apiKey: this.opts.anonKey,
      path,
      publicUrl,
    };
  }

  async remove(path: string): Promise<void> {
    if (!path) return;
    const { error } = await this.client.storage.from(MEDIA_BUCKET).remove([path]);
    if (error) logger.warn('Falha ao remover arquivo do Storage', { path, error: error.message });
  }
}

interface PendingUpload {
  path: string;
  contentType: string;
  maxBytes: number;
  expiresAt: number;
}

/** ⚠️ DEMO — arquivos em memória (somem ao reiniciar). */
export class MemoryMediaStorage implements MediaStorage {
  readonly provider = 'memory' as const;
  private files = new Map<string, { body: Buffer; contentType: string }>();
  private pending = new Map<string, PendingUpload>();

  async createUploadTicket(kind: 'inspiration' | 'story', contentType: string, size: number): Promise<UploadTicket> {
    const path = newMediaPath(kind, contentType, randomUUID());
    const token = randomBytes(24).toString('base64url');
    this.pending.set(token, { path, contentType, maxBytes: size, expiresAt: Date.now() + 10 * 60_000 });
    return { provider: 'memory', uploadUrl: `/api/media/upload/${token}`, path, publicUrl: `/api/media/files/${path}` };
  }

  /** Recebe o arquivo enviado com o token de upload (uso único). */
  receive(token: string, body: Buffer, contentType: string): string {
    const ticket = this.pending.get(token);
    this.pending.delete(token);
    if (!ticket || ticket.expiresAt < Date.now()) throw new ValidationError('Link de envio expirado. Tente novamente.');
    if (contentType.split(';')[0] !== ticket.contentType) throw new ValidationError('Tipo de arquivo diferente do informado.');
    if (body.length === 0 || body.length > ticket.maxBytes) throw new ValidationError('Tamanho do arquivo diferente do informado.');
    this.files.set(ticket.path, { body, contentType: ticket.contentType });
    return ticket.path;
  }

  get(path: string) {
    return this.files.get(path) ?? null;
  }

  async remove(path: string): Promise<void> {
    try {
      this.files.delete(path);
    } catch (err) {
      logger.warn('Falha ao remover arquivo', errorMeta(err));
    }
  }
}
