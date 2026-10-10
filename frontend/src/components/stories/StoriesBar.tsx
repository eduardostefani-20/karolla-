import { useCallback, useState } from 'react';
import { publicApi } from '@/services/publicApi';
import { useAsync } from '@/hooks/useAsync';
import { cn } from '@/utils/cn';
import { StoryViewer } from './StoryViewer';

const SEEN_KEY = 'karolla:stories-vistos';
const readSeen = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

/**
 * Stories das últimas 24h (a validade vem do servidor/banco — um story vencido nunca é enviado).
 * Sem stories ativos, a barra não aparece.
 */
export function StoriesBar({ className }: { className?: string }) {
  const { data } = useAsync(() => publicApi.stories(), []);
  const [open, setOpen] = useState<number | null>(null);
  const [seen, setSeen] = useState<string[]>(readSeen);
  const markSeen = useCallback((id: string) => {
    setSeen((s) => {
      if (s.includes(id)) return s;
      const next = [...s, id].slice(-100);
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const stories = data ?? [];
  if (stories.length === 0) return null;
  const allSeen = stories.every((s) => seen.includes(s.id));
  const firstUnseen = Math.max(0, stories.findIndex((s) => !seen.includes(s.id)));

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <button type="button" onClick={() => setOpen(firstUnseen)} className="group flex flex-col items-center gap-1.5" aria-label={`Ver stories da Karolla Pet (${stories.length})`} data-testid="stories-open">
        <span className={cn('rounded-full p-[3px]', allSeen ? 'bg-ink-900/15' : 'bg-gradient-to-tr from-sun-400 via-coral-500 to-brand-500')}>
          <span className="block rounded-full bg-cream-100 p-[3px]">
            {stories[stories.length - 1]!.mediaType === 'image' ? (
              <img src={stories[stories.length - 1]!.mediaUrl} alt="" className="h-16 w-16 rounded-full object-cover transition-transform group-hover:scale-105" />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-600 font-display text-2xl text-white">KP</span>
            )}
          </span>
        </span>
        <span className="text-xs font-semibold text-ink-700">Novidades</span>
      </button>
      <p className="text-sm text-ink-500">
        <strong className="text-ink-800">{stories.length} {stories.length === 1 ? 'story' : 'stories'}</strong> das últimas 24 horas
      </p>
      {open !== null && <StoryViewer stories={stories} start={open} onClose={() => setOpen(null)} onSeen={markSeen} />}
    </div>
  );
}
