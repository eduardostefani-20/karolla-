import { useState } from 'react';
import { ExternalLink, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { Inspiration } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { ApiError, friendlyMessage } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Alert, Badge, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/admin/AdminUi';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { MediaPicker } from '@/components/admin/MediaPicker';

const OTHER = '__other__';
type Draft = {
  id?: string;
  title: string;
  description: string;
  speciesId: string;
  breedId: string;
  breedName: string;
  serviceId: string;
  imageUrl: string;
  storagePath: string;
  active: boolean;
};

/** Catálogo de inspirações de tosa: fotos por raça que o cliente pode escolher ao agendar. */
export default function InspirationsAdminPage() {
  useDocumentMeta({ title: 'Inspirações — Karolla Pet', noindex: true });
  const toast = useToast();
  const { data: catalog } = useAsync(() => adminApi.catalog(), []);
  const { data, loading, error, reload } = useAsync(() => adminApi.inspirations(), []);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Inspiration | null>(null);
  const [filter, setFilter] = useState('');

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setErrors({});
    const isOther = editing.breedId === OTHER || !editing.breedId;
    const body = {
      title: editing.title,
      description: editing.description,
      speciesId: editing.speciesId,
      breedId: isOther ? null : editing.breedId,
      breedName: isOther ? editing.breedName : '',
      serviceId: editing.serviceId || null,
      imageUrl: editing.imageUrl,
      storagePath: editing.storagePath,
      active: editing.active,
    };
    try {
      if (!editing.imageUrl) throw new ApiError('Escolha a foto.', 400, 'VALIDATION', { imageUrl: 'Escolha a foto.' });
      if (editing.id) await adminApi.updateInspiration(editing.id, body);
      else await adminApi.createInspiration(body);
      toast(editing.id ? 'Inspiração atualizada.' : 'Inspiração publicada no site.');
      setEditing(null);
      await reload();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      toast(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (i: Inspiration) => {
    try {
      await adminApi.updateInspiration(i.id, { active: !i.active });
      await reload();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await adminApi.deleteInspiration(toDelete.id);
      toast('Inspiração excluída.');
      await reload();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setToDelete(null);
    }
  };

  const items = (data ?? []).filter((i) => !filter || i.breedName.toLowerCase().includes(filter.toLowerCase()) || i.title.toLowerCase().includes(filter.toLowerCase()));
  const breeds = catalog?.breeds.filter((b) => b.speciesId === editing?.speciesId) ?? [];

  return (
    <div>
      <PageHeader
        title="Inspirações de tosa"
        description="Fotos por raça exibidas em /inspiracoes. O cliente toca em “Agendar” e a foto vai junto para o agendamento."
        actions={
          <>
            <a href="/inspiracoes" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-ink-600 hover:bg-ink-900/5">
              <ExternalLink className="h-4 w-4" aria-hidden /> Ver no site
            </a>
            <Button
              onClick={() => setEditing({ title: '', description: '', speciesId: catalog?.species[0]?.id ?? 'dog', breedId: '', breedName: '', serviceId: '', imageUrl: '', storagePath: '', active: true })}
              icon={<Plus className="h-4 w-4" />}
              disabled={!catalog}
            >
              Nova inspiração
            </Button>
          </>
        }
      />
      <Input className="mb-5 max-w-md py-2.5" placeholder="Filtrar por raça ou título" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar inspirações" />
      {loading && !data && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && items.length === 0 && <EmptyState icon={<Sparkles className="h-10 w-10" />} title="Nenhuma inspiração ainda">Toque em “Nova inspiração” e envie a foto de um trabalho da Karolla Pet.</EmptyState>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((i) => (
          <li key={i.id} className="card overflow-hidden" data-testid="admin-inspiration">
            <div className="relative aspect-square bg-brand-50">
              <img src={i.imageUrl} alt={i.title} loading="lazy" className={`h-full w-full object-cover ${i.active ? '' : 'opacity-40 grayscale'}`} />
              {!i.active && <Badge className="absolute left-2 top-2 bg-ink-900/80 text-white">Oculta</Badge>}
            </div>
            <div className="space-y-2 p-3">
              <p className="truncate text-xs font-bold uppercase text-brand-600">{i.breedName}</p>
              <p className="truncate font-semibold">{i.title}</p>
              <div className="flex items-center justify-between">
                <Toggle checked={i.active} onChange={() => toggle(i)} label={i.active ? 'No site' : 'Oculta'} className="gap-2 whitespace-nowrap" />
                <span className="flex">
                  <Button size="sm" variant="ghost" aria-label={`Editar ${i.title}`} onClick={() => setEditing({ ...i, breedId: i.breedId ?? OTHER, serviceId: i.serviceId ?? '' })} icon={<Pencil className="h-4 w-4" />} />
                  <Button size="sm" variant="ghost" aria-label={`Excluir ${i.title}`} onClick={() => setToDelete(i)} icon={<Trash2 className="h-4 w-4 text-red-500" />} />
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {editing && catalog && (
        <Modal open size="lg" onClose={() => setEditing(null)} title={editing.id ? 'Editar inspiração' : 'Nova inspiração'} footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button variant="secondary" onClick={save} loading={saving}>Salvar</Button></>}>
          <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
            <div>
              <MediaPicker
                kind="inspiration"
                label="Foto"
                value={editing.imageUrl ? { url: editing.imageUrl, mediaType: 'image' } : null}
                onUploaded={(m) => setEditing((d) => (d ? { ...d, imageUrl: m.url, storagePath: m.path } : d))}
              />
              {errors.imageUrl && <p className="mt-1 text-sm text-red-600">{errors.imageUrl}</p>}
            </div>
            <div className="space-y-4">
              <Field label="Título" required error={errors.title}>{(p) => <Input {...p} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Ex.: Tosa bebê" />}</Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Espécie" required>
                  {(p) => (
                    <Select {...p} value={editing.speciesId} onChange={(e) => setEditing({ ...editing, speciesId: e.target.value, breedId: '' })}>
                      {catalog.species.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label="Raça" required error={errors.breedName}>
                  {(p) => (
                    <Select {...p} value={editing.breedId} onChange={(e) => setEditing({ ...editing, breedId: e.target.value })}>
                      <option value="">Escolha...</option>
                      {breeds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      <option value={OTHER}>Outra raça (digitar)</option>
                    </Select>
                  )}
                </Field>
              </div>
              {editing.breedId === OTHER && (
                <Field label="Nome da raça" required error={errors.breedName}>{(p) => <Input {...p} value={editing.breedName} onChange={(e) => setEditing({ ...editing, breedName: e.target.value })} />}</Field>
              )}
              <Field label="Serviço sugerido" hint="Só informativo: o cliente escolhe o serviço normalmente no agendamento.">
                {(p) => (
                  <Select {...p} value={editing.serviceId} onChange={(e) => setEditing({ ...editing, serviceId: e.target.value })}>
                    <option value="">Nenhum</option>
                    {catalog.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Descrição" error={errors.description}>{(p) => <Textarea {...p} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Ex.: pelagem curtinha, orelhas arredondadas" />}</Field>
              <Toggle checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="Mostrar no site" />
            </div>
          </div>
        </Modal>
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir inspiração?"
        message={`"${toDelete?.title}" e a foto serão removidas. Fotos já escolhidas em agendamentos não podem ser excluídas — oculte-as.`}
        confirmLabel="Excluir"
        danger
        onConfirm={remove}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
