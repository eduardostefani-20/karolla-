import { useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, ImagePlus, Pencil, Trash2 } from 'lucide-react';
import { formatAge, formatDateBR } from '@karolla/shared';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { useCatalog } from '@/context/CatalogContext';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { accountApi } from '@/services/accountApi';
import { friendlyMessage } from '@/services/api';
import { uploadPrivatePhoto } from '@/services/mediaUpload';
import { Button } from '@/components/ui/Button';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { PetFormModal } from '@/components/account/PetFormModal';

/** Ficha do pet na área do cliente: dados, foto e fotos de referência (privadas). */
export default function AccountPetPage() {
  const { id = '' } = useParams();
  useDocumentMeta({ title: 'Meu pet — Karolla Pet', noindex: true });
  const { status } = useCustomerAuth();
  const { catalog } = useCatalog();
  const toast = useToast();
  const { data: pet, loading, error, setData } = useAsync(() => accountApi.pet(id), [id]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'photo' | 'ref' | null>(null);
  const [refDescription, setRefDescription] = useState('');
  const photoInput = useRef<HTMLInputElement>(null);
  const refInput = useRef<HTMLInputElement>(null);

  if (status === 'anonymous') return <Navigate to="/minha-conta/entrar" replace />;
  if ((loading || status === 'checking') && !pet) return <Spinner className="min-h-[50vh]" />;
  if (error || !pet) return <div className="container-page py-10"><Alert tone="error">{error ?? 'Pet não encontrado.'}</Alert></div>;

  const species = catalog?.species.find((s) => s.id === pet.speciesId);
  const size = catalog?.sizes.find((s) => s.id === pet.sizeId);

  const sendPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy('photo');
    try {
      const path = await uploadPrivatePhoto(file, (t) => accountApi.uploadTicket(pet.id, { kind: 'pet-photo', ...t }));
      setData(await accountApi.setPhoto(pet.id, path));
      toast('Foto atualizada!');
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setBusy(null);
      if (photoInput.current) photoInput.current.value = '';
    }
  };

  const sendReference = async (file: File | undefined) => {
    if (!file) return;
    setBusy('ref');
    try {
      const path = await uploadPrivatePhoto(file, (t) => accountApi.uploadTicket(pet.id, { kind: 'pet-reference', ...t }));
      setData(await accountApi.addReference(pet.id, { path, description: refDescription }));
      setRefDescription('');
      toast('Foto de referência enviada.');
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setBusy(null);
      if (refInput.current) refInput.current.value = '';
    }
  };

  const removeReference = async (refId: string) => {
    try {
      await accountApi.removeReference(refId);
      setData({ ...pet, references: pet.references.filter((r) => r.id !== refId) });
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    }
  };

  const rows: [string, string][] = [
    ['Espécie', `${species?.emoji ?? ''} ${species?.name ?? ''}`.trim()],
    ['Raça', pet.breedName],
    ['Porte', size?.name ?? ''],
    ['Nascimento', pet.birthDate ? formatDateBR(pet.birthDate) : '—'],
    ['Idade', formatAge(pet.ageMonths) || '—'],
    ['Peso', pet.weightKg != null ? `${pet.weightKg} kg` : '—'],
    ['Características', pet.characteristics || '—'],
    ['Preferências de tosa', pet.groomingPreferences || '—'],
    ['Observações', pet.notes || '—'],
  ];

  return (
    <div className="container-page space-y-6 py-10">
      <Link to="/minha-conta" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Minha conta
      </Link>
      <div className="flex flex-wrap items-center gap-5">
        <div className="relative">
          {pet.photoUrl ? (
            <img src={pet.photoUrl} alt={`Foto de ${pet.name}`} className="h-28 w-28 rounded-full object-cover shadow-soft" />
          ) : (
            <span className="grid h-28 w-28 place-items-center rounded-full bg-brand-100 text-5xl" aria-hidden>{species?.emoji ?? '🐾'}</span>
          )}
          <button
            type="button"
            onClick={() => photoInput.current?.click()}
            disabled={busy !== null}
            className="absolute -bottom-1 -right-1 grid h-10 w-10 place-items-center rounded-full bg-primary text-white shadow-soft disabled:opacity-60"
            aria-label={pet.photoUrl ? 'Trocar foto' : 'Enviar foto'}
          >
            <Camera className="h-5 w-5" aria-hidden />
          </button>
          <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => sendPhoto(e.target.files?.[0])} data-testid="pet-photo-input" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-extrabold text-ink-900">{pet.name}</h1>
          <p className="text-ink-600">{pet.breedName}</p>
          {busy === 'photo' && <p className="text-sm text-brand-700">Enviando foto…</p>}
        </div>
        <Button variant="outline" onClick={() => setEditing(true)} icon={<Pencil className="h-4 w-4" aria-hidden />}>Editar dados</Button>
      </div>

      <dl className="card grid gap-x-6 gap-y-2 p-5 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-semibold text-ink-500">{k}</dt>
            <dd className="break-words text-ink-800">{v}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="referencias" className="space-y-3">
        <h2 id="referencias" className="text-xl font-extrabold text-ink-900">Fotos de referência</h2>
        <p className="text-sm text-ink-600">Mostre o corte que você gosta. Só você e a equipe da Karolla Pet veem estas fotos.</p>
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <Field label="Descrição (opcional)" className="min-w-0 flex-1">
            {(p) => <Input {...p} value={refDescription} maxLength={300} onChange={(e) => setRefDescription(e.target.value)} placeholder="Ex.: assim, com a franja curta" />}
          </Field>
          <Button onClick={() => refInput.current?.click()} loading={busy === 'ref'} icon={<ImagePlus className="h-4 w-4" aria-hidden />}>Enviar foto</Button>
          <input ref={refInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => sendReference(e.target.files?.[0])} data-testid="pet-reference-input" />
        </div>
        {pet.references.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {pet.references.map((r) => (
              <li key={r.id} className="card overflow-hidden">
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  <img src={r.url} alt={r.description || 'Foto de referência'} className="aspect-square w-full object-cover" />
                </a>
                <div className="flex items-start justify-between gap-2 p-2">
                  <p className="min-w-0 break-words text-xs text-ink-600">{r.description || '—'}</p>
                  <button type="button" onClick={() => removeReference(r.id)} className="shrink-0 rounded-full p-1.5 hover:bg-danger-50" aria-label="Apagar foto de referência">
                    <Trash2 className="h-4 w-4 text-danger-600" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <PetFormModal
          pet={pet}
          onClose={() => setEditing(false)}
          onSave={async (body) => {
            setData(await accountApi.updatePet(pet.id, body));
            toast('Dados do pet atualizados.');
          }}
        />
      )}
    </div>
  );
}
