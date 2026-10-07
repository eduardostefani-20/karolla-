import { useState, type ReactNode } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { friendlyMessage } from '@/services/api';
import { Badge } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { moveItem, ReorderButtons } from '@/components/admin/ReorderButtons';

export interface ListItem {
  id: string;
  name: string;
  active: boolean;
}

/**
 * Editor genérico de opções (adicionar, renomear, ativar/desativar, ordenar, excluir).
 * Usado para espécies, portes e raças.
 */
export function SimpleListEditor<T extends ListItem>({
  items,
  addLabel,
  emptyDraft,
  renderForm,
  renderSummary,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
  onChanged,
}: {
  items: T[];
  addLabel: string;
  emptyDraft: () => Partial<T>;
  renderForm: (draft: Partial<T>, set: (patch: Partial<T>) => void) => ReactNode;
  renderSummary?: (item: T) => ReactNode;
  onCreate: (draft: Partial<T>) => Promise<unknown>;
  onUpdate: (id: string, patch: Partial<T>) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onReorder?: (ids: string[]) => Promise<unknown>;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<T>>({});
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<T | null>(null);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast(success);
      setEditingId(null);
      onChanged();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <div className="space-y-3 rounded-2xl border-2 border-brand-200 bg-brand-50/40 p-4">
      {renderForm(draft, (patch) => setDraft((d) => ({ ...d, ...patch })))}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} icon={<X className="h-4 w-4" />}>
          Cancelar
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={busy}
          icon={<Check className="h-4 w-4" />}
          onClick={() => (editingId === 'new' ? run(() => onCreate(draft), 'Opção adicionada.') : run(() => onUpdate(editingId as string, draft), 'Opção atualizada.'))}
        >
          Salvar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      {items.map((item, i) =>
        editingId === item.id ? (
          <div key={item.id}>{form}</div>
        ) : (
          <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-ink-900/5 bg-white px-3 py-2.5">
            {onReorder && (
              <ReorderButtons
                index={i}
                total={items.length}
                label={item.name}
                onMove={(from, to) => run(() => onReorder(moveItem(items, from, to).map((x) => x.id)), 'Ordem atualizada.')}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {item.name} {!item.active && <Badge className="bg-ink-900/10 text-ink-600">Inativo</Badge>}
              </p>
              {renderSummary?.(item)}
            </div>
            <Toggle checked={item.active} label={item.active ? 'Ativo' : 'Inativo'} onChange={(v) => run(() => onUpdate(item.id, { active: v } as Partial<T>), v ? 'Opção ativada.' : 'Opção desativada.')} />
            <Button size="sm" variant="ghost" aria-label={`Editar ${item.name}`} onClick={() => { setDraft(item); setEditingId(item.id); }} icon={<Pencil className="h-4 w-4" />} />
            <Button size="sm" variant="ghost" aria-label={`Excluir ${item.name}`} onClick={() => setToDelete(item)} icon={<Trash2 className="h-4 w-4 text-red-500" />} />
          </div>
        ),
      )}
      {editingId === 'new' ? (
        form
      ) : (
        <Button variant="outline" onClick={() => { setDraft(emptyDraft()); setEditingId('new'); }} icon={<Plus className="h-4 w-4" />}>
          {addLabel}
        </Button>
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir opção?"
        message={`"${toDelete?.name}" será removida. Se já estiver em uso, o sistema pedirá para desativar em vez de excluir.`}
        confirmLabel="Excluir"
        danger
        loading={busy}
        onConfirm={() => toDelete && void run(() => onDelete(toDelete.id), 'Opção excluída.').then(() => setToDelete(null))}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
