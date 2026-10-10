import type { InstagramFeedResponse, InstagramPost } from '@karolla/shared';
import { withTimeout } from '../../utils/withTimeout';
import { errorMeta, logger } from '../../utils/logger';

/**
 * Publicações reais do perfil oficial via API oficial da Meta
 * ("Instagram API with Instagram Login", endpoint graph.instagram.com/me/media).
 *
 * Requisitos (configuração externa — veja docs/INSTAGRAM.md):
 *  - conta Instagram Profissional (Empresa ou Criador de conteúdo);
 *  - app na Meta for Developers com a permissão instagram_business_basic;
 *  - token de acesso de longa duração em INSTAGRAM_ACCESS_TOKEN (servidor; nunca no navegador).
 *
 * Sem token: `configured: false` e nenhuma publicação — nada é inventado nem raspado do site.
 */
export interface InstagramFeedService {
  readonly configured: boolean;
  getFeed(): Promise<InstagramFeedResponse>;
}

export class DisabledInstagramFeed implements InstagramFeedService {
  readonly configured = false;
  async getFeed(): Promise<InstagramFeedResponse> {
    return { configured: false, posts: [] };
  }
}

interface GraphMedia {
  id: string;
  caption?: string;
  media_type: InstagramPost['mediaType'];
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

export class GraphInstagramFeed implements InstagramFeedService {
  readonly configured = true;
  private cache: { at: number; posts: InstagramPost[] } | null = null;

  constructor(
    private readonly opts: { accessToken: string; apiVersion: string; limit: number; cacheMs: number; timeoutMs: number },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async getFeed(): Promise<InstagramFeedResponse> {
    if (this.cache && Date.now() - this.cache.at < this.opts.cacheMs) return { configured: true, posts: this.cache.posts };
    const url = new URL(`https://graph.instagram.com/${this.opts.apiVersion}/me/media`);
    url.searchParams.set('fields', 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp');
    url.searchParams.set('limit', String(this.opts.limit));
    url.searchParams.set('access_token', this.opts.accessToken);
    try {
      const res = await withTimeout(this.fetchImpl(url), this.opts.timeoutMs, 'Instagram');
      if (!res.ok) throw new Error(`Instagram API respondeu ${res.status}`);
      const body = (await res.json()) as { data?: GraphMedia[] };
      const posts = (body.data ?? [])
        .filter((m) => m.media_url || m.thumbnail_url)
        .map<InstagramPost>((m) => ({
          id: m.id,
          caption: (m.caption ?? '').slice(0, 500),
          mediaType: m.media_type,
          mediaUrl: m.media_url ?? m.thumbnail_url ?? '',
          thumbnailUrl: m.thumbnail_url ?? null,
          permalink: m.permalink,
          timestamp: m.timestamp,
        }));
      this.cache = { at: Date.now(), posts };
      return { configured: true, posts };
    } catch (err) {
      // Falha (token expirado, rede): devolve o último cache válido ou lista vazia — o site continua funcionando.
      logger.error('Instagram feed indisponível', errorMeta(err));
      return { configured: true, posts: this.cache?.posts ?? [] };
    }
  }
}
