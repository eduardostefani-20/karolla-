import { addDays, formatDateLong, nowInTimezone, timeToMinutes, weekdayOf } from '@karolla/shared';
import { CalendarCheck } from 'lucide-react';
import { useCatalog } from '@/context/CatalogContext';
import { useBooking } from '@/context/BookingContext';
import { Calendar } from './Calendar';
import { StepHeader } from './StepHeader';
import { StepNav } from './StepNav';

export function DateStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { catalog } = useCatalog();
  const { draft, update } = useBooking();
  if (!catalog) return null;
  const now = nowInTimezone(new Date(), catalog.settings.timezone);
  const today = now.date;
  const maxDate = addDays(today, catalog.settings.maxAdvanceDays);
  const closed = new Set(catalog.closedDates);

  const isDisabled = (date: string): string | null => {
    if (date < today) return 'data passada';
    if (date > maxDate) return 'agenda ainda não aberta';
    if (closed.has(date)) return 'indisponível';
    const hours = catalog.businessHours.find((h) => h.weekday === weekdayOf(date));
    if (!hours?.isOpen) return 'fechado';
    if (date === today && now.minutes >= timeToMinutes(hours.closeTime) - 30) return 'expediente encerrado';
    return null;
  };

  return (
    <div>
      <StepHeader step={5} title="Escolha a data" subtitle={`Agendamentos abertos até ${formatDateLong(maxDate)}.`} />
      <Calendar value={draft.date} minDate={today} maxDate={maxDate} isDisabled={isDisabled} onChange={(date) => update((d) => (d.date === date ? {} : { date, time: null }))} />
      {draft.date && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-brand-50 px-4 py-3 font-semibold text-brand-800" aria-live="polite">
          <CalendarCheck className="h-5 w-5" aria-hidden /> <span className="inline-block first-letter:uppercase">{formatDateLong(draft.date)}</span>
        </p>
      )}
      <StepNav onBack={onBack} onNext={onNext} nextDisabled={!draft.date} />
    </div>
  );
}
