import { formatCents } from '@karolla/shared';
import { useCatalog } from '@/context/CatalogContext';
import { useBooking } from '@/context/BookingContext';
import { OptionCard } from './OptionCard';
import { StepHeader } from './StepHeader';
import { StepNav } from './StepNav';

export function AddonsStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { catalog } = useCatalog();
  const { draft, update } = useBooking();
  if (!catalog) return null;

  const toggle = (id: string) => {
    const changesDuration = (catalog.addons.find((a) => a.id === id)?.durationMinutes ?? 0) > 0;
    update((d) => ({
      addonIds: d.addonIds.includes(id) ? d.addonIds.filter((x) => x !== id) : [...d.addonIds, id],
      // se a duração muda, o horário precisa ser revalidado
      ...(changesDuration ? { time: null } : {}),
    }));
  };

  return (
    <div>
      <StepHeader step={4} title="Quer adicionar algum cuidado?" subtitle="Opcional — escolha quantos quiser ou continue sem adicionais." />
      <div role="group" aria-labelledby="etapa-titulo" className="grid gap-3 sm:grid-cols-2">
        {catalog.addons.map((a) => (
          <OptionCard key={a.id} multi selected={draft.addonIds.includes(a.id)} onClick={() => toggle(a.id)} testId={`addon-${a.id}`}>
            <span className="block pr-8 font-semibold">{a.name}</span>
            <span className="mt-1 block text-sm text-ink-500">{a.description}</span>
            <span className="mt-3 block font-display text-lg font-semibold text-brand-700">+ {formatCents(a.priceCents)}</span>
          </OptionCard>
        ))}
      </div>
      <StepNav onBack={onBack} onNext={onNext} nextLabel={draft.addonIds.length ? 'Continuar' : 'Continuar sem adicionais'} />
    </div>
  );
}
