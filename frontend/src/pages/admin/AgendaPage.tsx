import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addDays,
  formatDateLong,
  minutesToTime,
  nowInTimezone,
  timeToMinutes,
  weekdayOf,
  WEEKDAY_SHORT,
  type AppointmentDetail,
} from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useCatalog } from '@/context/CatalogContext';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { PageHeader, STATUS_STYLES } from '@/components/admin/AdminUi';
import { AppointmentCard } from '@/components/admin/AppointmentCard';
import { AppointmentFilters, type FilterState } from '@/components/admin/AppointmentFilters';
import { cn } from '@/utils/cn';

type View = 'day' | 'week' | 'list';
const HOUR_PX = 72;

/** Distribui atendimentos simultâneos em colunas ("lanes") para não se sobreporem visualmente. */
function assignLanes(items: AppointmentDetail[]) {
  const lanes: number[] = [];
  return items.map((a) => {
    const start = timeToMinutes(a.time);
    let lane = lanes.findIndex((end) => end <= start);
    if (lane === -1) lane = lanes.length;
    lanes[lane] = start + a.durationMinutes;
    return { a, lane };
  });
}

/** Com profissionais: uma coluna por profissional (+ "Sem profissional"). Sem: colunas por sobreposição. */
function professionalLanes(items: AppointmentDetail[], professionals: { id: string; name: string; color: string }[]) {
  const unassigned = items.filter((a) => !a.professionalId || !professionals.some((p) => p.id === a.professionalId));
  const extra = assignLanes(unassigned);
  const extraCount = Math.max(0, ...extra.map((e) => e.lane + 1));
  const placed = [
    ...items.filter((a) => !unassigned.includes(a)).map((a) => ({ a, lane: professionals.findIndex((p) => p.id === a.professionalId) })),
    ...extra.map((e) => ({ a: e.a, lane: professionals.length + e.lane })),
  ];
  const headers = [...professionals.map((p) => ({ name: p.name, color: p.color })), ...Array.from({ length: extraCount }, () => ({ name: 'Sem profissional', color: '#9ca3af' }))];
  return { placed, headers };
}

function DayTimeline({ items, open, close, professionals }: { items: AppointmentDetail[]; open: number; close: number; professionals: { id: string; name: string; color: string }[] }) {
  const visible = items.filter((a) => a.status !== 'cancelled');
  const byPro = professionals.length > 0 ? professionalLanes(visible, professionals) : null;
  const placed = byPro ? byPro.placed : assignLanes(visible);
  const laneCount = Math.max(1, byPro ? byPro.headers.length : 0, ...placed.map((p) => p.lane + 1));
  const hours = [];
  for (let m = Math.floor(open / 60) * 60; m <= close; m += 60) hours.push(m);
  const height = ((close - Math.floor(open / 60) * 60) / 60) * HOUR_PX;
  const base = Math.floor(open / 60) * 60;
  return (
    <div className="card overflow-x-auto p-4">
      {byPro && (
        <div className="mb-2 ml-16 grid gap-1" style={{ gridTemplateColumns: `repeat(${laneCount}, minmax(0, 1fr))`, minWidth: laneCount * 120 }}>
          {byPro.headers.map((h, i) => (
            <span key={i} className="truncate rounded-lg px-2 py-1 text-center text-xs font-bold text-white" style={{ background: h.color }}>
              {h.name}
            </span>
          ))}
        </div>
      )}
      <div className="relative min-w-[320px]" style={{ height, minWidth: byPro ? laneCount * 120 + 64 : undefined }}>
        {hours.map((m) => (
          <div key={m} className="absolute inset-x-0 flex items-start gap-3" style={{ top: ((m - base) / 60) * HOUR_PX }}>
            <span className="w-12 -translate-y-2 text-right text-xs font-semibold tabular-nums text-ink-400">{minutesToTime(m)}</span>
            <span className="h-px flex-1 bg-ink-900/10" />
          </div>
        ))}
        <div className="absolute inset-y-0 left-16 right-0">
          {placed.map(({ a, lane }) => (
            <Link
              key={a.id}
              to={`/admin/agendamentos/${a.id}`}
              className={cn('absolute overflow-hidden rounded-xl border-l-4 border-brand-600 px-2.5 py-1.5 text-xs shadow-card transition-transform hover:z-10 hover:scale-[1.01]', STATUS_STYLES[a.status])}
              style={{
                borderLeftColor: a.professional?.color,
                top: ((timeToMinutes(a.time) - base) / 60) * HOUR_PX + 1,
                height: Math.max(28, (a.durationMinutes / 60) * HOUR_PX - 3),
                left: `calc(${(lane / laneCount) * 100}% + 2px)`,
                width: `calc(${100 / laneCount}% - 4px)`,
              }}
            >
              <p className="font-display text-sm font-semibold">
                {a.time} · {a.pet.name}
              </p>
              <p className="truncate">{a.services.map((s) => s.name).join(' + ')}</p>
              <p className="truncate opacity-75">{a.customer.name}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AgendaPage() {
  useDocumentMeta({ title: 'Agenda — Karolla Pet', noindex: true });
  const { catalog } = useCatalog();
  const tz = catalog?.settings.timezone ?? 'America/Sao_Paulo';
  const today = nowInTimezone(new Date(), tz).date;
  const [view, setView] = useState<View>('day');
  const [date, setDate] = useState(today);
  const [filters, setFilters] = useState<FilterState>({ status: '', serviceId: '', search: '', professionalId: '' });
  const search = useDebounce(filters.search);

  const range = useMemo(() => {
    if (view === 'day') return { from: date, to: date };
    if (view === 'week') {
      const start = addDays(date, -weekdayOf(date));
      return { from: start, to: addDays(start, 6) };
    }
    return { from: date, to: addDays(date, 30) };
  }, [view, date]);

  const { data: adminCatalog } = useAsync(() => adminApi.catalog(), []);
  const { data, loading, error } = useAsync(
    () => adminApi.appointments({ ...range, status: filters.status || undefined, serviceId: filters.serviceId || undefined, professionalId: filters.professionalId || undefined, search: search || undefined }),
    [range.from, range.to, filters.status, filters.serviceId, filters.professionalId, search],
  );

  const hours = catalog?.businessHours.find((h) => h.weekday === weekdayOf(date));
  const open = hours?.isOpen ? timeToMinutes(hours.openTime) : 8 * 60;
  const close = hours?.isOpen ? timeToMinutes(hours.closeTime) : 18 * 60;
  const step = view === 'day' ? 1 : view === 'week' ? 7 : 30;

  return (
    <div>
      <PageHeader title="Agenda" description="Visualize os atendimentos por dia, semana ou em lista." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Visualização" className="inline-flex rounded-full bg-white p-1 shadow-card">
          {(
            [
              ['day', 'Dia'],
              ['week', 'Semana'],
              ['list', 'Lista'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn('rounded-full px-5 py-2 text-sm font-semibold transition-colors', view === v ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-900/5')}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDate(addDays(date, -step))} aria-label="Período anterior" icon={<ChevronLeft className="h-5 w-5" />} />
          <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-auto py-2" aria-label="Data" />
          <Button variant="ghost" size="sm" onClick={() => setDate(addDays(date, step))} aria-label="Próximo período" icon={<ChevronRight className="h-5 w-5" />} />
          <Button variant="outline" size="sm" onClick={() => setDate(today)}>
            Hoje
          </Button>
        </div>
      </div>
      <div className="mb-5">
        <AppointmentFilters value={filters} onChange={setFilters} services={adminCatalog?.services ?? []} professionals={adminCatalog?.professionals ?? []} />
      </div>

      <h2 className="mb-3 font-display text-lg first-letter:uppercase text-ink-700">
        {view === 'day' ? formatDateLong(date) : `${formatDateLong(range.from)} — ${formatDateLong(range.to)}`}
      </h2>

      {loading && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && view === 'day' && (data.length === 0 ? <EmptyState title="Nenhum agendamento neste dia" /> : <DayTimeline items={data} open={open} close={close} professionals={(adminCatalog?.professionals ?? []).filter((p) => p.active || data.some((a) => a.professionalId === p.id))} />)}
      {data && view === 'week' && (
        <div className="scroll-thin -mx-4 overflow-x-auto px-4 pb-2">
          <div className="grid min-w-[840px] grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, i) => addDays(range.from, i)).map((d) => {
              const dayItems = data.filter((a) => a.date === d);
              return (
                <div key={d} className={cn('rounded-2xl p-2', d === today ? 'bg-brand-100/70' : 'bg-white shadow-card')}>
                  <button type="button" onClick={() => { setDate(d); setView('day'); }} className="mb-2 w-full rounded-xl px-2 py-1 text-left hover:bg-ink-900/5">
                    <span className="block text-xs font-bold uppercase text-ink-400">{WEEKDAY_SHORT[weekdayOf(d)]}</span>
                    <span className="font-display text-lg font-semibold">{d.slice(8)}</span>
                  </button>
                  <ul className="space-y-1.5">
                    {dayItems.map((a) => (
                      <li key={a.id}>
                        <Link to={`/admin/agendamentos/${a.id}`} className={cn('block rounded-xl px-2 py-1.5 text-xs', STATUS_STYLES[a.status])}>
                          <span className="font-semibold tabular-nums">{a.time}</span> {a.pet.name}
                          <span className="block truncate opacity-75">{a.services.map((s) => s.name).join(' + ')}</span>
                        </Link>
                      </li>
                    ))}
                    {dayItems.length === 0 && <li className="px-2 text-xs text-ink-300">—</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {data && view === 'list' && (
        data.length === 0 ? (
          <EmptyState title="Nenhum agendamento nos próximos 30 dias" />
        ) : (
          <div className="space-y-6">
            {[...new Set(data.map((a) => a.date))].map((d) => (
              <section key={d}>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-500">{formatDateLong(d)}</h3>
                <ul className="space-y-2">
                  {data.filter((a) => a.date === d).map((a) => (
                    <li key={a.id}>
                      <AppointmentCard a={a} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      )}
    </div>
  );
}
