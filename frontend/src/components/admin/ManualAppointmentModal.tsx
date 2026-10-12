import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  APPOINTMENT_ORIGIN_LABELS,
  APPOINTMENT_ORIGINS,
  formatPhone,
  type AdminCatalog,
  type AppointmentOrigin,
  type CustomerSummary,
  type Pet,
} from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { publicApi } from '@/services/publicApi';
import { ApiError, friendlyMessage } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';

const NEW = '__novo__';
const OTHER_BREED = '__outra__';

/**
 * Agendamento criado pela equipe (WhatsApp, telefone, presencial...). Usa a MESMA agenda do site:
 * o servidor confere funcionamento, capacidade e profissionais antes de gravar.
 */
export function ManualAppointmentModal({ catalog, defaultDate, onClose }: { catalog: AdminCatalog; defaultDate: string; onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [results, setResults] = useState<CustomerSummary[]>([]);
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', whatsapp: '', email: '' });
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState('');
  const [newPet, setNewPet] = useState({ name: '', speciesId: catalog.species[0]?.id ?? '', breedId: '', breedName: '', sizeId: '' });
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [status, setStatus] = useState<'confirmed' | 'pending' | 'waiting'>('confirmed');
  const [origin, setOrigin] = useState<AppointmentOrigin>('whatsapp');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);

  const canSearch = can('customers.view');
  useEffect(() => {
    if (!canSearch || !q || customer) return setResults([]);
    let alive = true;
    adminApi.customers(q).then((r) => alive && setResults(r.slice(0, 6))).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [q, customer, canSearch]);

  useEffect(() => {
    if (!customer) return setPets([]);
    adminApi.customer(customer.id).then((d) => {
      setPets(d.pets);
      setPetId(d.pets[0]?.id ?? NEW);
    }).catch(() => setPets([]));
  }, [customer]);

  const pet = pets.find((p) => p.id === petId);
  const sizeId = pet?.sizeId ?? newPet.sizeId;
  const speciesId = pet?.speciesId ?? newPet.speciesId;
  const services = catalog.services.filter((s) => s.active && (s.speciesIds.length === 0 || s.speciesIds.includes(speciesId)));
  const breeds = catalog.breeds.filter((b) => b.active && b.speciesId === newPet.speciesId);
  const pros = catalog.professionals.filter((p) => p.active && (p.serviceIds.length === 0 || serviceIds.every((id) => p.serviceIds.includes(id))));

  // Sugestões de horário livres (mesmo cálculo do site; o painel também aceita outros horários)
  const suggestionKey = useMemo(() => [date, sizeId, serviceIds.join(','), addonIds.join(','), professionalId].join('|'), [date, sizeId, serviceIds, addonIds, professionalId]);
  useEffect(() => {
    setSuggestions(null);
    if (!date || !sizeId || !serviceIds.length) return;
    const ctrl = new AbortController();
    publicApi
      .availability({ date, serviceIds, addonIds, sizeId, speciesId, professionalId: professionalId || undefined }, ctrl.signal)
      .then((r) => setSuggestions(r.slots.filter((s) => s.available).map((s) => s.time)))
      .catch(() => undefined);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestionKey]);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const save = async () => {
    setErrors({});
    setError(null);
    const isNewPet = !pet;
    const breed = breeds.find((b) => b.id === newPet.breedId);
    const body = {
      customerId: customer?.id ?? null,
      newCustomer: customer ? null : newCustomer,
      petId: pet?.id ?? null,
      newPet: isNewPet
        ? {
            name: newPet.name,
            speciesId: newPet.speciesId,
            breedId: newPet.breedId && newPet.breedId !== OTHER_BREED ? newPet.breedId : null,
            breedName: breed?.name ?? newPet.breedName,
            sizeId: newPet.sizeId,
          }
        : null,
      serviceIds,
      addonIds,
      date,
      time,
      professionalId: professionalId || null,
      status,
      origin,
      notes,
    };
    setSaving(true);
    try {
      const created = await adminApi.createAppointment(body);
      toast('Agendamento criado.');
      onClose();
      navigate(`/admin/agendamentos/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Novo agendamento"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={saving}>Criar agendamento</Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        <fieldset className="space-y-3">
          <legend className="text-sm font-bold uppercase tracking-wide text-ink-400">Tutor</legend>
          {customer ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-lilac-50 px-4 py-3">
              <span>
                <strong>{customer.name}</strong> <span className="text-sm text-ink-500">{formatPhone(customer.whatsapp)}</span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => setCustomer(null)}>Trocar</Button>
            </div>
          ) : (
            <>
              {canSearch && !creatingCustomer && (
                <div className="relative">
                  <label className="relative block">
                    <span className="sr-only">Buscar tutor</span>
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
                    <Input className="pl-10" placeholder="Buscar tutor por nome ou WhatsApp" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </label>
                  {results.length > 0 && (
                    <ul className="mt-1 divide-y divide-ink-900/5 rounded-2xl border border-ink-900/10 bg-white" role="listbox" aria-label="Tutores encontrados">
                      {results.map((r) => (
                        <li key={r.id}>
                          <button type="button" role="option" aria-selected={false} className="w-full px-4 py-2 text-left hover:bg-brand-50" onClick={() => setCustomer(r)}>
                            <strong>{r.name}</strong> <span className="text-sm text-ink-500">{formatPhone(r.whatsapp)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {canSearch && (
                <button type="button" className="text-sm font-semibold text-brand-700 underline" onClick={() => setCreatingCustomer((v) => !v)}>
                  {creatingCustomer ? 'Buscar tutor cadastrado' : 'Cadastrar novo tutor'}
                </button>
              )}
              {(creatingCustomer || !canSearch) && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Nome do tutor" required error={errors['newCustomer.name']}>
                    {(p) => <Input {...p} value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />}
                  </Field>
                  <Field label="WhatsApp" required error={errors['newCustomer.whatsapp']} hint="Se já existir, usamos o cadastro.">
                    {(p) => <Input {...p} type="tel" value={newCustomer.whatsapp} onChange={(e) => setNewCustomer({ ...newCustomer, whatsapp: e.target.value })} />}
                  </Field>
                  <Field label="E-mail" error={errors['newCustomer.email']}>
                    {(p) => <Input {...p} type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />}
                  </Field>
                </div>
              )}
              {errors.customerId && <p className="text-sm font-semibold text-danger-600">{errors.customerId}</p>}
            </>
          )}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-bold uppercase tracking-wide text-ink-400">Pet</legend>
          {pets.length > 0 && (
            <Field label="Pet do tutor">
              {(p) => (
                <Select {...p} value={petId} onChange={(e) => setPetId(e.target.value)}>
                  {pets.map((x) => (
                    <option key={x.id} value={x.id}>{x.name} — {x.breedName}</option>
                  ))}
                  <option value={NEW}>+ Cadastrar outro pet</option>
                </Select>
              )}
            </Field>
          )}
          {!pet && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome do pet" required error={errors['newPet.name']}>
                {(p) => <Input {...p} value={newPet.name} onChange={(e) => setNewPet({ ...newPet, name: e.target.value })} />}
              </Field>
              <Field label="Espécie" required>
                {(p) => (
                  <Select {...p} value={newPet.speciesId} onChange={(e) => setNewPet({ ...newPet, speciesId: e.target.value, breedId: '' })}>
                    {catalog.species.filter((s) => s.active).map((s) => (
                      <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Raça" required error={errors['newPet.breedId'] ?? errors['newPet.breedName']}>
                {(p) => (
                  <Select {...p} value={newPet.breedId} onChange={(e) => setNewPet({ ...newPet, breedId: e.target.value })}>
                    <option value="">Escolha</option>
                    {breeds.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                    <option value={OTHER_BREED}>Outra (digitar)</option>
                  </Select>
                )}
              </Field>
              {newPet.breedId === OTHER_BREED && (
                <Field label="Qual raça?" required>
                  {(p) => <Input {...p} value={newPet.breedName} onChange={(e) => setNewPet({ ...newPet, breedName: e.target.value })} />}
                </Field>
              )}
              <Field label="Porte" required error={errors['newPet.sizeId']}>
                {(p) => (
                  <Select {...p} value={newPet.sizeId} onChange={(e) => setNewPet({ ...newPet, sizeId: e.target.value })}>
                    <option value="">Escolha</option>
                    {catalog.sizes.filter((s) => s.active).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          )}
          {errors.petId && <p className="text-sm font-semibold text-danger-600">{errors.petId}</p>}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-bold uppercase tracking-wide text-ink-400">Atendimento</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-ink-900/10 px-3 py-2 text-sm">
                <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={serviceIds.includes(s.id)} onChange={() => setServiceIds(toggle(serviceIds, s.id))} />
                {s.name}
              </label>
            ))}
          </div>
          {errors.serviceIds && <p className="text-sm font-semibold text-danger-600">{errors.serviceIds}</p>}
          {catalog.addons.some((a) => a.active) && (
            <details className="rounded-2xl border border-ink-900/10 px-3 py-2 text-sm">
              <summary className="cursor-pointer font-semibold">Adicionais ({addonIds.length})</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {catalog.addons.filter((a) => a.active).map((a) => (
                  <label key={a.id} className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={addonIds.includes(a.id)} onChange={() => setAddonIds(toggle(addonIds, a.id))} />
                    {a.name}
                  </label>
                ))}
              </div>
            </details>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Data" required error={errors.date}>
              {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
            </Field>
            <Field label="Horário" required error={errors.time}>
              {(p) => <Input {...p} type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />}
            </Field>
            <Field label="Profissional">
              {(p) => (
                <Select {...p} value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
                  <option value="">Qualquer disponível</option>
                  {pros.map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          {suggestions && (
            <div>
              <p className="mb-1 text-xs font-semibold text-ink-500">
                {suggestions.length ? 'Horários livres (pelas regras do site):' : 'Sem horários livres pelas regras do site nesta data.'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTime(t)}
                    className={cn('rounded-full border px-3 py-1 text-xs font-semibold', time === t ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-900/10 bg-white hover:border-brand-300')}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Origem" required>
              {(p) => (
                <Select {...p} value={origin} onChange={(e) => setOrigin(e.target.value as AppointmentOrigin)}>
                  {APPOINTMENT_ORIGINS.map((o) => (
                    <option key={o} value={o}>{APPOINTMENT_ORIGIN_LABELS[o]}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Status inicial">
              {(p) => (
                <Select {...p} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                  <option value="confirmed">Agendado</option>
                  <option value="pending">Pendente</option>
                  <option value="waiting">Aguardando atendimento (já chegou)</option>
                </Select>
              )}
            </Field>
          </div>
          <Field label="Observações internas">
            {(p) => <Textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
        </fieldset>
      </div>
    </Modal>
  );
}
