import { useState } from 'react';
import { addDays, nowInTimezone } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useCatalog } from '@/context/CatalogContext';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/admin/AdminUi';
import { AppointmentCard } from '@/components/admin/AppointmentCard';
import { AppointmentFilters, type FilterState } from '@/components/admin/AppointmentFilters';

export default function AppointmentsPage() {
  useDocumentMeta({ title: 'Agendamentos — Karolla Pet', noindex: true });
  const { catalog } = useCatalog();
  const today = nowInTimezone(new Date(), catalog?.settings.timezone ?? 'America/Sao_Paulo').date;
  const [from, setFrom] = useState(addDays(today, -7));
  const [to, setTo] = useState(addDays(today, 60));
  const [filters, setFilters] = useState<FilterState>({ status: '', serviceId: '', search: '' });
  const search = useDebounce(filters.search);
  const { data: adminCatalog } = useAsync(() => adminApi.catalog(), []);
  const { data, loading, error } = useAsync(
    () => adminApi.appointments({ from: from || undefined, to: to || undefined, status: filters.status || undefined, serviceId: filters.serviceId || undefined, professionalId: filters.professionalId || undefined, search: search || undefined }),
    [from, to, filters.status, filters.serviceId, filters.professionalId, search],
  );

  return (
    <div>
      <PageHeader title="Agendamentos" description="Todos os agendamentos recebidos pelo site e pelo painel." />
      <div className="card mb-5 space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="De" required>{(p) => <Input {...p} type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="py-2.5" />}</Field>
          <Field label="Até" required>{(p) => <Input {...p} type="date" value={to} onChange={(e) => setTo(e.target.value)} className="py-2.5" />}</Field>
        </div>
        <AppointmentFilters value={filters} onChange={setFilters} services={adminCatalog?.services ?? []} professionals={adminCatalog?.professionals ?? []} />
      </div>
      {loading && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && (
        <>
          <p className="mb-3 text-sm text-ink-500">{data.length} agendamento(s)</p>
          {data.length === 0 ? (
            <EmptyState title="Nenhum agendamento encontrado">Ajuste os filtros ou o período.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {data.map((a) => (
                <li key={a.id}>
                  <AppointmentCard a={a} showDate />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
