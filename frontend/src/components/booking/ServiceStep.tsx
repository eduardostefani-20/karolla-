import { Clock } from 'lucide-react';
import { findServicePrice, formatCents } from '@karolla/shared';
import { useCatalog } from '@/context/CatalogContext';
import { useBooking } from '@/context/BookingContext';
import { EmptyState } from '@/components/ui/Feedback';
import { OptionCard } from './OptionCard';
import { StepHeader } from './StepHeader';
import { StepNav } from './StepNav';

export function ServiceStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { catalog } = useCatalog();
  const { draft, update } = useBooking();
  if (!catalog) return null;
  const size = catalog.sizes.find((s) => s.id === draft.pet.sizeId);
  const services = catalog.services.filter((s) => s.speciesIds.length === 0 || (draft.speciesId && s.speciesIds.includes(draft.speciesId)));

  return (
    <div>
      <StepHeader step={3} title="Qual serviço você deseja?" subtitle={size ? `Valores para porte ${size.name}.` : undefined} />
      {services.length === 0 ? (
        <EmptyState title="Nenhum serviço disponível">Fale com a Karolla Pet pelo WhatsApp.</EmptyState>
      ) : (
        <div role="radiogroup" aria-labelledby="etapa-titulo" className="grid gap-3">
          {services.map((s) => {
            const price = findServicePrice(catalog, s.id, draft.pet.sizeId);
            const duration = price?.durationMinutes ?? s.durationMinutes;
            return (
              <OptionCard
                key={s.id}
                selected={draft.serviceId === s.id}
                disabled={!price}
                testId={`service-${s.id}`}
                onClick={() => update((d) => (d.serviceId === s.id ? {} : { serviceId: s.id, time: null, professionalId: null }))}
              >
                <span className="flex flex-col gap-1 pr-8 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <span>
                    <span className="block font-display text-lg font-semibold">{s.name}</span>
                    <span className="mt-1 block text-sm text-ink-500">{s.description}</span>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ink-400">
                      <Clock className="h-3.5 w-3.5" aria-hidden /> ~{duration} min
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-xl font-semibold text-brand-700 sm:pt-0.5">
                    {price ? formatCents(price.priceCents) : <span className="text-sm text-ink-400">Indisponível para este porte</span>}
                  </span>
                </span>
              </OptionCard>
            );
          })}
        </div>
      )}
      <StepNav onBack={onBack} onNext={onNext} nextDisabled={!draft.serviceId} />
    </div>
  );
}
