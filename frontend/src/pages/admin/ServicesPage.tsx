import { useState } from 'react';
import { Clock, Pencil, Plus, Scissors, Trash2 } from 'lucide-react';
import type { Service } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { ApiError, friendlyMessage } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Alert, Badge, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/admin/AdminUi';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { moveItem, ReorderButtons } from '@/components/admin/ReorderButtons';
import { useCatalog } from '@/context/CatalogContext';

type Draft = { id?: string; name: string; description: string; category: string; durationMinutes: string; active: boolean; speciesIds: string[] };
const empty: Draft = { name: '', description: '', category: 'Banho', durationMinutes: '60', active: true, speciesIds: [] };

export default function ServicesPage() {
  useDocumentMeta({ title: 'Serviços — Karolla Pet', noindex: true });
  const toast = useToast();
  const { reload: reloadPublic } = useCatalog();
  const { data, loading, error, reload, setData } = useAsync(() => adminApi.catalog(), []);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = async () => {
    await reload();
    void reloadPublic(); // o site público reflete na hora
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setErrors({});
    setFormError(null);
    const body = {
      name: editing.name,
      description: editing.description,
      category: editing.category,
      durationMinutes: Number(editing.durationMinutes),
      active: editing.active,
      speciesIds: editing.speciesIds,
    };
    try {
      if (editing.id) await adminApi.updateService(editing.id, body);
      else await adminApi.createService(body);
      toast(editing.id ? 'Serviço atualizado.' : 'Serviço criado. Lembre-se de cadastrar os preços por porte.');
      setEditing(null);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setFormError(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: Service) => {
    try {
      await adminApi.updateService(s.id, { active: !s.active });
      toast(s.active ? 'Serviço desativado — não aparece mais no site.' : 'Serviço ativado.');
      await refresh();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    }
  };

  const move = async (from: number, to: number) => {
    if (!data) return;
    const services = moveItem(data.services, from, to);
    setData({ ...data, services });
    try {
      await adminApi.reorder('services', services.map((s) => s.id));
      void reloadPublic();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
      void reload();
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await adminApi.deleteService(toDelete.id);
      toast('Serviço excluído.');
      setToDelete(null);
      await refresh();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Serviços"
        description="Crie, edite, ative/desative e ordene os serviços exibidos no site."
        actions={<Button onClick={() => setEditing({ ...empty })} icon={<Plus className="h-4 w-4" />}>Novo serviço</Button>}
      />
      {loading && !data && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && data.services.length === 0 && <EmptyState icon={<Scissors className="h-10 w-10" />} title="Nenhum serviço cadastrado" />}
      {data && (
        <ul className="space-y-3">
          {data.services.map((s, i) => (
            <li key={s.id} className="card flex items-center gap-3 p-4" data-testid={`admin-service-${s.id}`}>
              <ReorderButtons index={i} total={data.services.length} onMove={move} label={s.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-lg font-semibold">{s.name}</p>
                  <Badge className="bg-brand-50 text-brand-700">{s.category}</Badge>
                  {!s.active && <Badge className="bg-ink-900/10 text-ink-600">Inativo</Badge>}
                </div>
                <p className="line-clamp-1 text-sm text-ink-500">{s.description}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-ink-400">
                  <Clock className="h-3 w-3" aria-hidden /> {s.durationMinutes} min •{' '}
                  {s.speciesIds.length ? s.speciesIds.map((id) => data.species.find((x) => x.id === id)?.name).join(', ') : 'Todas as espécies'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                <Toggle checked={s.active} onChange={() => toggleActive(s)} label={s.active ? 'Ativo' : 'Inativo'} className="sm:mr-2" />
                <div className="flex">
                  <Button size="sm" variant="ghost" aria-label={`Editar ${s.name}`} onClick={() => setEditing({ ...s, durationMinutes: String(s.durationMinutes) })} icon={<Pencil className="h-4 w-4" />} />
                  <Button size="sm" variant="ghost" aria-label={`Excluir ${s.name}`} onClick={() => setToDelete(s)} icon={<Trash2 className="h-4 w-4 text-red-500" />} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && data && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing.id ? 'Editar serviço' : 'Novo serviço'}
          footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button variant="secondary" onClick={save} loading={saving}>Salvar</Button></>}
        >
          <div className="space-y-4">
            {formError && <Alert tone="error">{formError}</Alert>}
            <Field label="Nome" required error={errors.name}>{(p) => <Input {...p} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />}</Field>
            <Field label="Descrição" error={errors.description}>{(p) => <Textarea {...p} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoria" required error={errors.category}>{(p) => <Input {...p} list="categorias" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />}</Field>
              <Field label="Duração (minutos)" required error={errors.durationMinutes}>{(p) => <Input {...p} type="number" min={5} step={5} value={editing.durationMinutes} onChange={(e) => setEditing({ ...editing, durationMinutes: e.target.value })} />}</Field>
            </div>
            <datalist id="categorias">{[...new Set(data.services.map((s) => s.category))].map((c) => <option key={c} value={c} />)}</datalist>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink-700">Atende quais espécies? <span className="font-normal text-ink-400">(nenhuma marcada = todas)</span></legend>
              <div className="flex flex-wrap gap-2">
                {data.species.map((sp) => (
                  <label key={sp.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-ink-900/10 px-4 py-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={editing.speciesIds.includes(sp.id)} onChange={(e) => setEditing({ ...editing, speciesIds: e.target.checked ? [...editing.speciesIds, sp.id] : editing.speciesIds.filter((x) => x !== sp.id) })} />
                    {sp.emoji} {sp.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <Toggle checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="Ativo (aparece no site)" />
          </div>
        </Modal>
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir serviço?"
        message={`"${toDelete?.name}" será removido. Serviços que já têm agendamentos não podem ser excluídos — nesse caso, desative.`}
        confirmLabel="Excluir"
        danger
        loading={deleting}
        onConfirm={remove}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
