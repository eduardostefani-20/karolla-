import { ImageIcon, X } from 'lucide-react';
import { useBooking } from '@/context/BookingContext';

/** Mostra a foto de inspiração escolhida durante todo o agendamento (pode ser removida). */
export function InspirationChip({ compact }: { compact?: boolean }) {
  const { draft, update } = useBooking();
  const insp = draft.inspiration;
  if (!insp) return null;
  return (
    <div className="mb-5 flex items-center gap-3 rounded-2xl border border-coral-200 bg-coral-50 p-2.5 pr-3" data-testid="inspiration-chip">
      <img src={insp.imageUrl} alt={`Inspiração escolhida: ${insp.title}`} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-coral-600">
          <ImageIcon className="h-3.5 w-3.5" aria-hidden /> Inspiração escolhida
        </p>
        <p className="truncate font-semibold text-ink-800">{insp.title}</p>
        {!compact && <p className="truncate text-xs text-ink-500">{insp.breedName} • a equipe verá esta foto no seu agendamento</p>}
      </div>
      <button type="button" onClick={() => update({ inspiration: null })} className="rounded-full p-2 text-ink-500 hover:bg-white" aria-label="Remover inspiração">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
