import type { UploadTicket } from '@karolla/shared';

/**
 * MediaStorage — fotos e vídeos (inspirações e stories).
 *
 * Implementações:
 *  - SupabaseMediaStorage: Supabase Storage (bucket público `karolla-media`). O navegador do
 *    administrador envia o arquivo direto ao Storage com uma URL assinada e temporária,
 *    sem passar pela função (evita o limite de ~6 MB do Netlify).
 *  - MemoryMediaStorage: modo DEMO (arquivos em memória, servidos pela própria API).
 */
export interface MediaStorage {
  readonly provider: 'supabase' | 'memory';
  createUploadTicket(kind: 'inspiration' | 'story', contentType: string, size: number): Promise<UploadTicket>;
  /** Remove o arquivo. Nunca lança erro para arquivo inexistente. */
  remove(path: string): Promise<void>;
}

export const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

export function newMediaPath(kind: 'inspiration' | 'story', contentType: string, id: string): string {
  const month = new Date().toISOString().slice(0, 7);
  return `${kind === 'story' ? 'stories' : 'inspiracoes'}/${month}/${id}.${EXTENSIONS[contentType] ?? 'bin'}`;
}
