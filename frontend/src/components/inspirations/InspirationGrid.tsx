import { Heart } from 'lucide-react';
import type { PublicInspiration } from '@karolla/shared';
import { cn } from '@/utils/cn';

/** Grade quadrada estilo Instagram (3 colunas mesmo no celular). */
export function InspirationGrid({ items, onOpen, isFavorite }: { items: PublicInspiration[]; onOpen: (index: number) => void; isFavorite: (id: string) => boolean }) {
  return (
    <ul className="grid grid-cols-3 gap-1 sm:gap-3">
      {items.map((item, i) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(i)}
            className="group relative block aspect-square w-full overflow-hidden bg-brand-50 sm:rounded-2xl"
            aria-label={`Ampliar: ${item.title} (${item.breedName})`}
            data-testid="inspiration-tile"
          >
            <img src={item.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/70 to-transparent px-2 pb-1.5 pt-6 text-left text-[11px] font-semibold text-white sm:text-sm">
              {item.breedName}
            </span>
            {isFavorite(item.id) && (
              <Heart className={cn('absolute right-1.5 top-1.5 h-5 w-5 fill-coral-500 text-white drop-shadow')} aria-label="Favorito" />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
