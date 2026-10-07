import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lightbulb } from 'lucide-react';
import { resolveFormConfig, type PetSize } from '@karolla/shared';
import { useCatalog } from '@/context/CatalogContext';
import { useBooking } from '@/context/BookingContext';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { petFormSchema, type PetFormInput, type PetFormOutput } from '@/validations/bookingForms';
import { BreedCombobox, OTHER_BREED } from './BreedCombobox';
import { OptionCard } from './OptionCard';
import { StepHeader } from './StepHeader';
import { StepNav } from './StepNav';

function sizeForWeight(sizes: PetSize[], kg: number): PetSize | undefined {
  return sizes.find((s) => (s.minWeightKg == null || kg >= s.minWeightKg) && (s.maxWeightKg == null || kg < s.maxWeightKg));
}

export function PetStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { catalog } = useCatalog();
  const { draft, update } = useBooking();
  const config = useMemo(() => resolveFormConfig(catalog?.formFields ?? []), [catalog]);
  const breeds = useMemo(() => catalog?.breeds.filter((b) => b.speciesId === draft.speciesId) ?? [], [catalog, draft.speciesId]);
  const species = catalog?.species.find((s) => s.id === draft.speciesId);

  const age = draft.pet.ageMonths;
  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PetFormInput, unknown, PetFormOutput>({
    resolver: zodResolver(petFormSchema(config)),
    defaultValues: {
      name: draft.pet.name,
      breedId: draft.pet.breedId,
      breedName: draft.pet.breedName,
      isOtherBreed: Boolean(draft.pet.breedName && !draft.pet.breedId),
      sizeId: draft.pet.sizeId,
      weight: draft.pet.weightKg != null ? String(draft.pet.weightKg).replace('.', ',') : '',
      ageValue: age == null ? '' : age % 12 === 0 && age > 0 ? String(age / 12) : String(age),
      ageUnit: age != null && (age % 12 !== 0 || age === 0) ? 'meses' : 'anos',
      notes: draft.pet.notes,
    },
  });

  const isOther = watch('isOtherBreed');
  const sizeId = watch('sizeId');
  const weightText = watch('weight');
  const weightNum = Number(String(weightText ?? '').replace(',', '.'));
  const suggested = weightNum > 0 && catalog ? sizeForWeight(catalog.sizes, weightNum) : undefined;

  const onSubmit = (v: PetFormOutput) => {
    const ageMonths = v.ageValue == null ? null : v.ageUnit === 'anos' ? Math.round(v.ageValue * 12) : Math.round(v.ageValue);
    update((d) => ({
      pet: {
        name: v.name,
        breedId: v.isOtherBreed ? null : v.breedId,
        breedName: v.breedName,
        sizeId: v.sizeId,
        weightKg: v.weight,
        ageMonths,
        notes: v.notes,
      },
      // mudar o porte muda o preço/duração: horário precisa ser escolhido de novo
      ...(d.pet.sizeId && d.pet.sizeId !== v.sizeId ? { time: null } : {}),
    }));
    onNext();
  };

  if (!catalog) return null;
  const f = config;

  return (
    <form id="form-pet" onSubmit={handleSubmit(onSubmit)} noValidate>
      <StepHeader step={2} title={`Conte sobre seu ${species?.name.toLowerCase() ?? 'pet'}`} subtitle="Essas informações ajudam a equipe a preparar o atendimento ideal." />
      <div className="space-y-5">
        <Field label="Nome do pet" required error={errors.name?.message}>
          {(p) => <Input {...p} {...register('name')} placeholder="Ex.: Thor" autoComplete="off" />}
        </Field>

        <div className="rounded-2xl bg-cream-50 px-4 py-3 text-sm text-ink-600">
          Espécie: <strong>{species ? `${species.emoji} ${species.name}` : '—'}</strong>
        </div>

        <Field label="Raça" required error={errors.breedName?.message} hint="Pesquise na lista. Não encontrou? Escolha “Outra raça”.">
          {(p) => (
            <Controller
              control={control}
              name="breedId"
              render={({ field }) => (
                <BreedCombobox
                  inputId={p.id}
                  invalid={p['aria-invalid']}
                  describedBy={p['aria-describedby']}
                  breeds={breeds}
                  value={{ breedId: field.value, breedName: watch('breedName') ?? '', isOther: Boolean(isOther) }}
                  onSelect={(b) => {
                    if (b === OTHER_BREED) {
                      field.onChange(null);
                      setValue('isOtherBreed', true);
                      setValue('breedName', '');
                    } else {
                      field.onChange(b.id);
                      setValue('isOtherBreed', false);
                      setValue('breedName', b.name, { shouldValidate: true });
                      if (b.defaultSizeId && !sizeId) setValue('sizeId', b.defaultSizeId);
                    }
                  }}
                />
              )}
            />
          )}
        </Field>
        {isOther && (
          <Field label="Digite a raça" required error={errors.breedName?.message}>
            {(p) => <Input {...p} {...register('breedName')} placeholder="Ex.: Vira-lata, Sem raça definida..." autoFocus />}
          </Field>
        )}

        <fieldset>
          <legend className="mb-2 block text-sm font-semibold text-ink-700">
            Porte <span className="text-coral-500" aria-hidden>*</span>
          </legend>
          <Controller
            control={control}
            name="sizeId"
            render={({ field }) => (
              <div role="radiogroup" aria-label="Porte" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {catalog.sizes.map((s) => (
                  <OptionCard key={s.id} selected={field.value === s.id} onClick={() => field.onChange(s.id)} className="p-4" testId={`size-${s.id}`}>
                    <span className="block font-display text-lg font-semibold">{s.name}</span>
                    <span className="block text-xs text-ink-500">{s.description}</span>
                  </OptionCard>
                ))}
              </div>
            )}
          />
          {errors.sizeId && (
            <p role="alert" className="mt-2 text-sm font-medium text-red-600">
              {errors.sizeId.message}
            </p>
          )}
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          {f['pet.weight'].enabled && (
            <Field label={f['pet.weight'].label} required={f['pet.weight'].required} error={errors.weight?.message} hint={f['pet.weight'].helpText}>
              {(p) => <Input {...p} {...register('weight')} inputMode="decimal" placeholder="Ex.: 8,5" />}
            </Field>
          )}
          {f['pet.age'].enabled && (
            <Field label={f['pet.age'].label} required={f['pet.age'].required} error={errors.ageValue?.message} hint={f['pet.age'].helpText}>
              {(p) => (
                <div className="flex gap-2">
                  <Input {...p} {...register('ageValue')} inputMode="numeric" placeholder="Ex.: 3" className="min-w-0 flex-1" />
                  <Select {...register('ageUnit')} aria-label="Unidade da idade" className="w-32">
                    <option value="anos">anos</option>
                    <option value="meses">meses</option>
                  </Select>
                </div>
              )}
            </Field>
          )}
        </div>
        {suggested && suggested.id !== sizeId && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-sun-100 px-4 py-3 text-sm text-amber-950">
            <Lightbulb className="h-5 w-5 shrink-0" aria-hidden />
            <span className="flex-1">
              Pelo peso informado, o porte indicado é <strong>{suggested.name}</strong>.
            </span>
            <button type="button" className="font-semibold underline" onClick={() => setValue('sizeId', suggested.id, { shouldValidate: true })}>
              Usar {suggested.name}
            </button>
          </div>
        )}

        {f['pet.notes'].enabled && (
          <Field label={f['pet.notes'].label} required={f['pet.notes'].required} error={errors.notes?.message} hint={f['pet.notes'].helpText}>
            {(p) => <Textarea {...p} {...register('notes')} placeholder="Ex.: tem medo de secador, pele sensível..." />}
          </Field>
        )}
      </div>
      <StepNav onBack={onBack} formId="form-pet" />
    </form>
  );
}
