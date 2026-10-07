import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { formatAge, formatCents, formatPhone } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { PageHeader, Panel } from '@/components/admin/AdminUi';
import { AppointmentHistory } from '@/components/admin/AppointmentHistory';
import { EditPetModal } from '@/components/admin/EditPetModal';

export default function PetDetailPage() {
  const { id = '' } = useParams();
  useDocumentMeta({ title: 'Pet — Karolla Pet', noindex: true });
  const { data: p, loading, error, reload } = useAsync(() => adminApi.pet(id), [id]);
  const { data: catalog } = useAsync(() => adminApi.catalog(), []);
  const [editing, setEditing] = useState(false);
  if (loading && !p) return <Spinner />;
  if (error || !p) return <Alert tone="error">{error ?? 'Pet não encontrado.'}</Alert>;
  const species = catalog?.species.find((s) => s.id === p.speciesId);
  const done = p.appointments.filter((a) => a.status === 'completed');

  return (
    <div>
      <Link to="/admin/pets" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Pets
      </Link>
      <PageHeader
        title={`${species?.emoji ?? ''} ${p.name}`}
        description={`${p.breedName} • tutor ${p.customer.name}`}
        actions={catalog && <Button variant="outline" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>Editar</Button>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Panel title="Dados do pet">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-ink-500">Espécie</dt><dd>{species?.name}</dd>
              <dt className="text-ink-500">Raça</dt><dd>{p.breedName}</dd>
              <dt className="text-ink-500">Porte</dt><dd>{catalog?.sizes.find((s) => s.id === p.sizeId)?.name}</dd>
              <dt className="text-ink-500">Peso</dt><dd>{p.weightKg != null ? `${p.weightKg} kg` : '—'}</dd>
              <dt className="text-ink-500">Idade</dt><dd>{formatAge(p.ageMonths) || '—'}</dd>
              <dt className="text-ink-500">Observações</dt><dd>{p.notes || '—'}</dd>
            </dl>
          </Panel>
          <Panel title="Tutor">
            <p className="text-sm">
              <Link to={`/admin/clientes/${p.customer.id}`} className="font-semibold text-brand-700 hover:underline">{p.customer.name}</Link>
              <br />
              {formatPhone(p.customer.whatsapp)}
            </p>
          </Panel>
          <Panel title="Resumo">
            <p className="text-sm text-ink-600">
              {done.length} atendimento(s) concluído(s) • {formatCents(done.reduce((s, a) => s + a.totalCents, 0))}
            </p>
          </Panel>
        </div>
        <Panel title="Histórico">
          <AppointmentHistory items={p.appointments} />
        </Panel>
      </div>
      {editing && catalog && <EditPetModal open pet={p} catalog={catalog} onClose={() => setEditing(false)} onSaved={() => void reload()} />}
    </div>
  );
}
