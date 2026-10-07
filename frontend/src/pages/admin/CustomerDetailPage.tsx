import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Pencil } from 'lucide-react';
import { buildWhatsAppLink, formatAge, formatPhone } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { Button, ExternalButton } from '@/components/ui/Button';
import { PageHeader, Panel } from '@/components/admin/AdminUi';
import { AppointmentHistory } from '@/components/admin/AppointmentHistory';
import { EditCustomerModal } from '@/components/admin/EditCustomerModal';

export default function CustomerDetailPage() {
  const { id = '' } = useParams();
  useDocumentMeta({ title: 'Cliente — Karolla Pet', noindex: true });
  const { data: c, loading, error, reload } = useAsync(() => adminApi.customer(id), [id]);
  const [editing, setEditing] = useState(false);
  if (loading && !c) return <Spinner />;
  if (error || !c) return <Alert tone="error">{error ?? 'Cliente não encontrado.'}</Alert>;
  const petNames = Object.fromEntries(c.pets.map((p) => [p.id, p.name]));

  return (
    <div>
      <Link to="/admin/clientes" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Clientes
      </Link>
      <PageHeader
        title={c.name}
        description={`Cliente desde ${new Date(c.createdAt).toLocaleDateString('pt-BR')}`}
        actions={
          <>
            <Button variant="outline" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>Editar</Button>
            <ExternalButton href={buildWhatsAppLink(c.whatsapp)} variant="whatsapp" size="sm" icon={<MessageCircle className="h-4 w-4" aria-hidden />}>WhatsApp</ExternalButton>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Panel title="Dados pessoais">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-ink-500">WhatsApp</dt><dd>{formatPhone(c.whatsapp)}</dd>
              <dt className="text-ink-500">E-mail</dt><dd className="break-all">{c.email || '—'}</dd>
              <dt className="text-ink-500">Endereço</dt>
              <dd>{[c.address.street && `${c.address.street}, ${c.address.number}`, c.address.complement, c.address.neighborhood, c.address.city].filter(Boolean).join(' — ') || '—'}</dd>
              <dt className="text-ink-500">Obs.</dt><dd>{c.notes || '—'}</dd>
            </dl>
          </Panel>
          <Panel title={`Pets (${c.pets.length})`}>
            <ul className="space-y-2">
              {c.pets.map((p) => (
                <li key={p.id}>
                  <Link to={`/admin/pets/${p.id}`} className="block rounded-2xl border border-ink-900/5 px-4 py-3 hover:border-brand-200 hover:bg-brand-50">
                    <p className="font-display text-lg font-semibold">{p.name}</p>
                    <p className="text-sm text-ink-500">{[p.breedName, p.weightKg != null && `${p.weightKg} kg`, formatAge(p.ageMonths)].filter(Boolean).join(' • ')}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <Panel title="Histórico de agendamentos">
          <AppointmentHistory items={c.appointments} petNames={petNames} />
        </Panel>
      </div>
      {editing && <EditCustomerModal open customer={c} onClose={() => setEditing(false)} onSaved={() => void reload()} />}
    </div>
  );
}
