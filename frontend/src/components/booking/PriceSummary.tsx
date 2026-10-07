import { Receipt } from 'lucide-react';
import { formatCents } from '@karolla/shared';
import { useCatalog } from '@/context/CatalogContext';
import { useBooking } from '@/context/BookingContext';
import { useBookingPrice } from './useBookingPrice';

/** Resumo do preço em tempo real: serviço + adicionais = total. */
export function PriceSummary() {
  const { catalog } = useCatalog();
  const { draft } = useBooking();
  const { price, error } = useBookingPrice();
  const size = catalog?.sizes.find((s) => s.id === draft.pet.sizeId);

  return (
    <aside className="card p-6" aria-labelledby="resumo-preco" aria-live="polite">
      <h2 id="resumo-preco" className="flex items-center gap-2 text-lg font-semibold">
        <Receipt className="h-5 w-5 text-brand-500" aria-hidden /> Seu atendimento
      </h2>
      {draft.pet.name && (
        <p className="mt-1 text-sm text-ink-500">
          {draft.pet.name}
          {size ? ` • Porte ${size.name}` : ''}
        </p>
      )}
      {!price && !error && <p className="mt-4 text-sm text-ink-500">Escolha o porte e o serviço para ver o valor.</p>}
      {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}
      {price && (
        <>
          <ul className="mt-4 space-y-2 text-sm">
            {price.lines.map((l) => (
              <li key={`${l.kind}-${l.refId}`} className="flex justify-between gap-3">
                <span className={l.kind === 'addon' ? 'text-ink-500' : 'font-semibold'}>
                  {l.kind === 'addon' && '+ '}
                  {l.name}
                </span>
                <span className="tabular-nums">{formatCents(l.priceCents)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-end justify-between border-t border-dashed border-ink-900/15 pt-4">
            <span className="text-sm font-bold uppercase tracking-wide text-ink-500">Total</span>
            <span className="font-display text-3xl font-semibold text-brand-700 tabular-nums" data-testid="price-total">
              {formatCents(price.totalCents)}
            </span>
          </div>
          <p className="mt-2 text-right text-xs text-ink-400">Duração estimada: {price.totalDurationMinutes} min</p>
        </>
      )}
    </aside>
  );
}
