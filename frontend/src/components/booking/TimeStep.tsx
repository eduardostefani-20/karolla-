import { useEffect, useState } from 'react';
import { CalendarX2, Sun, Sunset, UserRound } from 'lucide-react';
import { formatDateLong, type AvailabilityResponse } from '@karolla/shared';
import { useBooking } from '@/context/BookingContext';
import { publicApi } from '@/services/publicApi';
import { friendlyMessage } from '@/services/api';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { StepHeader } from './StepHeader';
import { StepNav } from './StepNav';

export function TimeStep({ onBack, onNext, onChangeDate, notice }: { onBack: () => void; onNext: () => void; onChangeDate: () => void; notice?: string | null }) {
  const { draft, update } = useBooking();
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!draft.date || !draft.serviceId) return;
    const controller = new AbortController();
    setData(null);
    setError(null);
    publicApi
      .availability(
        {
          date: draft.date,
          serviceIds: [draft.serviceId],
          addonIds: draft.addonIds,
          sizeId: draft.pet.sizeId,
          speciesId: draft.speciesId ?? undefined,
          professionalId: draft.professionalId ?? undefined,
        },
        controller.signal,
      )
      .then((res) => {
        setData(res);
        // profissional escolhido antes que não faz mais este serviço: volta para "sem preferência"
        if (draft.professionalId && !res.professionals.some((p) => p.id === draft.professionalId)) update({ professionalId: null, time: null });
        // horário salvo que deixou de estar livre é descartado
        if (draft.time && !res.slots.some((s) => s.time === draft.time && s.available)) update({ time: null });
      })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setError(friendlyMessage(err));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.date, draft.serviceId, draft.addonIds.join(','), draft.pet.sizeId, draft.professionalId, attempt]);

  const available = data?.slots.filter((s) => s.available) ?? [];
  const groups = [
    { label: 'Manhã', icon: Sun, slots: available.filter((s) => s.time < '12:00') },
    { label: 'Tarde', icon: Sunset, slots: available.filter((s) => s.time >= '12:00') },
  ].filter((g) => g.slots.length);

  return (
    <div>
      <StepHeader step={6} title="Escolha o horário" subtitle={draft.date ? `Para ${formatDateLong(draft.date)}${data ? ` • duração estimada de ${data.durationMinutes} min` : ''}.` : undefined} />
      {notice && <Alert tone="warning" className="mb-4">{notice}</Alert>}
      {data && data.professionals.length > 1 && (
        <fieldset className="mb-6">
          <legend className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-500">
            <UserRound className="h-4 w-4" aria-hidden /> Profissional
          </legend>
          <div role="radiogroup" aria-label="Profissional" className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {[{ id: null as string | null, name: 'Sem preferência' }, ...data.professionals].map((p) => (
              <button
                key={p.id ?? 'any'}
                type="button"
                role="radio"
                aria-checked={draft.professionalId === p.id}
                onClick={() => update({ professionalId: p.id, time: null })}
                data-testid={`professional-${p.id ?? 'any'}`}
                className={cn(
                  'shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors',
                  draft.professionalId === p.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-900/10 bg-white text-ink-700 hover:border-brand-300',
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-500">
            {draft.professionalId ? 'Mostrando apenas os horários livres deste profissional.' : 'Sem preferência: mostramos todos os horários livres da equipe.'}
          </p>
        </fieldset>
      )}
      {data && data.professionals.length === 1 && (
        <p className="mb-4 flex items-center gap-2 text-sm text-ink-600">
          <UserRound className="h-4 w-4" aria-hidden /> Atendimento com <strong>{data.professionals[0]!.name}</strong>
        </p>
      )}
      {!data && !error && <Spinner label="Buscando horários livres..." />}
      {error && (
        <Alert tone="error" title="Não foi possível carregar os horários" action={<Button size="sm" variant="outline" onClick={() => setAttempt((a) => a + 1)}>Tentar novamente</Button>}>
          {error}
        </Alert>
      )}
      {data && available.length === 0 && (
        <EmptyState icon={<CalendarX2 className="h-10 w-10" />} title="Sem horários livres nesta data">
          <p>{data.closedMessage ?? (data.slots.length ? 'Não há mais horários livres nesta data para a duração deste atendimento.' : 'Não há horários disponíveis nesta data.')}</p>
          <Button variant="outline" className="mt-4" onClick={onChangeDate}>
            Escolher outra data
          </Button>
        </EmptyState>
      )}
      <div className="space-y-6">
        {groups.map((g) => (
          <fieldset key={g.label}>
            <legend className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-500">
              <g.icon className="h-4 w-4" aria-hidden /> {g.label}
            </legend>
            <div role="radiogroup" aria-label={`Horários da ${g.label.toLowerCase()}`} className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
              {g.slots.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  role="radio"
                  aria-checked={draft.time === s.time}
                  onClick={() => update({ time: s.time })}
                  data-testid={`slot-${s.time}`}
                  className={cn(
                    'h-12 rounded-2xl border-2 text-base font-semibold tabular-nums transition-all',
                    draft.time === s.time ? 'border-brand-600 bg-brand-600 text-white shadow-soft' : 'border-ink-900/10 bg-white hover:border-brand-300',
                  )}
                >
                  {s.time}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <StepNav onBack={onBack} onNext={onNext} nextDisabled={!draft.time} />
    </div>
  );
}
