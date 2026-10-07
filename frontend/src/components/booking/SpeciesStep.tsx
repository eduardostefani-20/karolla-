import { useCatalog } from '@/context/CatalogContext';
import { useBooking } from '@/context/BookingContext';
import { OptionCard } from './OptionCard';
import { StepHeader } from './StepHeader';

export function SpeciesStep({ onNext }: { onNext: () => void }) {
  const { catalog } = useCatalog();
  const { draft, update } = useBooking();
  if (!catalog) return null;

  const choose = (speciesId: string) => {
    update((d) =>
      d.speciesId === speciesId
        ? {}
        : {
            speciesId,
            // trocar a espécie invalida raça e serviço escolhidos
            pet: { ...d.pet, breedId: null, breedName: '' },
            serviceId: null,
            date: null,
            time: null,
          },
    );
    onNext();
  };

  return (
    <div>
      <StepHeader step={1} title="Qual é o seu pet?" subtitle="Vamos começar pelo mais importante 🐾" />
      <div role="radiogroup" aria-labelledby="etapa-titulo" className="grid grid-cols-2 gap-4">
        {catalog.species.map((s) => (
          <OptionCard key={s.id} selected={draft.speciesId === s.id} onClick={() => choose(s.id)} className="py-8 text-center" testId={`species-${s.id}`}>
            <span className="block text-6xl" aria-hidden>
              {s.emoji}
            </span>
            <span className="mt-3 block font-display text-xl font-semibold">{s.name}</span>
          </OptionCard>
        ))}
      </div>
    </div>
  );
}
