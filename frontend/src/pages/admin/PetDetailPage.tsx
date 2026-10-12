import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, ImagePlus, Pencil, Trash2 } from 'lucide-react';
import { formatAge, formatCents, formatDateBR, formatPhone, type PetDetail } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useAuth } from '@/context/AuthContext';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { PageHeader, Panel } from '@/components/admin/AdminUi';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { friendlyMessage } from '@/services/api';
import { uploadPrivatePhoto } from '@/services/mediaUpload';
import { AppointmentHistory } from '@/components/admin/AppointmentHistory';
import { EditPetModal } from '@/components/admin/EditPetModal';

export default function PetDetailPage() {
  const { id = '' } = useParams();
  useDocumentMeta({ title: 'Pet — Karolla Pet', noindex: true });
  const { can } = useAuth();
  const { data: p, loading, error, reload, setData } = useAsync(() => adminApi.pet(id), [id]);
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
        actions={catalog && can('pets.edit') && <Button variant="outline" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>Editar</Button>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Panel title="Dados do pet">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-ink-500">Espécie</dt><dd>{species?.name}</dd>
              <dt className="text-ink-500">Raça</dt><dd>{p.breedName}</dd>
              <dt className="text-ink-500">Porte</dt><dd>{catalog?.sizes.find((s) => s.id === p.sizeId)?.name}</dd>
              <dt className="text-ink-500">Peso</dt><dd>{p.weightKg != null ? `${p.weightKg} kg` : '—'}</dd>
              <dt className="text-ink-500">Nascimento</dt><dd>{p.birthDate ? formatDateBR(p.birthDate) : '—'}</dd>
              <dt className="text-ink-500">Idade</dt><dd>{formatAge(p.ageMonths) || '—'}</dd>
              <dt className="text-ink-500">Características</dt><dd>{p.characteristics || '—'}</dd>
              <dt className="text-ink-500">Pref. de tosa</dt><dd>{p.groomingPreferences || '—'}</dd>
              <dt className="text-ink-500">Observações</dt><dd>{p.notes || '—'}</dd>
            </dl>
            {p.internalNotes && (
              <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-sun-50 px-3 py-2 text-sm text-ink-800">
                <strong>Interno (só a equipe vê):</strong> {p.internalNotes}
              </p>
            )}
          </Panel>
          <PetPhotos pet={p} canEdit={can('pets.edit')} onChange={setData} />
          <Panel title="Tutor">
            <p className="text-sm">
              {can('customers.view') ? (
                <Link to={`/admin/clientes/${p.customer.id}`} className="font-semibold text-brand-700 hover:underline">{p.customer.name}</Link>
              ) : (
                <span className="font-semibold">{p.customer.name}</span>
              )}
              <br />
              {formatPhone(p.customer.whatsapp)}
            </p>
          </Panel>
          <Panel title="Resumo">
            <p className="text-sm text-ink-600">
              {done.length} atendimento(s) concluído(s)
              {done.every((a) => a.totalCents !== undefined) && ` • ${formatCents(done.reduce((s, a) => s + a.totalCents, 0))}`}
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

/** Foto do pet e fotos de referência (armazenamento privado; links temporários). */
function PetPhotos({ pet, canEdit, onChange }: { pet: PetDetail; canEdit: boolean; onChange: (p: PetDetail) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<'photo' | 'ref' | null>(null);
  const [description, setDescription] = useState('');
  const photoInput = useRef<HTMLInputElement>(null);
  const refInput = useRef<HTMLInputElement>(null);

  const send = async (file: File | undefined, kind: 'pet-photo' | 'pet-reference') => {
    if (!file) return;
    setBusy(kind === 'pet-photo' ? 'photo' : 'ref');
    try {
      const path = await uploadPrivatePhoto(file, (t) => adminApi.petUploadTicket(pet.id, { kind, ...t }));
      onChange(kind === 'pet-photo' ? await adminApi.setPetPhoto(pet.id, path) : await adminApi.addPetReference(pet.id, { path, description }));
      setDescription('');
      toast('Foto enviada.');
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setBusy(null);
      if (photoInput.current) photoInput.current.value = '';
      if (refInput.current) refInput.current.value = '';
    }
  };

  const remove = async (refId: string) => {
    try {
      onChange(await adminApi.removePetReference(pet.id, refId));
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    }
  };

  return (
    <Panel title="Fotos">
      <div className="flex items-center gap-4">
        {pet.photoUrl ? (
          <img src={pet.photoUrl} alt={`Foto de ${pet.name}`} className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <span className="grid h-20 w-20 place-items-center rounded-full bg-brand-100 text-xs text-ink-500">Sem foto</span>
        )}
        {canEdit && (
          <>
            <Button size="sm" variant="outline" loading={busy === 'photo'} onClick={() => photoInput.current?.click()} icon={<Camera className="h-4 w-4" aria-hidden />}>
              {pet.photoUrl ? 'Trocar foto' : 'Enviar foto'}
            </Button>
            <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => send(e.target.files?.[0], 'pet-photo')} />
          </>
        )}
      </div>
      <p className="mt-4 text-sm font-semibold text-ink-700">Referências de corte ({pet.references.length})</p>
      {pet.references.length > 0 && (
        <ul className="mt-2 grid grid-cols-3 gap-2">
          {pet.references.map((r) => (
            <li key={r.id} className="relative">
              <a href={r.url} target="_blank" rel="noopener noreferrer" title={r.description}>
                <img src={r.url} alt={r.description || 'Referência'} className="aspect-square w-full rounded-xl object-cover" />
              </a>
              {r.description && <p className="mt-1 line-clamp-2 text-[11px] text-ink-500">{r.description}</p>}
              {canEdit && (
                <button type="button" onClick={() => remove(r.id)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1" aria-label="Apagar referência">
                  <Trash2 className="h-3.5 w-3.5 text-danger-600" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="Descrição da referência" className="min-w-0 flex-1">
            {(p) => <Input {...p} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          <Button size="sm" loading={busy === 'ref'} onClick={() => refInput.current?.click()} icon={<ImagePlus className="h-4 w-4" aria-hidden />}>Enviar</Button>
          <input ref={refInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => send(e.target.files?.[0], 'pet-reference')} />
        </div>
      )}
    </Panel>
  );
}
