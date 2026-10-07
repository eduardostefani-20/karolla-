import { useState } from 'react';
import { Pencil, Plus, PlusCircle, Trash2 } from 'lucide-react';
import { formatCents, type Addon } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { ApiError, friendlyMessage } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useCatalog } from '@/context/CatalogContext';
import { Alert, Badge, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/admin/AdminUi';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { MoneyInput } from '@/components/admin/MoneyInput';
import { moveItem, ReorderButtons } from '@/components/admin/ReorderButtons';

type Draft = { id?: string; name: string; description: string; priceCents: number | null; durationMinutes: string; active: boolean };

/** Lista de adicionais — usada também dentro do Editor do Formulário. */
export function AddonsManager() {
  const toast = useToast();
  const { reload: reloadPublic } = useCatalog();
  const { data, loading, error, reload, setData } = useAsync(() => adminApi.catalog(), []);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Addon | null>(null);

  const refresh = async () => {
    await reload();
    void reloadPublic();
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setErrors({});
    setFormError(null);
    const body = { name: editing.name, description: editing.description, priceCents: editing.priceCents ?? Number.NaN, durationMinutes: Number(editing.durationMinutes || 0), active: editing.active };
    try {
      if (editing.id) await adminApi.updateAddon(editing.id, body);
      else await adminApi.createAddon(body);
      toast(editing.id ? 'Adicional atualizado.' : 'Adicional criado.');
      setEditing(null);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setFormError(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (a: Addon) => {
    try {
      await adminApi.updateAddon(a.id, { active: !a.active });
      await refresh();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    }
  };

  const move = async (from: number, to: number) => {
    if (!data) return;
    const addons = moveItem(data.addons, from, to);
    setData({ ...data, addons });
    await adminApi.reorder('addons', addons.map((a) => a.id)).catch((err) => toast(friendlyMessage(err), 'error'));
    void reloadPublic();
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await adminApi.deleteAddon(toDelete.id);
      toast('Adicional excluído.');
      await refresh();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setToDelete(null);
    }
  };

  if (loading && !data) return <Spinner />;
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing({ name: '', description: '', priceCents: null, durationMinutes: '0', active: true })} icon={<Plus className="h-4 w-4" />}>
          ADICIONAR
        </Button>
      </div>
      {data.addons.length === 0 && <EmptyState icon={<PlusCircle className="h-10 w-10" />} title="Nenhum adicional cadastrado" />}
      <ul className="space-y-3">
        {data.addons.map((a, i) => (
          <li key={a.id} className="card flex items-center gap-3 p-4" data-testid={`admin-addon-${a.id}`}>
            <ReorderButtons index={i} total={data.addons.length} onMove={move} label={a.name} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {a.name} {!a.active && <Badge className="bg-ink-900/10 text-ink-600">Inativo</Badge>}
              </p>
              <p className="font-display text-lg text-brand-700">{formatCents(a.priceCents)}</p>
              <p className="line-clamp-1 text-xs text-ink-500">{a.description}{a.durationMinutes ? ` • +${a.durationMinutes} min` : ''}</p>
            </div>
            <Toggle checked={a.active} onChange={() => toggle(a)} label={a.active ? 'ATIVO' : 'INATIVO'} />
            <Button size="sm" variant="ghost" aria-label={`Editar ${a.name}`} onClick={() => setEditing({ ...a, durationMinutes: String(a.durationMinutes) })} icon={<Pencil className="h-4 w-4" />} />
            <Button size="sm" variant="ghost" aria-label={`Excluir ${a.name}`} onClick={() => setToDelete(a)} icon={<Trash2 className="h-4 w-4 text-red-500" />} />
          </li>
        ))}
      </ul>
      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Editar adicional' : 'Novo adicional'} footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button variant="secondary" onClick={save} loading={saving}>Salvar</Button></>}>
          <div className="space-y-4">
            {formError && <Alert tone="error">{formError}</Alert>}
            <Field label="Nome" required error={errors.name}>{(p) => <Input {...p} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />}</Field>
            <Field label="Descrição" error={errors.description}>{(p) => <Textarea {...p} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preço" required error={errors.priceCents}>{(p) => <MoneyInput {...p} value={editing.priceCents} onChange={(v) => setEditing({ ...editing, priceCents: v })} />}</Field>
              <Field label="Tempo extra (min)" error={errors.durationMinutes}>{(p) => <Input {...p} type="number" min={0} step={5} value={editing.durationMinutes} onChange={(e) => setEditing({ ...editing, durationMinutes: e.target.value })} />}</Field>
            </div>
            <Toggle checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="Ativo (aparece no site)" />
          </div>
        </Modal>
      )}
      <ConfirmDialog open={Boolean(toDelete)} title="Excluir adicional?" message={`"${toDelete?.name}" será removido. Se já foi usado em agendamentos, desative em vez de excluir.`} confirmLabel="Excluir" danger onConfirm={remove} onClose={() => setToDelete(null)} />
    </div>
  );
}

export default function AddonsPage() {
  useDocumentMeta({ title: 'Adicionais — Karolla Pet', noindex: true });
  return (
    <div>
      <PageHeader title="Adicionais" description="Cuidados extras oferecidos na etapa “Quer adicionar algum cuidado?”." />
      <AddonsManager />
    </div>
  );
}
