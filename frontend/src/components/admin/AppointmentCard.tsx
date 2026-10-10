import { Link } from 'react-router-dom';
import { Clock, ImageIcon } from 'lucide-react';
import { formatCents, formatDateBR, minutesToTime, timeToMinutes, type AppointmentDetail } from '@karolla/shared';
import { StatusBadge } from './AdminUi';

/** Linha de agendamento usada no dashboard, agenda e listas (responsiva). */
export function AppointmentCard({ a, showDate }: { a: AppointmentDetail; showDate?: boolean }) {
  const end = minutesToTime(timeToMinutes(a.time) + a.durationMinutes);
  return (
    <Link
      to={`/admin/agendamentos/${a.id}`}
      className="group flex items-stretch gap-4 rounded-2xl border border-ink-900/5 bg-white p-3 transition-all hover:border-brand-200 hover:shadow-card sm:p-4"
      data-testid="appointment-card"
    >
      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 py-2 text-brand-800">
        {showDate && <span className="text-[11px] font-bold">{formatDateBR(a.date).slice(0, 5)}</span>}
        <span className="font-display text-lg font-semibold tabular-nums">{a.time}</span>
        <span className="flex items-center gap-0.5 text-[10px] text-brand-600">
          <Clock className="h-2.5 w-2.5" aria-hidden />
          {end}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-lg font-semibold text-ink-900 group-hover:text-brand-700">{a.pet.name}</p>
          <StatusBadge status={a.status} />
          {a.inspiration && <ImageIcon className="h-4 w-4 text-coral-500" aria-label="Com foto de inspiração" />}
        </div>
        <p className="truncate text-sm font-medium text-ink-700">
          {a.services.map((s) => s.name).join(' + ')}
          {a.addons.length > 0 && <span className="text-ink-400"> + {a.addons.length} adicional(is)</span>}
        </p>
        <p className="truncate text-xs text-ink-500">
          {a.pet.breedName} • Tutor: {a.customer.name}
          {a.professional && (
            <span className="ml-1 inline-flex items-center gap-1 font-semibold" style={{ color: a.professional.color }}>
              • {a.professional.name}
            </span>
          )}
        </p>
      </div>
      <div className="hidden shrink-0 self-center text-right sm:block">
        <p className="font-semibold tabular-nums">{formatCents(a.totalCents)}</p>
      </div>
    </Link>
  );
}
