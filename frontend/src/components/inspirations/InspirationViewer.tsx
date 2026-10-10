import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { CalendarHeart, ChevronLeft, ChevronRight, Heart, Share2, X } from 'lucide-react';
import type { PublicInspiration } from '@karolla/shared';
import { useCatalog } from '@/context/CatalogContext';
import { useToast } from '@/components/ui/Toast';
import { shareLink } from '@/utils/share';
import { cn } from '@/utils/cn';

/** Visualização ampliada (lightbox) de uma inspiração, com Agendar, Favoritar e Compartilhar. */
export function InspirationViewer({
  items,
  index,
  onIndex,
  onClose,
  isFavorite,
  onToggleFavorite,
}: {
  items: PublicInspiration[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
}) {
  const { catalog } = useCatalog();
  const toast = useToast();
  const item = items[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < items.length - 1) onIndex(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [index, items.length, onClose, onIndex]);

  if (!item) return null;
  const service = catalog?.services.find((s) => s.id === item.serviceId);
  const favorite = isFavorite(item.id);

  const share = async () => {
    const url = `${window.location.origin}/inspiracoes?foto=${encodeURIComponent(item.id)}`;
    const r = await shareLink({ title: `${item.title} — Karolla Pet`, text: `Olha essa inspiração de tosa (${item.breedName}) na Karolla Pet!`, url });
    if (r === 'copied') toast('Link copiado!');
    if (r === 'failed') toast('Não foi possível compartilhar agora.', 'error');
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/90 p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={item.title} onClick={onClose}>
      <div className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[92dvh] sm:flex-row sm:rounded-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-ink-900">
          <img src={item.imageUrl} alt={`${item.title} — ${item.breedName}`} className="max-h-[60dvh] w-full object-contain sm:max-h-[92dvh]" />
          {index > 0 && (
            <button type="button" onClick={() => onIndex(index - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow" aria-label="Foto anterior">
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {index < items.length - 1 && (
            <button type="button" onClick={() => onIndex(index + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow" aria-label="Próxima foto">
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
        <div className="flex flex-col gap-4 p-5 sm:w-80 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-brand-600">{item.breedName}</p>
              <h2 className="text-2xl font-semibold">{item.title}</h2>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-ink-500 hover:bg-ink-900/5" aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>
          {item.description && <p className="text-sm text-ink-600">{item.description}</p>}
          {service && <p className="text-sm text-ink-500">Serviço sugerido: <strong>{service.name}</strong></p>}
          <div className="mt-auto flex flex-col gap-2">
            <Link
              to={`/agendar?inspiracao=${encodeURIComponent(item.id)}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-coral-500 font-semibold text-white shadow-soft hover:bg-coral-600"
              data-testid="inspiration-book"
            >
              <CalendarHeart className="h-5 w-5" aria-hidden /> Agendar com este visual
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onToggleFavorite(item.id)}
                aria-pressed={favorite}
                className={cn('inline-flex h-11 items-center justify-center gap-2 rounded-full border-2 text-sm font-semibold', favorite ? 'border-coral-300 bg-coral-50 text-coral-600' : 'border-ink-900/10 text-ink-700')}
              >
                <Heart className={cn('h-4 w-4', favorite && 'fill-current')} aria-hidden /> {favorite ? 'Favorito' : 'Favoritar'}
              </button>
              <button type="button" onClick={share} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border-2 border-ink-900/10 text-sm font-semibold text-ink-700">
                <Share2 className="h-4 w-4" aria-hidden /> Compartilhar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
