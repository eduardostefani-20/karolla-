import { CalendarCheck, CalendarClock, CircleDollarSign, Hourglass, PawPrint, Users } from 'lucide-react';
import { formatCents, formatDateLong } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useAuth } from '@/context/AuthContext';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { ButtonLink } from '@/components/ui/Button';
import { PageHeader, Panel, StatCard } from '@/components/admin/AdminUi';
import { AppointmentCard } from '@/components/admin/AppointmentCard';
import { SystemModeNotice } from '@/components/admin/SystemModeNotice';

export default function DashboardPage() {
  useDocumentMeta({ title: 'Dashboard — Karolla Pet', noindex: true });
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => adminApi.dashboard(), []);
  const firstName = user?.name.split(' ')[0] ?? '';

  return (
    <div>
      <PageHeader
        title={`Olá${firstName ? `, ${firstName}` : ''}! 👋`}
        description={data ? <span className="inline-block first-letter:uppercase">{formatDateLong(data.today)}</span> : undefined}
        actions={<ButtonLink to="/admin/agenda" variant="outline" size="sm">Abrir agenda</ButtonLink>}
      />
      <SystemModeNotice />
      {loading && <Spinner />}
      {error && <Alert tone="error" action={<button className="font-semibold underline" onClick={() => reload()}>Tentar novamente</button>}>{error}</Alert>}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            <StatCard label="Agendamentos hoje" value={data.stats.appointmentsToday} icon={<CalendarCheck className="h-6 w-6" />} />
            <StatCard label="Próximos" value={data.stats.upcoming} icon={<CalendarClock className="h-6 w-6" />} tone="ink" />
            <StatCard label="Pendentes" value={data.stats.pending} icon={<Hourglass className="h-6 w-6" />} tone="sun" />
            <StatCard label="Confirmados" value={data.stats.confirmed} icon={<CalendarCheck className="h-6 w-6" />} tone="brand" />
            <StatCard label="Clientes" value={data.stats.customers} icon={<Users className="h-6 w-6" />} tone="coral" />
            <StatCard label="Pets" value={data.stats.pets} icon={<PawPrint className="h-6 w-6" />} tone="coral" />
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Panel
              title="Agenda de hoje"
              actions={
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink-500">
                  <CircleDollarSign className="h-4 w-4" aria-hidden /> {formatCents(data.stats.revenueTodayCents)}
                </span>
              }
            >
              {data.todayAgenda.length === 0 ? (
                <EmptyState title="Nenhum atendimento hoje">Aproveite para organizar a semana. 🐾</EmptyState>
              ) : (
                <ol className="space-y-2.5">
                  {data.todayAgenda.map((a) => (
                    <li key={a.id}>
                      <AppointmentCard a={a} />
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
            <Panel title="Próximos agendamentos" actions={<ButtonLink to="/admin/agendamentos" size="sm" variant="ghost">Ver todos</ButtonLink>}>
              {data.nextAppointments.length === 0 ? (
                <EmptyState title="Sem próximos agendamentos" />
              ) : (
                <ol className="space-y-2.5">
                  {data.nextAppointments.map((a) => (
                    <li key={a.id}>
                      <AppointmentCard a={a} showDate />
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
          <Panel title="De onde vieram os agendamentos (últimos 30 dias)">
            {data.channels.length === 0 ? (
              <EmptyState title="Nenhum agendamento online nos últimos 30 dias" />
            ) : (
              <ul className="divide-y divide-ink-900/5" data-testid="dashboard-channels">
                {data.channels.map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2 font-semibold">
                      <span className="truncate">{c.label}</span>
                      {c.paid && <span className="shrink-0 rounded-full bg-coral-100 px-2 py-0.5 text-xs font-bold text-coral-700">ANÚNCIO</span>}
                    </span>
                    <span className="shrink-0 text-right text-sm tabular-nums">
                      <strong>{c.count}</strong> {c.count === 1 ? 'agendamento' : 'agendamentos'}
                      <span className="block text-xs text-ink-500">{formatCents(c.revenueCents)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink-400">
              A origem vem do link que o cliente abriu (parâmetros UTM e cliques em anúncios). Use links com UTM nas campanhas — veja docs/ANUNCIOS.md.
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}
