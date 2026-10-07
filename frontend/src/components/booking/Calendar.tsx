import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WEEKDAY_SHORT } from '@karolla/shared';
import { cn } from '@/utils/cn';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * Calendário mensal acessível. Dias indisponíveis (passado, fechado, bloqueado,
 * além do limite) ficam desabilitados com o motivo no rótulo.
 */
export function Calendar({
  value,
  onChange,
  minDate,
  maxDate,
  isDisabled,
}: {
  value: string | null;
  onChange: (date: string) => void;
  minDate: string;
  maxDate: string;
  isDisabled: (date: string) => string | null;
}) {
  const initial = value ?? minDate;
  const [cursor, setCursor] = useState(() => ({ y: Number(initial.slice(0, 4)), m: Number(initial.slice(5, 7)) - 1 }));

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
    const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
    const lead = first.getUTCDay();
    return [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => toISO(cursor.y, cursor.m, i + 1))] as (string | null)[];
  }, [cursor]);

  const monthStart = toISO(cursor.y, cursor.m, 1);
  const canPrev = monthStart.slice(0, 7) > minDate.slice(0, 7);
  const canNext = maxDate.slice(0, 7) > monthStart.slice(0, 7);
  const move = (delta: number) =>
    setCursor((c) => {
      const m = c.m + delta;
      return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });

  return (
    <div className="card p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} disabled={!canPrev} className="rounded-full p-2.5 hover:bg-ink-900/5 disabled:opacity-30" aria-label="Mês anterior">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="font-display text-xl font-semibold" aria-live="polite">
          {MONTHS[cursor.m]} {cursor.y}
        </h2>
        <button type="button" onClick={() => move(1)} disabled={!canNext} className="rounded-full p-2.5 hover:bg-ink-900/5 disabled:opacity-30" aria-label="Próximo mês">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label="Escolha uma data">
        {WEEKDAY_SHORT.map((d) => (
          <div key={d} className="pb-2 text-xs font-bold uppercase text-ink-400" role="columnheader">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} />;
          const reason = isDisabled(date);
          const selected = value === date;
          const day = Number(date.slice(8));
          const label = `${day} de ${MONTHS[cursor.m]?.toLowerCase()}${reason ? ` — ${reason}` : ''}`;
          return (
            <button
              key={date}
              type="button"
              disabled={Boolean(reason)}
              onClick={() => onChange(date)}
              aria-label={label}
              aria-pressed={selected}
              data-date={date}
              className={cn(
                'mx-auto grid aspect-square w-full max-w-[52px] place-items-center rounded-2xl text-[15px] font-semibold transition-all',
                selected
                  ? 'bg-brand-600 text-white shadow-soft'
                  : reason
                    ? 'cursor-not-allowed text-ink-300 line-through decoration-ink-300/50'
                    : 'bg-brand-50 text-brand-800 hover:bg-brand-100',
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
