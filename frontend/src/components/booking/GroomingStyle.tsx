import { useMemo, useRef, useState } from 'react';
import { Camera, Check, X } from 'lucide-react';
import { GROOMING_TYPE_LABELS, type PublicInspiration } from '@karolla/shared';
import { useCatalog } from '@/context/CatalogContext';
import { useBooking } from '@/context/BookingContext';
import { useAsync } from '@/hooks/useAsync';
import { publicApi } from '@/services/publicApi';
import { friendlyMessage } from '@/services/api';
import { uploadPrivatePhoto } from '@/services/mediaUpload';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { cn } from '@/utils/cn';

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Estilo de tosa (só aparece quando o serviço escolhido inclui tosa): sugestões do catálogo de
 * inspirações DA RAÇA do pet (nunca inventadas), descrição livre e foto de referência própria (privada).
 */
export function GroomingStyle() {
  const { catalog } = useCatalog();
  const { draft, update } = useBooking();
  const { data: inspirations } = useAsync(() => publicApi.inspirations(), []);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const breed = normalize(draft.pet.breedName);
    return (inspirations ?? []).filter(
      (i: PublicInspiration) =>
        i.speciesId === draft.speciesId && ((draft.pet.breedId && i.breedId === draft.pet.breedId) || (breed && normalize(i.breedName) === breed)),
    );
  }, [inspirations, draft.speciesId, draft.pet.breedId, draft.pet.breedName]);

  const uploadsOn = catalog?.features.customerAccounts ?? false;

  const send = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const path = await uploadPrivatePhoto(file, (t) => publicApi.groomingUploadTicket(t));
      update((d) => ({ groomingReference: { path, description: d.groomingReference?.description ?? '' } }));
      setPreview(URL.createObjectURL(file));
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <section aria-labelledby="estilo-tosa" className="mt-8 rounded-card border-2 border-brand-100 bg-white p-4 sm:p-5">
      <h2 id="estilo-tosa" className="text-lg font-extrabold text-ink-900">Estilo de tosa</h2>
      <p className="text-sm text-ink-600">Opcional — mostre como você gosta. A equipe confirma com você no atendimento.</p>

      <h3 className="mt-4 text-sm font-bold text-ink-700">
        Sugestões para {draft.pet.breedName || 'a raça do seu pet'}
      </h3>
      {suggestions.length === 0 ? (
        <p className="mt-1 text-sm text-ink-500">Ainda não temos fotos desta raça no catálogo. Você pode descrever ou enviar uma foto abaixo.</p>
      ) : (
        <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="grooming-suggestions">
          {suggestions.map((i) => {
            const selected = draft.inspiration?.id === i.id;
            return (
              <li key={i.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => update({ inspiration: selected ? null : { id: i.id, title: i.title, imageUrl: i.imageUrl, breedName: i.breedName } })}
                  className={cn('relative block w-full overflow-hidden rounded-2xl border-2 text-left', selected ? 'border-brand-600' : 'border-transparent')}
                >
                  <img src={i.imageUrl} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                  <span className="block truncate px-2 py-1 text-xs font-semibold">{i.title}</span>
                  {i.groomingType && <span className="block truncate px-2 pb-1 text-[11px] text-ink-500">{GROOMING_TYPE_LABELS[i.groomingType]}</span>}
                  {selected && (
                    <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-white" aria-hidden>
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Field label="Como você quer a tosa?" className="mt-4" hint="Ex.: bem curtinha no corpo, orelhas redondas.">
        {(p) => <Textarea {...p} rows={2} maxLength={500} value={draft.groomingNotes} onChange={(e) => update({ groomingNotes: e.target.value })} />}
      </Field>

      {uploadsOn && (
        <div className="mt-4">
          {error && <Alert tone="error" className="mb-2">{error}</Alert>}
          {draft.groomingReference ? (
            <div className="flex flex-wrap items-start gap-3">
              {preview && <img src={preview} alt="Sua foto de referência" className="h-20 w-20 rounded-xl object-cover" />}
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-semibold text-leaf-700">Foto de referência enviada ✓ (só a equipe vê)</p>
                <Field label="Descrição da foto (opcional)">
                  {(p) => (
                    <Input
                      {...p}
                      maxLength={300}
                      value={draft.groomingReference?.description ?? ''}
                      onChange={(e) => update((d) => ({ groomingReference: d.groomingReference ? { ...d.groomingReference, description: e.target.value } : null }))}
                    />
                  )}
                </Field>
              </div>
              <button type="button" className="rounded-full p-2 hover:bg-ink-900/5" aria-label="Remover foto de referência" onClick={() => { update({ groomingReference: null }); setPreview(null); }}>
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-pill border-2 border-dashed border-brand-300 px-4 py-2 text-sm font-bold text-brand-800 hover:bg-brand-50 disabled:opacity-60"
            >
              <Camera className="h-4 w-4" aria-hidden /> {uploading ? 'Enviando…' : 'Enviar foto de referência'}
            </button>
          )}
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => send(e.target.files?.[0])} data-testid="grooming-reference-input" />
        </div>
      )}
    </section>
  );
}
