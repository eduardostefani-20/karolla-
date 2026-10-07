import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import type { FormFieldConfig, FormFieldKey } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { friendlyMessage } from '@/services/api';
import { useCatalog } from '@/context/CatalogContext';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';

const GROUPS: { title: string; keys: FormFieldKey[] }[] = [
  { title: 'Dados do pet', keys: ['pet.weight', 'pet.age', 'pet.notes'] },
  { title: 'Dados do tutor', keys: ['tutor.email', 'tutor.address', 'tutor.notes'] },
];

/** Campos opcionais do formulário: mostrar/ocultar, obrigatório, rótulo e texto de ajuda. */
export function FieldsEditor({ fields, onSaved }: { fields: FormFieldConfig[]; onSaved: () => void }) {
  const toast = useToast();
  const { reload: reloadPublic } = useCatalog();
  const [draft, setDraft] = useState(fields);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(fields), [fields]);

  const set = (key: FormFieldKey, patch: Partial<FormFieldConfig>) =>
    setDraft((d) => d.map((f) => (f.key === key ? { ...f, ...patch, ...(patch.enabled === false ? { required: false } : {}) } : f)));

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.saveFormFields(draft);
      toast('Formulário atualizado! As mudanças já valem no site.');
      onSaved();
      void reloadPublic();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
        Nome do pet, espécie, raça, porte, serviço, data, horário, nome e WhatsApp do tutor são sempre obrigatórios. Os campos abaixo podem ser ajustados livremente.
      </p>
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h3 className="mb-3 font-display text-lg font-semibold">{g.title}</h3>
          <div className="space-y-3">
            {g.keys.map((key) => {
              const f = draft.find((x) => x.key === key);
              if (!f) return null;
              return (
                <div key={key} className="card space-y-4 p-4" data-testid={`field-${key}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold">{f.label}</p>
                    <div className="flex gap-6">
                      <Toggle checked={f.enabled} onChange={(v) => set(key, { enabled: v })} label="Mostrar" />
                      <Toggle checked={f.required} disabled={!f.enabled} onChange={(v) => set(key, { required: v })} label="Obrigatório" />
                    </div>
                  </div>
                  {f.enabled && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Rótulo exibido" required>{(p) => <Input {...p} className="py-2.5" value={f.label} onChange={(e) => set(key, { label: e.target.value })} />}</Field>
                      <Field label="Texto de ajuda">{(p) => <Input {...p} className="py-2.5" value={f.helpText} onChange={(e) => set(key, { helpText: e.target.value })} />}</Field>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <div className="flex justify-end">
        <Button variant="secondary" size="lg" onClick={save} loading={saving} icon={<Save className="h-5 w-5" />}>
          Salvar formulário
        </Button>
      </div>
    </div>
  );
}
