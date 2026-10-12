import { useEffect, useState } from 'react';
import { Car } from 'lucide-react';
import { formatCents, TAXI_DIRECTION_LABELS, TAXI_DIRECTIONS, type TaxiDirection, type TaxiQuote } from '@karolla/shared';
import { useBooking } from '@/context/BookingContext';
import { useDebounce } from '@/hooks/useDebounce';
import { publicApi } from '@/services/publicApi';
import { Field, Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';

/**
 * Taxi Dog no agendamento: só é oferecido como disponível quando a região do bairro, o dia/horário
 * e os motoristas permitem. A taxa é cobrada à parte e a equipe confirma o motorista.
 */
export function TaxiOption({ neighborhood, onStatus }: { neighborhood: string; onStatus: (ok: boolean) => void }) {
  const { draft, update } = useBooking();
  const [quote, setQuote] = useState<TaxiQuote | null>(null);
  const place = useDebounce(neighborhood.trim(), 400);
  const taxi = draft.taxi;

  useEffect(() => {
    if (!taxi) return onStatus(true);
    setQuote(null);
    onStatus(false);
    if (!place || !draft.date || !draft.time || !draft.serviceId || !draft.pet.sizeId) return;
    const ctrl = new AbortController();
    publicApi
      .taxiQuote(
        {
          date: draft.date,
          time: draft.time,
          serviceIds: [draft.serviceId],
          addonIds: draft.addonIds,
          sizeId: draft.pet.sizeId,
          speciesId: draft.speciesId ?? undefined,
          neighborhood: place,
          direction: taxi.direction,
        },
        ctrl.signal,
      )
      .then((q) => {
        setQuote(q);
        onStatus(q.available);
      })
      .catch(() => undefined);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxi?.direction, Boolean(taxi), place, draft.date, draft.time, draft.serviceId, draft.pet.sizeId, draft.addonIds.join(',')]);

  return (
    <fieldset className="rounded-card border-2 border-brand-100 p-4">
      <legend className="flex items-center gap-2 px-2 text-sm font-bold text-ink-700">
        <Car className="h-4 w-4 text-brand-600" aria-hidden /> Taxi Dog
      </legend>
      <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          className="h-5 w-5 accent-brand-600"
          checked={Boolean(taxi)}
          onChange={(e) => update({ taxi: e.target.checked ? { direction: 'both', notes: '' } : null })}
        />
        Quero que a Karolla Pet busque e/ou leve meu pet
      </label>
      {taxi && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Trajeto">
            {TAXI_DIRECTIONS.map((d) => (
              <label key={d} className="flex cursor-pointer items-center gap-2 rounded-pill bg-lilac-50 px-3 py-1.5 text-sm">
                <input type="radio" name="taxi-direction" className="accent-brand-600" checked={taxi.direction === d} onChange={() => update({ taxi: { ...taxi, direction: d as TaxiDirection } })} />
                {TAXI_DIRECTION_LABELS[d]}
              </label>
            ))}
          </div>
          {!place ? (
            <p className="text-sm text-ink-500">Preencha o endereço com o bairro para ver se atendemos sua região.</p>
          ) : !quote ? (
            <p className="text-sm text-ink-500">Verificando disponibilidade…</p>
          ) : quote.available ? (
            <Alert tone="success" title={`Taxi Dog disponível — ${formatCents(quote.feeCents)} (pago à parte)`}>
              {quote.pickupTime && `Buscamos seu pet por volta das ${quote.pickupTime}. `}
              {quote.dropoffTime && `Levamos de volta por volta das ${quote.dropoffTime}. `}A equipe confirma o motorista pelo WhatsApp.
            </Alert>
          ) : (
            <Alert tone="warning">{quote.message} Desmarque o Taxi Dog para continuar ou escolha outro horário.</Alert>
          )}
          <Field label="Observações para o motorista (opcional)">
            {(p) => <Input {...p} maxLength={300} value={taxi.notes} onChange={(e) => update({ taxi: { ...taxi, notes: e.target.value } })} placeholder="Ex.: portão azul, interfone 12" />}
          </Field>
        </div>
      )}
    </fieldset>
  );
}
