import { useState } from 'react';
import type { PortalPet } from '@karolla/shared';
import { useCatalog } from '@/context/CatalogContext';
import { ApiError, friendlyMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

type Draft = {
  name: string;
  speciesId: string;
  breedId: string;
  breedName: string;
  sizeId: string;
  weightKg: string;
  birthDate: string;
  characteristics: string;
  groomingPreferences: string;
  notes: string;
};

const OTHER = '__outra__';

/** Cadastro/edição de pet usado na área do cliente. */
export function PetFormModal({
  pet,
  onClose,
  onSave,
}: {
  pet: PortalPet | null;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const { catalog } = useCatalog();
  const toast = useToast();
  const species = catalog?.species.filter((s) => s.active) ?? [];
  const [d, setD] = useState<Draft>(() => ({
    name: pet?.name ?? '',
    speciesId: pet?.speciesId ?? species[0]?.id ?? '',
    breedId: pet ? (pet.breedId ?? OTHER) : '',
    breedName: pet?.breedName ?? '',
    sizeId: pet?.sizeId ?? '',
    weightKg: pet?.weightKg != null ? String(pet.weightKg) : '',
    birthDate: pet?.birthDate ?? '',
    characteristics: pet?.characteristics ?? '',
    groomingPreferences: pet?.groomingPreferences ?? '',
    notes: pet?.notes ?? '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const breeds = catalog?.breeds.filter((b) => b.active && b.speciesId === d.speciesId) ?? [];
  const sizes = catalog?.sizes.filter((s) => s.active) ?? [];
  const set = (patch: Partial<Draft>) => setD((cur) => ({ ...cur, ...patch }));

  const save = async () => {
    setErrors({});
    const isOther = d.breedId === OTHER || !d.breedId;
    const breed = breeds.find((b) => b.id === d.breedId);
    const body = {
      name: d.name,
      speciesId: d.speciesId,
      breedId: isOther ? null : d.breedId,
      breedName: isOther ? d.breedName : (breed?.name ?? d.breedName),
      sizeId: d.sizeId,
      weightKg: d.weightKg ? Number(d.weightKg.replace(',', '.')) : null,
      birthDate: d.birthDate || null,
      characteristics: d.characteristics,
      groomingPreferences: d.groomingPreferences,
      notes: d.notes,
    };
    setSaving(true);
    try {
      await onSave(body);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      toast(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={pet ? `Editar ${pet.name}` : 'Novo pet'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={saving}>Salvar</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do pet" required error={errors.name} className="sm:col-span-2">
          {(p) => <Input {...p} value={d.name} onChange={(e) => set({ name: e.target.value })} />}
        </Field>
        <Field label="Espécie" required error={errors.speciesId}>
          {(p) => (
            <Select {...p} value={d.speciesId} onChange={(e) => set({ speciesId: e.target.value, breedId: '', breedName: '' })}>
              {species.map((s) => (
                <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Porte" required error={errors.sizeId}>
          {(p) => (
            <Select {...p} value={d.sizeId} onChange={(e) => set({ sizeId: e.target.value })}>
              <option value="">Escolha</option>
              {sizes.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.description ? ` — ${s.description}` : ''}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Raça" required error={errors.breedId}>
          {(p) => (
            <Select {...p} value={d.breedId} onChange={(e) => set({ breedId: e.target.value })}>
              <option value="">Escolha</option>
              {breeds.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
              <option value={OTHER}>Outra / sem raça definida</option>
            </Select>
          )}
        </Field>
        {(d.breedId === OTHER || (!d.breedId && pet)) && (
          <Field label="Qual raça?" required error={errors.breedName}>
            {(p) => <Input {...p} value={d.breedName} onChange={(e) => set({ breedName: e.target.value })} placeholder="Ex.: SRD" />}
          </Field>
        )}
        <Field label="Data de nascimento" hint="Se não souber, deixe em branco." error={errors.birthDate}>
          {(p) => <Input {...p} type="date" value={d.birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set({ birthDate: e.target.value })} />}
        </Field>
        <Field label="Peso (kg)" error={errors.weightKg}>
          {(p) => <Input {...p} inputMode="decimal" value={d.weightKg} onChange={(e) => set({ weightKg: e.target.value })} placeholder="Ex.: 7,5" />}
        </Field>
        <Field label="Características e temperamento" hint="Ex.: medroso com secador, idoso, alergias." error={errors.characteristics} className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={2} value={d.characteristics} onChange={(e) => set({ characteristics: e.target.value })} />}
        </Field>
        <Field label="Preferências de tosa" hint="Ex.: tosa bebê, deixar o rabo comprido." error={errors.groomingPreferences} className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={2} value={d.groomingPreferences} onChange={(e) => set({ groomingPreferences: e.target.value })} />}
        </Field>
        <Field label="Observações" error={errors.notes} className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={2} value={d.notes} onChange={(e) => set({ notes: e.target.value })} />}
        </Field>
      </div>
    </Modal>
  );
}
