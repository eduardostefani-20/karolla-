import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Search, Users } from 'lucide-react';
import { formatDateBR, formatPhone } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/admin/AdminUi';

export default function CustomersPage() {
  useDocumentMeta({ title: 'Clientes — Karolla Pet', noindex: true });
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const { data, loading, error } = useAsync(() => adminApi.customers(q || undefined), [q]);

  return (
    <div>
      <PageHeader title="Clientes" description="Tutores cadastrados pelo agendamento online." />
      <label className="relative mb-5 block max-w-md">
        <span className="sr-only">Buscar cliente</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
        <Input className="py-2.5 pl-10" placeholder="Nome, WhatsApp ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      {loading && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && data.length === 0 && <EmptyState icon={<Users className="h-10 w-10" />} title="Nenhum cliente encontrado" />}
      {data && data.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="hidden bg-cream-50 text-xs font-bold uppercase tracking-wide text-ink-400 md:table-header-group">
              <tr>
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">WhatsApp</th>
                <th className="px-5 py-3">E-mail</th>
                <th className="px-5 py-3">Cidade</th>
                <th className="px-5 py-3 text-center">Pets</th>
                <th className="px-5 py-3">Último agendamento</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {data.map((c) => (
                <tr key={c.id} className="relative block hover:bg-brand-50/50 md:table-row">
                  <td className="block px-5 pt-4 font-semibold md:table-cell md:py-3">
                    <Link to={`/admin/clientes/${c.id}`} className="after:absolute after:inset-0">{c.name}</Link>
                  </td>
                  <td className="block px-5 tabular-nums text-ink-600 md:table-cell md:py-3">{formatPhone(c.whatsapp)}</td>
                  <td className="hidden px-5 py-3 text-ink-600 md:table-cell">{c.email || '—'}</td>
                  <td className="block px-5 text-ink-600 md:table-cell md:py-3">{c.address.city || '—'}</td>
                  <td className="inline-block px-5 pb-4 text-ink-600 md:table-cell md:py-3 md:text-center">
                    <span className="md:hidden">Pets: </span>
                    {c.petCount}
                  </td>
                  <td className="inline-block pb-4 text-ink-600 md:table-cell md:px-5 md:py-3">
                    <span className="md:hidden">• Último: </span>
                    {c.lastAppointmentDate ? formatDateBR(c.lastAppointmentDate) : '—'}
                  </td>
                  <td className="absolute right-4 top-1/2 -translate-y-1/2 md:static md:translate-y-0 md:px-2">
                    <ChevronRight className="h-4 w-4 text-ink-300" aria-hidden />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
