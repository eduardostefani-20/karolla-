import { useState, type ReactNode } from 'react';
import { CalendarDays, Clock, MapPin, PawPrint, Plus, Scissors, User } from 'lucide-react';
import { formatAge, formatCents, formatDateBR, formatDateLong, normalizeBrazilianPhone, type BookingRequestInput } from '@karolla/shared';
import { useCatalog } from '@/context/CatalogContext';
import { useBooking } from '@/context/BookingContext';
import { publicApi } from '@/services/publicApi';
import { ApiError, friendlyMessage } from '@/services/api';
import { Alert } from '@/components/ui/Feedback';
import { useBookingPrice } from './useBookingPrice';
import { StepHeader } from './StepHeader';
import { StepNav } from './StepNav';

/** Rótulos amigáveis e etapa de cada campo que o servidor pode recusar. */
const FIELD_INFO: Record<string, { label: string; step: number }> = {
  'pet.name': { label: 'Nome do pet', step: 2 },
  'pet.breedId': { label: 'Raça', step: 2 },
  'pet.breedName': { label: 'Raça', step: 2 },
  'pet.sizeId': { label: 'Porte', step: 2 },
  'pet.weightKg': { label: 'Peso do pet', step: 2 },
  'pet.ageMonths': { label: 'Idade do pet', step: 2 },
  'pet.notes': { label: 'Observações do pet', step: 2 },
  serviceIds: { label: 'Serviço', step: 3 },
  addonIds: { label: 'Adicionais', step: 4 },
  date: { label: 'Data', step: 5 },
  time: { label: 'Horário', step: 6 },
};
function fieldInfo(path: string) {
  if (FIELD_INFO[path]) return FIELD_INFO[path]!;
  if (path.startsWith('tutor.')) return { label: 'Seus dados', step: 7 };
  if (path.startsWith('pet.')) return { label: 'Dados do pet', step: 2 };
  return null;
}

function Block({ icon, title, onEdit, children }: { icon: ReactNode; title: string; onEdit?: () => void; children: ReactNode }) {
  return (
    <section className="border-b border-dashed border-ink-900/10 py-4 last:border-0">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-700">
          {icon} {title}
        </h2>
        {onEdit && (
          <button type="button" onClick={onEdit} className="text-sm font-semibold text-coral-600 underline-offset-2 hover:underline">
            Alterar
          </button>
        )}
      </div>
      <div className="text-[15px] text-ink-700">{children}</div>
    </section>
  );
}

export function SummaryStep({
  onBack,
  goTo,
  onConfirmed,
  onSlotTaken,
}: {
  onBack: () => void;
  goTo: (step: number) => void;
  onConfirmed: () => void;
  onSlotTaken: (message: string) => void;
}) {
  const { catalog, reload } = useCatalog();
  const { draft, update } = useBooking();
  const { price, error: priceError } = useBookingPrice();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ path: string; label: string; step: number; message: string }[]>([]);
  const [honeypot, setHoneypot] = useState('');

  if (!catalog) return null;
  const species = catalog.species.find((s) => s.id === draft.speciesId);
  const size = catalog.sizes.find((s) => s.id === draft.pet.sizeId);
  const service = catalog.services.find((s) => s.id === draft.serviceId);
  const addons = catalog.addons.filter((a) => draft.addonIds.includes(a.id));
  const t = draft.tutor;
  const address = [t.address.street && `${t.address.street}, ${t.address.number}`, t.address.complement, t.address.neighborhood, t.address.city].filter(Boolean).join(' — ');

  const confirm = async () => {
    if (!price || !draft.serviceId || !draft.date || !draft.time || !draft.speciesId) return;
    setSubmitting(true);
    setError(null);
    setFieldErrors([]);
    const payload: BookingRequestInput = {
      pet: { ...draft.pet, speciesId: draft.speciesId },
      serviceIds: [draft.serviceId],
      addonIds: draft.addonIds,
      date: draft.date,
      time: draft.time,
      tutor: { ...t, whatsapp: normalizeBrazilianPhone(t.whatsapp) },
      expectedTotalCents: price.totalCents,
      website: honeypot,
    };
    try {
      const result = await publicApi.createAppointment(payload);
      update({ result });
      onConfirmed();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SLOT_UNAVAILABLE') {
        update({ time: null });
        onSlotTaken(err.message);
        return;
      }
      if (err instanceof ApiError && ['PRICE_CHANGED', 'SERVICE_INACTIVE', 'ADDON_INACTIVE', 'PRICE_NOT_CONFIGURED'].includes(err.code)) {
        await reload();
      }
      if (err instanceof ApiError) {
        setFieldErrors(
          Object.entries(err.fields).flatMap(([path, message]) => {
            const info = fieldInfo(path);
            return info ? [{ path, ...info, message }] : [];
          }),
        );
      }
      setError(friendlyMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <StepHeader step={8} title="Resumo do agendamento" subtitle="Confira tudo com calma antes de confirmar." />
      {error && (
        <Alert tone="error" className="mb-4" title="Não foi possível confirmar">
          {fieldErrors.length ? (
            <ul className="space-y-1.5">
              {fieldErrors.map((f) => (
                <li key={f.path}>
                  <strong>{f.label}:</strong> {f.message}{' '}
                  <button type="button" className="font-semibold underline" onClick={() => goTo(f.step)}>
                    Corrigir
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            error
          )}
        </Alert>
      )}
      <div className="card px-5 py-1 sm:px-6">
        <Block icon={<PawPrint className="h-4 w-4" aria-hidden />} title={`${species?.emoji ?? ''} Pet`} onEdit={() => goTo(2)}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <dt className="text-ink-500">Nome:</dt>
            <dd className="font-semibold">{draft.pet.name}</dd>
            <dt className="text-ink-500">Raça:</dt>
            <dd>{draft.pet.breedName}</dd>
            <dt className="text-ink-500">Porte:</dt>
            <dd>{size?.name}</dd>
            {draft.pet.weightKg != null && (
              <>
                <dt className="text-ink-500">Peso:</dt>
                <dd>{String(draft.pet.weightKg).replace('.', ',')} kg</dd>
              </>
            )}
            {draft.pet.ageMonths != null && (
              <>
                <dt className="text-ink-500">Idade:</dt>
                <dd>{formatAge(draft.pet.ageMonths)}</dd>
              </>
            )}
          </dl>
        </Block>
        <Block icon={<Scissors className="h-4 w-4" aria-hidden />} title="Serviço" onEdit={() => goTo(3)}>
          <p className="font-semibold">{service?.name}</p>
        </Block>
        <Block icon={<Plus className="h-4 w-4" aria-hidden />} title="Adicionais" onEdit={() => goTo(4)}>
          {addons.length ? <ul className="list-inside list-disc">{addons.map((a) => <li key={a.id}>{a.name}</li>)}</ul> : <p className="text-ink-500">Nenhum</p>}
        </Block>
        <div className="grid grid-cols-2 gap-4">
          <Block icon={<CalendarDays className="h-4 w-4" aria-hidden />} title="Data" onEdit={() => goTo(5)}>
            <p className="font-semibold">{draft.date && formatDateBR(draft.date)}</p>
            <p className="text-sm first-letter:uppercase text-ink-500">{draft.date && formatDateLong(draft.date).split(',')[0]}</p>
          </Block>
          <Block icon={<Clock className="h-4 w-4" aria-hidden />} title="Horário" onEdit={() => goTo(6)}>
            <p className="font-semibold">{draft.time}</p>
          </Block>
        </div>
        <Block icon={<User className="h-4 w-4" aria-hidden />} title="Tutor" onEdit={() => goTo(7)}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <dt className="text-ink-500">Nome:</dt>
            <dd className="font-semibold">{t.name}</dd>
            <dt className="text-ink-500">WhatsApp:</dt>
            <dd>{t.whatsapp}</dd>
            {t.email && (
              <>
                <dt className="text-ink-500">E-mail:</dt>
                <dd className="break-all">{t.email}</dd>
              </>
            )}
          </dl>
        </Block>
        {address && (
          <Block icon={<MapPin className="h-4 w-4" aria-hidden />} title="Endereço">
            <p>{address}</p>
          </Block>
        )}
        <div className="flex items-end justify-between border-t-2 border-ink-900/10 py-5">
          <span className="font-bold uppercase tracking-wide text-ink-500">Total</span>
          <span className="font-display text-4xl font-semibold text-brand-700" data-testid="summary-total">
            {price ? formatCents(price.totalCents) : '—'}
          </span>
        </div>
      </div>
      {priceError && <Alert tone="error" className="mt-4">{priceError}</Alert>}
      {catalog.settings.bookingNotice && <p className="mt-4 text-center text-sm text-ink-500">{catalog.settings.bookingNotice}</p>}
      <input type="text" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <StepNav onBack={onBack} onNext={confirm} nextLabel="CONFIRMAR AGENDAMENTO" loading={submitting} nextDisabled={!price} />
    </div>
  );
}
