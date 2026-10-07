import { Link } from 'react-router-dom';
import { formatCents, formatDateBR, type Appointment } from '@karolla/shared';
import { EmptyState } from '@/components/ui/Feedback';
import { StatusBadge } from './AdminUi';

/** Histórico de atendimentos (serviços, datas, valores, observações). */
export function AppointmentHistory({ items, petNames }: { items: Appointment[]; petNames?: Record<string, string> }) {
  if (!items.length) return <EmptyState title="Nenhum atendimento ainda" />;
  return (
    <ul className="divide-y divide-ink-900/5">
      {items.map((a) => (
        <li key={a.id}>
          <Link to={`/admin/agendamentos/${a.id}`} className="flex flex-col gap-1 rounded-xl px-2 py-3 hover:bg-brand-50 sm:flex-row sm:items-center sm:gap-4">
            <span className="w-28 shrink-0 font-semibold tabular-nums">
              {formatDateBR(a.date)} <span className="text-ink-400">{a.time}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {petNames?.[a.petId] ? `${petNames[a.petId]} — ` : ''}
                {[...a.services.map((s) => s.name), ...a.addons.map((x) => x.name)].join(', ')}
              </span>
              {(a.notes || a.customerNotes) && <span className="block truncate text-xs text-ink-500">{a.notes || a.customerNotes}</span>}
            </span>
            <span className="flex items-center gap-3">
              <StatusBadge status={a.status} />
              <span className="w-24 text-right font-semibold tabular-nums">{formatCents(a.totalCents)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
