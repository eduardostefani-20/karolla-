import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { Breed, PetSize, Species } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useCatalog } from '@/context/CatalogContext';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Field';
import { PageHeader, Panel } from '@/components/admin/AdminUi';
import { FieldsEditor } from '@/components/admin/form-editor/FieldsEditor';
import { SimpleListEditor } from '@/components/admin/form-editor/SimpleListEditor';
import { AddonsManager } from './AddonsPage';
import { cn } from '@/utils/cn';

const TABS = [
  ['campos', 'Campos'],
  ['adicionais', 'Adicionais'],
  ['portes', 'Portes'],
  ['racas', 'Raças'],
  ['especies', 'Espécies'],
  ['servicos', 'Serviços e preços'],
] as const;
type Tab = (typeof TABS)[number][0];

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

/**
 * EDITOR DO FORMULÁRIO — permite à Carol mudar o formulário de agendamento sem programação:
 * campos, adicionais, portes, raças, espécies (e atalhos para serviços e preços).
 */
export default function FormEditorPage() {
  useDocumentMeta({ title: 'Editor do formulário — Karolla Pet', noindex: true });
  const [tab, setTab] = useState<Tab>('campos');
  const { reload: reloadPublic } = useCatalog();
  const { data, loading, error, reload } = useAsync(() => adminApi.catalog(), []);
  const [breedSpecies, setBreedSpecies] = useState('dog');
  const changed = () => {
    void reload();
    void reloadPublic();
  };

  return (
    <div>
      <PageHeader title="Editor do formulário" description="Tudo o que aparece no agendamento online pode ser ajustado aqui — as mudanças valem na hora." />
      <div role="tablist" aria-label="Seções do formulário" className="scroll-thin -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn('shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors', tab === id ? 'bg-brand-600 text-white shadow-soft' : 'bg-white text-ink-600 shadow-card hover:bg-brand-50')}
          >
            {label}
          </button>
        ))}
      </div>
      {loading && !data && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && (
        <div role="tabpanel">
          {tab === 'campos' && <FieldsEditor fields={data.formFields} onSaved={() => void reload()} />}
          {tab === 'adicionais' && (
            <Panel title="ADICIONAIS — “Quer adicionar algum cuidado?”">
              <AddonsManager />
            </Panel>
          )}
          {tab === 'portes' && (
            <Panel title="Portes">
              <p className="mb-4 text-sm text-ink-500">Os portes definem o preço. Ao criar um porte novo, cadastre os valores em Preços.</p>
              <SimpleListEditor<PetSize>
                items={data.sizes}
                addLabel="Adicionar porte"
                emptyDraft={() => ({ name: '', description: '', minWeightKg: null, maxWeightKg: null, active: true })}
                renderSummary={(s) => <p className="text-xs text-ink-500">{s.description}</p>}
                renderForm={(d, set) => (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Nome" required>{(p) => <Input {...p} className="py-2.5" value={d.name ?? ''} onChange={(e) => set({ name: e.target.value })} />}</Field>
                    <Field label="Descrição">{(p) => <Input {...p} className="py-2.5" value={d.description ?? ''} onChange={(e) => set({ description: e.target.value })} placeholder="Ex.: De 4 a 10 kg" />}</Field>
                    <Field label="Peso mínimo (kg)">{(p) => <Input {...p} className="py-2.5" inputMode="decimal" value={d.minWeightKg ?? ''} onChange={(e) => set({ minWeightKg: num(e.target.value) })} />}</Field>
                    <Field label="Peso máximo (kg)">{(p) => <Input {...p} className="py-2.5" inputMode="decimal" value={d.maxWeightKg ?? ''} onChange={(e) => set({ maxWeightKg: num(e.target.value) })} />}</Field>
                  </div>
                )}
                onCreate={(d) => adminApi.createSize(d)}
                onUpdate={(id, d) => adminApi.updateSize(id, d)}
                onDelete={(id) => adminApi.deleteSize(id)}
                onReorder={(ids) => adminApi.reorder('sizes', ids)}
                onChanged={changed}
              />
            </Panel>
          )}
          {tab === 'racas' && (
            <Panel title="Raças">
              <div className="mb-4 max-w-xs">
                <Field label="Espécie" required>
                  {(p) => (
                    <Select {...p} value={breedSpecies} onChange={(e) => setBreedSpecies(e.target.value)}>
                      {data.species.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
                    </Select>
                  )}
                </Field>
              </div>
              <p className="mb-4 text-sm text-ink-500">A opção “Outra raça” aparece sempre no final da lista do cliente.</p>
              <SimpleListEditor<Breed>
                items={data.breeds.filter((b) => b.speciesId === breedSpecies)}
                addLabel="Adicionar raça"
                emptyDraft={() => ({ name: '', speciesId: breedSpecies, defaultSizeId: null, active: true })}
                renderSummary={(b) => <p className="text-xs text-ink-500">Porte sugerido: {data.sizes.find((s) => s.id === b.defaultSizeId)?.name ?? '—'}</p>}
                renderForm={(d, set) => (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Nome da raça" required>{(p) => <Input {...p} className="py-2.5" value={d.name ?? ''} onChange={(e) => set({ name: e.target.value })} />}</Field>
                    <Field label="Porte sugerido">
                      {(p) => (
                        <Select {...p} className="py-2.5" value={d.defaultSizeId ?? ''} onChange={(e) => set({ defaultSizeId: e.target.value || null })}>
                          <option value="">—</option>
                          {data.sizes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                      )}
                    </Field>
                  </div>
                )}
                onCreate={(d) => adminApi.createBreed({ ...d, speciesId: breedSpecies })}
                onUpdate={(id, d) => adminApi.updateBreed(id, { name: d.name, defaultSizeId: d.defaultSizeId, active: d.active })}
                onDelete={(id) => adminApi.deleteBreed(id)}
                onChanged={changed}
              />
            </Panel>
          )}
          {tab === 'especies' && (
            <Panel title="Espécies (etapa “Qual é o seu pet?”)">
              <SimpleListEditor<Species>
                items={data.species}
                addLabel="Adicionar espécie"
                emptyDraft={() => ({ name: '', emoji: '🐾', active: true })}
                renderSummary={(s) => <p className="text-2xl" aria-hidden>{s.emoji}</p>}
                renderForm={(d, set) => (
                  <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                    <Field label="Nome" required>{(p) => <Input {...p} className="py-2.5" value={d.name ?? ''} onChange={(e) => set({ name: e.target.value })} />}</Field>
                    <Field label="Emoji">{(p) => <Input {...p} className="py-2.5 text-center text-xl" value={d.emoji ?? ''} onChange={(e) => set({ emoji: e.target.value })} />}</Field>
                  </div>
                )}
                onCreate={(d) => adminApi.createSpecies(d)}
                onUpdate={(id, d) => adminApi.updateSpecies(id, { name: d.name, emoji: d.emoji, active: d.active })}
                onDelete={(id) => adminApi.deleteSpecies(id)}
                onChanged={changed}
              />
            </Panel>
          )}
          {tab === 'servicos' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Link to="/admin/servicos" className="card group p-6 hover:shadow-soft">
                <p className="font-display text-xl font-semibold">Serviços</p>
                <p className="mt-1 text-sm text-ink-500">Criar, editar, desativar e ordenar serviços.</p>
                <ArrowRight className="mt-4 h-5 w-5 text-brand-600 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
              <Link to="/admin/precos" className="card group p-6 hover:shadow-soft">
                <p className="font-display text-xl font-semibold">Preços</p>
                <p className="mt-1 text-sm text-ink-500">Valor de cada serviço por porte.</p>
                <ArrowRight className="mt-4 h-5 w-5 text-brand-600 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
