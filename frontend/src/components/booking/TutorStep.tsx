import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatPhone, resolveFormConfig } from '@karolla/shared';
import { useCatalog } from '@/context/CatalogContext';
import { useBooking } from '@/context/BookingContext';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { tutorFormSchema, type TutorFormInput, type TutorFormOutput } from '@/validations/bookingForms';
import { StepHeader } from './StepHeader';
import { StepNav } from './StepNav';

export function TutorStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { catalog } = useCatalog();
  const { draft, update } = useBooking();
  const config = useMemo(() => resolveFormConfig(catalog?.formFields ?? []), [catalog]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TutorFormInput, unknown, TutorFormOutput>({
    resolver: zodResolver(tutorFormSchema(config)),
    defaultValues: draft.tutor,
  });

  const onSubmit = (v: TutorFormOutput) => {
    update({ tutor: { ...v, whatsapp: formatPhone(v.whatsapp) } });
    onNext();
  };

  const phone = register('whatsapp');
  const f = config;
  const addressRequired = f['tutor.address'].required;

  return (
    <form id="form-tutor" onSubmit={handleSubmit(onSubmit)} noValidate>
      <StepHeader step={7} title="Seus dados" subtitle="Para a Karolla Pet confirmar o agendamento com você." />
      <div className="space-y-5">
        <Field label="Nome completo" required error={errors.name?.message}>
          {(p) => <Input {...p} {...register('name')} autoComplete="name" placeholder="Ex.: João Silva" />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="WhatsApp" required error={errors.whatsapp?.message} hint="Com DDD. Ex.: (11) 99999-9999">
            {(p) => (
              <Input
                {...p}
                {...phone}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(11) 99999-9999"
                maxLength={16}
                onChange={(e) => {
                  e.target.value = formatPhone(e.target.value);
                  void phone.onChange(e);
                }}
              />
            )}
          </Field>
          {f['tutor.email'].enabled && (
            <Field label={f['tutor.email'].label} required={f['tutor.email'].required} error={errors.email?.message} hint={f['tutor.email'].helpText}>
              {(p) => <Input {...p} {...register('email')} type="email" inputMode="email" autoComplete="email" placeholder="voce@email.com" />}
            </Field>
          )}
        </div>

        {f['tutor.address'].enabled && (
          <fieldset className="space-y-5 rounded-3xl border border-ink-900/10 p-4 sm:p-5">
            <legend className="px-2 text-sm font-bold text-ink-700">{f['tutor.address'].label}</legend>
            {f['tutor.address'].helpText && <p className="-mt-2 text-xs text-ink-500">{f['tutor.address'].helpText}</p>}
            <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
              <Field label="Endereço (rua/avenida)" required={addressRequired} error={errors.address?.street?.message}>
                {(p) => <Input {...p} {...register('address.street')} autoComplete="address-line1" />}
              </Field>
              <Field label="Número" required={addressRequired} error={errors.address?.number?.message}>
                {(p) => <Input {...p} {...register('address.number')} inputMode="numeric" />}
              </Field>
            </div>
            <Field label="Complemento" error={errors.address?.complement?.message}>
              {(p) => <Input {...p} {...register('address.complement')} autoComplete="address-line2" placeholder="Apto, bloco..." />}
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Bairro" required={addressRequired} error={errors.address?.neighborhood?.message}>
                {(p) => <Input {...p} {...register('address.neighborhood')} />}
              </Field>
              <Field label="Cidade" required={addressRequired} error={errors.address?.city?.message}>
                {(p) => <Input {...p} {...register('address.city')} autoComplete="address-level2" />}
              </Field>
            </div>
          </fieldset>
        )}

        {f['tutor.notes'].enabled && (
          <Field label={f['tutor.notes'].label} required={f['tutor.notes'].required} error={errors.notes?.message} hint={f['tutor.notes'].helpText}>
            {(p) => <Textarea {...p} {...register('notes')} placeholder="Algo que a equipe precisa saber?" />}
          </Field>
        )}
      </div>
      <StepNav onBack={onBack} formId="form-tutor" />
    </form>
  );
}
