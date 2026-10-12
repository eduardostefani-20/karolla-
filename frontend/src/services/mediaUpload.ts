import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, PRIVATE_IMAGE_MAX_BYTES, PRIVATE_IMAGE_TYPES, VIDEO_TYPES, type UploadTicket } from '@karolla/shared';
import { adminApi } from './adminApi';
import { ApiError } from './api';

/**
 * Envio de fotos e vídeos do painel.
 *  1. Fotos são reduzidas no navegador (máx. 1600 px, WebP) — carregam rápido no celular.
 *  2. A API devolve uma URL assinada e temporária.
 *  3. O arquivo vai DIRETO para o armazenamento (Supabase Storage), sem passar pela função.
 */

const MAX_SIDE = 1600;

export async function shrinkImage(file: File): Promise<Blob> {
  if (file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // navegador sem suporte: envia o original
  }
}

export function describeFileProblem(file: File, kind: 'inspiration' | 'story'): string | null {
  const isImage = (IMAGE_TYPES as readonly string[]).includes(file.type);
  const isVideo = (VIDEO_TYPES as readonly string[]).includes(file.type);
  if (kind === 'inspiration' && !isImage) return 'Use uma foto JPG, PNG ou WebP.';
  if (!isImage && !isVideo) return 'Use foto (JPG, PNG, WebP) ou vídeo (MP4, WebM, MOV).';
  if (isVideo && file.size > MAX_VIDEO_BYTES) return 'Vídeo muito grande (máximo 50 MB).';
  if (isImage && file.size > 40 * 1024 * 1024) return 'Foto muito grande.';
  return null;
}

export async function uploadMedia(file: File, kind: 'inspiration' | 'story'): Promise<{ url: string; path: string; mediaType: 'image' | 'video' }> {
  const problem = describeFileProblem(file, kind);
  if (problem) throw new ApiError(problem, 400, 'INVALID_FILE');
  const isVideo = (VIDEO_TYPES as readonly string[]).includes(file.type);
  const body: Blob = isVideo ? file : await shrinkImage(file);
  if (!isVideo && body.size > MAX_IMAGE_BYTES) throw new ApiError('Foto muito grande mesmo após reduzir (máximo 10 MB).', 400, 'INVALID_FILE');
  const contentType = body.type || file.type;

  const ticket = await adminApi.uploadTicket({ kind, contentType, size: body.size });
  await sendWithTicket(ticket, body, contentType);
  return { url: ticket.publicUrl, path: ticket.path, mediaType: isVideo ? 'video' : 'image' };
}

/** Envia o arquivo direto ao armazenamento usando a autorização temporária devolvida pela API. */
export async function sendWithTicket(ticket: UploadTicket, body: Blob, contentType: string): Promise<void> {
  try {
    if (ticket.provider === 'supabase') {
      const { StorageClient } = await import('@supabase/storage-js');
      const client = new StorageClient(ticket.storageUrl!, { apikey: ticket.apiKey!, Authorization: `Bearer ${ticket.apiKey!}` });
      const { error } = await client.from(ticket.bucket!).uploadToSignedUrl(ticket.path, ticket.token!, body, { contentType });
      if (error) throw error;
    } else {
      const res = await fetch(ticket.uploadUrl!, { method: 'PUT', headers: { 'Content-Type': contentType }, body });
      if (!res.ok) throw new Error(`upload ${res.status}`);
    }
  } catch {
    throw new ApiError('Não foi possível enviar o arquivo. Verifique a conexão e tente novamente.', 0, 'UPLOAD_FAILED');
  }
}

/**
 * Foto PRIVADA (foto do pet ou referência): JPG/PNG/WebP, reduzida no navegador, até 8 MB.
 * `getTicket` pede a autorização de envio (portal do cliente ou painel). Devolve o caminho do arquivo.
 */
export async function uploadPrivatePhoto(
  file: File,
  getTicket: (input: { contentType: string; size: number }) => Promise<UploadTicket>,
): Promise<string> {
  if (!(PRIVATE_IMAGE_TYPES as readonly string[]).includes(file.type)) throw new ApiError('Envie uma foto JPG, PNG ou WebP.', 400, 'INVALID_FILE');
  if (file.size > 40 * 1024 * 1024) throw new ApiError('Foto muito grande.', 400, 'INVALID_FILE');
  const body = await shrinkImage(file);
  if (body.size > PRIVATE_IMAGE_MAX_BYTES) throw new ApiError('Foto muito grande mesmo após reduzir (máximo 8 MB).', 400, 'INVALID_FILE');
  const contentType = body.type || file.type;
  const ticket = await getTicket({ contentType, size: body.size });
  await sendWithTicket(ticket, body, contentType);
  return ticket.path;
}
