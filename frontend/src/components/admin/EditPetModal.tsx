import { useState } from 'react';
import type { AdminCatalog, Pet } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { ApiError, friendlyMessage } from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';

const OTHER = '__other__';

export function EditPetModal({ pet, catalog, open, onClose, onSaved }: { pet: Pet; catalog: AdminCatalog; open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: pet.name,
    speciesId: pet.speciesId,
    breedId: pet.breedId ?? OTHER,
    breedName: pet.breedName,
    sizeId: pet.sizeId,
    weight: pet.weightKg != null ? String(pet.weightKg) : '',
    ageMonths: pet.ageMonths != null ? String(pet.ageMonths) : '',
    notes: pet.notes,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const breeds = catalog.breeds.filter((b) => b.speciesId === form.speciesId);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const weight = form.weight ? Number(form.weight.replace(',', '.')) : null;
      const age = form.ageMonths ? Number(form.ageMonths) : null;
      await adminApi.updatePet(pet.id, {
        name: form.name,
        speciesId: form.speciesId,
        breedId: form.breedId === OTHER ? null : form.breedId,
        breedName: form.breedId === OTHER ? form.breedName : (breeds.find((b) => b.id === form.breedId)?.name ?? form.breedName),
        sizeId: form.sizeId,
        weightKg: weight,
        ageMonths: age,
        notes: form.notes,
      });
      toast('Dados do pet atualizados.');
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar pet" size="lg" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="secondary" onClick={save} loading={saving}>Salvar</Button></>}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" required error={errors.name}>{(p) => <Input {...p} value={form.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
          <Field label="Espécie" required>
            {(p) => (
              <Select {...p} value={form.speciesId} onChange={(e) => set({ speciesId: e.target.value, breedId: OTHER })}>
                {catalog.species.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
              </Select>
            )}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Raça" required>
            {(p) => (
              <Select {...p} value={form.breedId} onChange={(e) => set({ breedId: e.target.value })}>
                {breeds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                <option value={OTHER}>Outra raça (digitar)</option>
              </Select>
            )}
          </Field>
          {form.breedId === OTHER && (
            <Field label="Nome da raça" required error={errors.breedName}>{(p) => <Input {...p} value={form.breedName} onChange={(e) => set({ breedName: e.target.value })} />}</Field>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Porte" required>
            {(p) => (
              <Select {...p} value={form.sizeId} onChange={(e) => set({ sizeId: e.target.value })}>
                {catalog.sizes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Peso (kg)" error={errors.weightKg}>{(p) => <Input {...p} inputMode="decimal" value={form.weight} onChange={(e) => set({ weight: e.target.value })} />}</Field>
          <Field label="Idade (meses)" error={errors.ageMonths}>{(p) => <Input {...p} inputMode="numeric" value={form.ageMonths} onChange={(e) => set({ ageMonths: e.target.value })} />}</Field>
        </div>
        <Field label="Observações">{(p) => <Textarea {...p} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />}</Field>
      </div>
    </Modal>
  );
}
