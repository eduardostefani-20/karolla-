import { WEEKDAY_LABELS, type ProfessionalWorkHours } from '@karolla/shared';
import { Input } from '@/components/ui/Field';

/** Horário próprio por dia da semana. Vazio = segue o funcionamento da loja; dia desmarcado = folga. */
export function WorkHoursEditor({
  value,
  onChange,
  error,
  customLabel = 'Horário diferente do funcionamento da loja',
}: {
  value: ProfessionalWorkHours[];
  onChange: (v: ProfessionalWorkHours[]) => void;
  error?: string;
  customLabel?: string;
}) {
  const custom = value.length > 0;
  const day = (w: number) => value.find((d) => d.weekday === w);
  const set = (w: number, patch: Partial<ProfessionalWorkHours> | null) => {
    const others = value.filter((d) => d.weekday !== w);
    if (patch === null) return onChange(others);
    const current = day(w) ?? { weekday: w, startTime: '08:00', endTime: '18:00', breakStart: null, breakEnd: null };
    onChange([...others, { ...current, ...patch }].sort((a, b) => a.weekday - b.weekday));
  };
  return (
    <fieldset className="rounded-2xl border border-ink-900/10 p-3">
      <legend className="px-1 text-sm font-semibold text-ink-700">Horário de trabalho</legend>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-5 w-5 accent-brand-600"
          checked={custom}
          onChange={(e) => onChange(e.target.checked ? [1, 2, 3, 4, 5, 6].map((w) => ({ weekday: w, startTime: '08:00', endTime: '18:00', breakStart: null, breakEnd: null })) : [])}
        />
        {customLabel}
      </label>
      {custom && (
        <ul className="mt-3 space-y-2">
          {WEEKDAY_LABELS.map((label, w) => {
            const d = day(w);
            return (
              <li key={w} className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex w-36 items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={Boolean(d)} onChange={(e) => set(w, e.target.checked ? {} : null)} />
                  {label}
                </label>
                {d ? (
                  <>
                    <Input type="time" aria-label={`${label}: início`} className="w-auto py-1.5" value={d.startTime} onChange={(e) => set(w, { startTime: e.target.value })} />
                    <span>às</span>
                    <Input type="time" aria-label={`${label}: fim`} className="w-auto py-1.5" value={d.endTime} onChange={(e) => set(w, { endTime: e.target.value })} />
                    <span className="text-ink-500">intervalo</span>
                    <Input type="time" aria-label={`${label}: início do intervalo`} className="w-auto py-1.5" value={d.breakStart ?? ''} onChange={(e) => set(w, { breakStart: e.target.value || null })} />
                    <Input type="time" aria-label={`${label}: fim do intervalo`} className="w-auto py-1.5" value={d.breakEnd ?? ''} onChange={(e) => set(w, { breakEnd: e.target.value || null })} />
                  </>
                ) : (
                  <span className="text-ink-400">Folga</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-danger-600">{error}</p>}
    </fieldset>
  );
}
