import { Instagram, PlayCircle } from 'lucide-react';
import { publicApi } from '@/services/publicApi';
import { useAsync } from '@/hooks/useAsync';

/**
 * Publicações reais do perfil (API oficial da Meta). Só aparece se a integração estiver
 * configurada no servidor — nada é inventado nem raspado do Instagram.
 */
export function InstagramFeed({ limit = 9 }: { limit?: number }) {
  const { data } = useAsync(() => publicApi.instagramFeed(), []);
  if (!data?.configured || data.posts.length === 0) return null;
  return (
    <section aria-labelledby="feed-titulo" className="mt-12">
      <h2 id="feed-titulo" className="mb-4 flex items-center gap-2 text-2xl font-semibold">
        <Instagram className="h-6 w-6 text-coral-500" aria-hidden /> No nosso Instagram
      </h2>
      <ul className="grid grid-cols-3 gap-1 sm:gap-3">
        {data.posts.slice(0, limit).map((post) => (
          <li key={post.id}>
            <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="relative block aspect-square overflow-hidden bg-brand-50 sm:rounded-2xl">
              <img src={post.thumbnailUrl ?? post.mediaUrl} alt={post.caption.slice(0, 120) || 'Publicação da Karolla Pet no Instagram'} loading="lazy" className="h-full w-full object-cover" />
              {post.mediaType === 'VIDEO' && <PlayCircle className="absolute right-1.5 top-1.5 h-6 w-6 text-white drop-shadow" aria-hidden />}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
