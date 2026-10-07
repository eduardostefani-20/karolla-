import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PawPrint, Search } from 'lucide-react';
import { formatAge } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/admin/AdminUi';

export default function PetsPage() {
  useDocumentMeta({ title: 'Pets — Karolla Pet', noindex: true });
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const { data, loading, error } = useAsync(() => adminApi.pets(q || undefined), [q]);
  const { data: catalog } = useAsync(() => adminApi.catalog(), []);
  const speciesOf = (id: string) => catalog?.species.find((s) => s.id === id);
  const sizeOf = (id: string) => catalog?.sizes.find((s) => s.id === id)?.name ?? '';

  return (
    <div>
      <PageHeader title="Pets" description="Todos os pets cadastrados, com histórico de atendimentos." />
      <label className="relative mb-5 block max-w-md">
        <span className="sr-only">Buscar pet</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
        <Input className="py-2.5 pl-10" placeholder="Nome do pet, raça ou tutor" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      {loading && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && data.length === 0 && <EmptyState icon={<PawPrint className="h-10 w-10" />} title="Nenhum pet encontrado" />}
      {data && data.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <li key={p.id}>
              <Link to={`/admin/pets/${p.id}`} className="card flex h-full gap-4 p-4 transition-all hover:-translate-y-0.5 hover:shadow-soft">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-2xl" aria-hidden>{speciesOf(p.speciesId)?.emoji ?? '🐾'}</span>
                <div className="min-w-0 text-sm">
                  <p className="font-display text-lg font-semibold">{p.name}</p>
                  <p className="text-ink-600">{p.breedName} • {sizeOf(p.sizeId)}</p>
                  <p className="text-ink-500">{[p.weightKg != null && `${p.weightKg} kg`, formatAge(p.ageMonths)].filter(Boolean).join(' • ') || '—'}</p>
                  <p className="mt-1 truncate text-xs text-ink-400">Tutor: {p.customerName}</p>
                  {p.notes && <p className="mt-1 line-clamp-2 text-xs text-ink-500">“{p.notes}”</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
