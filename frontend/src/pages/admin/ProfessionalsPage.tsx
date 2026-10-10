import { useState } from 'react';
import { Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import type { Professional } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { ApiError, friendlyMessage } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useCatalog } from '@/context/CatalogContext';
import { Alert, Badge, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/admin/AdminUi';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { moveItem, ReorderButtons } from '@/components/admin/ReorderButtons';

const COLORS = ['#279790', '#f65d34', '#7c3aed', '#f5ae00', '#2563eb', '#db2777', '#16a34a', '#6b7280'];
type Draft = { id?: string; name: string; color: string; serviceIds: string[]; active: boolean };

/** Equipe: cada profissional atende 1 pet por vez; a agenda passa a ser por profissional. */
export default function ProfessionalsPage() {
  useDocumentMeta({ title: 'Profissionais — Karolla Pet', noindex: true });
  const toast = useToast();
  const { reload: reloadPublic } = useCatalog();
  const { data, loading, error, reload, setData } = useAsync(() => adminApi.catalog(), []);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Professional | null>(null);

  const refresh = async () => {
    await reload();
    void reloadPublic();
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setErrors({});
    const body = { name: editing.name, color: editing.color, serviceIds: editing.serviceIds, active: editing.active };
    try {
      if (editing.id) await adminApi.updateProfessional(editing.id, body);
      else await adminApi.createProfessional(body);
      toast(editing.id ? 'Profissional atualizado.' : 'Profissional cadastrado.');
      setEditing(null);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      toast(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: Professional) => {
    try {
      await adminApi.updateProfessional(p.id, { active: !p.active });
      await refresh();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    }
  };

  const move = async (from: number, to: number) => {
    if (!data) return;
    const professionals = moveItem(data.professionals, from, to);
    setData({ ...data, professionals });
    await adminApi.reorder('professionals', professionals.map((p) => p.id)).catch((err) => toast(friendlyMessage(err), 'error'));
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await adminApi.deleteProfessional(toDelete.id);
      toast('Profissional excluído.');
      await refresh();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setToDelete(null);
    }
  };

  const active = data?.professionals.filter((p) => p.active).length ?? 0;

  return (
    <div>
      <PageHeader
        title="Profissionais"
        description="Cada profissional atende um pet por vez. O site só oferece horários em que há alguém livre que faz o serviço."
        actions={<Button onClick={() => setEditing({ name: '', color: COLORS[(data?.professionals.length ?? 0) % COLORS.length]!, serviceIds: [], active: true })} icon={<Plus className="h-4 w-4" />}>Novo profissional</Button>}
      />
      {data && (
        <Alert tone="info" className="mb-5">
          {active > 0
            ? `Agenda por profissional ativa: até ${active} pet(s) ao mesmo tempo, um por profissional. As "vagas por horário" da tela Horários deixam de ser usadas.`
            : 'Nenhum profissional ativo: a agenda usa as "vagas por horário" definidas na tela Horários.'}
        </Alert>
      )}
      {loading && !data && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && data.professionals.length === 0 && <EmptyState icon={<UserRound className="h-10 w-10" />} title="Nenhum profissional cadastrado" />}
      {data && (
        <ul className="space-y-3">
          {data.professionals.map((p, i) => (
            <li key={p.id} className="card flex items-center gap-3 p-4" data-testid={`admin-professional-${p.name}`}>
              <ReorderButtons index={i} total={data.professionals.length} onMove={move} label={p.name} />
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-lg font-semibold text-white" style={{ background: p.color }} aria-hidden>
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold">
                  {p.name} {!p.active && <Badge className="bg-ink-900/10 text-ink-600">Inativo</Badge>}
                </p>
                <p className="truncate text-sm text-ink-500">
                  {p.serviceIds.length ? p.serviceIds.map((id) => data.services.find((s) => s.id === id)?.name).filter(Boolean).join(', ') : 'Todos os serviços'}
                </p>
              </div>
              <Toggle checked={p.active} onChange={() => toggle(p)} label={p.active ? 'Ativo' : 'Inativo'} />
              <Button size="sm" variant="ghost" aria-label={`Editar ${p.name}`} onClick={() => setEditing({ ...p })} icon={<Pencil className="h-4 w-4" />} />
              <Button size="sm" variant="ghost" aria-label={`Excluir ${p.name}`} onClick={() => setToDelete(p)} icon={<Trash2 className="h-4 w-4 text-red-500" />} />
            </li>
          ))}
        </ul>
      )}
      {editing && data && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Editar profissional' : 'Novo profissional'} footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button variant="secondary" onClick={save} loading={saving}>Salvar</Button></>}>
          <div className="space-y-4">
            <Field label="Nome" required error={errors.name}>{(p) => <Input {...p} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex.: Carol" />}</Field>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink-700">Cor na agenda</legend>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setEditing({ ...editing, color: c })} aria-label={`Cor ${c}`} aria-pressed={editing.color === c} className="h-9 w-9 rounded-full ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-ink-800" style={{ background: c }} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink-700">Serviços que realiza <span className="font-normal text-ink-400">(nenhum marcado = todos)</span></legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.services.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-ink-900/10 px-3 py-2.5 text-sm">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-brand-600"
                      checked={editing.serviceIds.includes(s.id)}
                      onChange={(e) => setEditing({ ...editing, serviceIds: e.target.checked ? [...editing.serviceIds, s.id] : editing.serviceIds.filter((x) => x !== s.id) })}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <Toggle checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="Ativo (recebe agendamentos)" />
          </div>
        </Modal>
      )}
      <ConfirmDialog open={Boolean(toDelete)} title="Excluir profissional?" message={`"${toDelete?.name}" será removido. Se já tiver agendamentos, desative em vez de excluir.`} confirmLabel="Excluir" danger onConfirm={remove} onClose={() => setToDelete(null)} />
    </div>
  );
}
