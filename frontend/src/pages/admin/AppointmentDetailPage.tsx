import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Car, ImageIcon, Megaphone, MessageCircle, Pencil, RefreshCw, UserRound } from 'lucide-react';
import {
  APPOINTMENT_ORIGIN_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  attributionChannel,
  buildWhatsAppLink,
  calculateAppointmentPrice,
  formatAge,
  formatCents,
  formatDateBR,
  formatPhone,
  PricingError,
  type AppointmentAttribution,
  type AppointmentDetail,
  type AppointmentStatus,
} from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { friendlyMessage } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useAuth } from '@/context/AuthContext';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { Button, ExternalButton } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { PageHeader, Panel, StatusBadge, STATUS_STYLES } from '@/components/admin/AdminUi';
import { EditCustomerModal } from '@/components/admin/EditCustomerModal';
import { EditPetModal } from '@/components/admin/EditPetModal';
import { ContactButton } from '@/components/admin/ContactButton';
import { TransportCard } from '@/components/admin/TaxiTransportCard';
import { cn } from '@/utils/cn';

const LOG_LABEL: Record<string, string> = { success: 'Enviado', failed: 'Falhou', skipped: 'Não configurado', link_generated: 'Link gerado' };

function EditForm({ a, onSaved }: { a: AppointmentDetail; onSaved: (a: AppointmentDetail) => void }) {
  const toast = useToast();
  const { data: catalog } = useAsync(() => adminApi.catalog(), []);
  const [form, setForm] = useState({
    date: a.date,
    time: a.time,
    sizeId: a.sizeId,
    serviceId: a.services[0]?.serviceId ?? '',
    addonIds: a.addons.map((x) => x.addonId),
    notes: a.notes,
    customerNotes: a.customerNotes,
    professionalId: a.professionalId ?? '',
    recalculatePrice: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setForm((f) => ({ ...f, date: a.date, time: a.time, notes: a.notes, sizeId: a.sizeId, professionalId: a.professionalId ?? '' }));
  }, [a]);

  const itemsChanged = form.serviceId !== (a.services[0]?.serviceId ?? '') || form.sizeId !== a.sizeId || form.addonIds.slice().sort().join() !== a.addons.map((x) => x.addonId).sort().join();
  const preview = useMemo(() => {
    if (!catalog || !(itemsChanged || form.recalculatePrice)) return null;
    try {
      return calculateAppointmentPrice({ serviceIds: [form.serviceId], sizeId: form.sizeId, addonIds: form.addonIds }, catalog, { allowInactive: true });
    } catch (err) {
      return err instanceof PricingError ? err.message : 'Não foi possível calcular.';
    }
  }, [catalog, form, itemsChanged]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await adminApi.updateAppointment(a.id, {
        date: form.date,
        time: form.time,
        notes: form.notes,
        customerNotes: form.customerNotes,
        ...((form.professionalId || null) !== (a.professionalId ?? null) ? { professionalId: form.professionalId || null } : {}),
        ...(itemsChanged || form.recalculatePrice ? { serviceIds: [form.serviceId], addonIds: form.addonIds, sizeId: form.sizeId, recalculatePrice: form.recalculatePrice } : {}),
      });
      toast('Agendamento atualizado.');
      onSaved(updated);
      setForm((f) => ({ ...f, recalculatePrice: false }));
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!catalog) return <Spinner />;
  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Data" required>{(p) => <Input {...p} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}</Field>
        <Field label="Horário" required>{(p) => <Input {...p} type="time" step={300} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />}</Field>
        <Field label="Porte (preço)" required>
          {(p) => (
            <Select {...p} value={form.sizeId} onChange={(e) => setForm({ ...form, sizeId: e.target.value })}>
              {catalog.sizes.map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' (inativo)'}</option>)}
            </Select>
          )}
        </Field>
      </div>
      {(catalog.professionals.length > 0 || a.professionalId) && (
        <Field label="Profissional" hint="O sistema não deixa um profissional com dois pets ao mesmo tempo.">
          {(p) => (
            <Select {...p} value={form.professionalId} onChange={(e) => setForm({ ...form, professionalId: e.target.value })} data-testid="appointment-professional">
              <option value="">Sem profissional definido</option>
              {catalog.professionals.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name}
                  {pr.active ? '' : ' (inativo)'}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <Field label="Serviço" required>
        {(p) => (
          <Select {...p} value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
            {catalog.services.map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' (inativo)'}</option>)}
          </Select>
        )}
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-700">Adicionais</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {catalog.addons.map((ad) => (
            <label key={ad.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-ink-900/10 px-3 py-2.5 text-sm hover:bg-brand-50">
              <input
                type="checkbox"
                className="h-5 w-5 accent-brand-600"
                checked={form.addonIds.includes(ad.id)}
                onChange={(e) => setForm({ ...form, addonIds: e.target.checked ? [...form.addonIds, ad.id] : form.addonIds.filter((x) => x !== ad.id) })}
              />
              <span className="flex-1">{ad.name}{ad.active ? '' : ' (inativo)'}</span>
              <span className="tabular-nums text-ink-500">{formatCents(ad.priceCents)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Toggle checked={form.recalculatePrice} onChange={(v) => setForm({ ...form, recalculatePrice: v })} label="Recalcular com a tabela de preços atual" description="Por padrão o valor gravado no agendamento é mantido." />
      {preview && (
        <p className={cn('rounded-2xl px-4 py-3 text-sm', typeof preview === 'string' ? 'bg-danger-50 text-danger-700' : 'bg-brand-50 text-brand-900')}>
          {typeof preview === 'string' ? preview : <>Novo total: <strong>{formatCents(preview.totalCents)}</strong> • duração {preview.totalDurationMinutes} min</>}
        </p>
      )}
      <Field label="Observações internas">{(p) => <Textarea {...p} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}</Field>
      <Field label="Observações do tutor">{(p) => <Textarea {...p} value={form.customerNotes} onChange={(e) => setForm({ ...form, customerNotes: e.target.value })} />}</Field>
      <div className="flex justify-end">
        <Button variant="primary" onClick={save} loading={saving}>
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}

export default function AppointmentDetailPage() {
  const { id = '' } = useParams();
  useDocumentMeta({ title: 'Agendamento — Karolla Pet', noindex: true });
  const toast = useToast();
  const { can } = useAuth();
  const { data: a, loading, error, reload, setData } = useAsync(() => adminApi.appointment(id), [id]);
  const { data: catalog } = useAsync(() => adminApi.catalog(), []);
  const [editCustomer, setEditCustomer] = useState(false);
  const [editPet, setEditPet] = useState(false);
  const [statusSaving, setStatusSaving] = useState<AppointmentStatus | null>(null);
  const [resending, setResending] = useState(false);

  if (loading && !a) return <Spinner />;
  if (error || !a) return <Alert tone="error">{error ?? 'Agendamento não encontrado.'}</Alert>;

  const changeStatus = async (status: AppointmentStatus) => {
    setStatusSaving(status);
    try {
      setData(await adminApi.updateStatus(a.id, status));
      toast(`Status alterado para "${APPOINTMENT_STATUS_LABELS[status]}".`);
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setStatusSaving(null);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      setData(await adminApi.resendNotifications(a.id));
      toast('Integrações processadas novamente.');
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setResending(false);
    }
  };

  const size = catalog?.sizes.find((s) => s.id === a.sizeId);
  const customerMsg = `Olá, ${a.customer.name.split(' ')[0]}! Aqui é da Karolla Pet 🐾 Sobre o agendamento do(a) ${a.pet.name} em ${formatDateBR(a.date)} às ${a.time}:`;

  return (
    <div>
      <Link to="/admin/agendamentos" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Agendamentos
      </Link>
      <PageHeader
        title={`${a.pet.name} • ${formatDateBR(a.date)} às ${a.time}`}
        description={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={a.status} /> {a.services.map((s) => s.name).join(' + ')} {can('finance.view') && `• ${formatCents(a.totalCents)}`} • {a.durationMinutes} min</span>}
        actions={
          <>
            {can('agenda.confirm') && can('customers.view') && (
              <ContactButton
                customerId={a.customerId}
                kind="pickup"
                label={a.status === 'ready' ? 'Avisar que está pronto' : 'Avisar tutor pelo WhatsApp'}
                start={() => adminApi.notifyPickup(a.id)}
              />
            )}
            {a.customer.whatsapp && (
              <ExternalButton href={buildWhatsAppLink(a.customer.whatsapp, customerMsg)} variant="outline" size="sm" icon={<MessageCircle className="h-4 w-4" aria-hidden />}>
                Conversar
              </ExternalButton>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Panel title="Status">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Alterar status">
              {APPOINTMENT_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={a.status === s}
                  disabled={statusSaving !== null || !can('agenda.confirm')}
                  onClick={() => a.status !== s && changeStatus(s)}
                  className={cn(
                    'rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all disabled:opacity-60',
                    a.status === s ? cn(STATUS_STYLES[s], 'border-transparent ring-2 ring-ink-900/20') : 'border-ink-900/10 bg-white text-ink-600 hover:border-brand-300',
                  )}
                >
                  {APPOINTMENT_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </Panel>
          {can('agenda.edit') && (
            <Panel title="Editar agendamento">
              <EditForm a={a} onSaved={setData} />
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          {a.inspiration && (
            <Panel title={<span className="flex items-center gap-2"><ImageIcon className="h-5 w-5 text-brand-500" aria-hidden /> Inspiração escolhida pelo cliente</span>}>
              <a href={a.inspiration.imageUrl} target="_blank" rel="noopener noreferrer" className="block" data-testid="appointment-inspiration">
                <img src={a.inspiration.imageUrl} alt={a.inspiration.title} className="max-h-80 w-full rounded-2xl object-cover" />
              </a>
              <p className="mt-3 font-semibold">{a.inspiration.title}</p>
              <p className="text-sm text-ink-500">{a.inspiration.breedName} • toque na foto para ampliar</p>
            </Panel>
          )}
          {can('pets.view') && <GroomingReferencesPanel appointment={a} />}
          {can('taxidog.view') && <TaxiPanel appointmentId={a.id} />}
          {a.professional && (
            <Panel title={<span className="flex items-center gap-2"><UserRound className="h-5 w-5 text-brand-600" aria-hidden /> Profissional</span>}>
              <p className="flex items-center gap-2 font-semibold">
                <span className="h-3 w-3 rounded-full" style={{ background: a.professional.color }} aria-hidden /> {a.professional.name}
              </p>
            </Panel>
          )}
          {a.attribution && <OriginPanel attribution={a.attribution} />}
          {can('plans.view') && <PlansPanel appointment={a} canUse={can('plans.edit')} />}
          <Panel title={can('finance.view') ? 'Itens e valores' : 'Itens'}>
            <ul className="space-y-1.5 text-sm">
              {a.services.map((s) => (
                <li key={s.serviceId} className="flex justify-between"><span className="font-semibold">{s.name}</span>{can('finance.view') && <span className="tabular-nums">{formatCents(s.priceCents)}</span>}</li>
              ))}
              {a.addons.map((s) => (
                <li key={s.addonId} className="flex justify-between text-ink-500"><span>+ {s.name}</span>{can('finance.view') && <span className="tabular-nums">{formatCents(s.priceCents)}</span>}</li>
              ))}
            </ul>
            {can('finance.view') && (
              <p className="mt-3 flex justify-between border-t border-dashed border-ink-900/10 pt-3 font-semibold"><span>Total</span><span className="tabular-nums">{formatCents(a.totalCents)}</span></p>
            )}
            <p className="mt-1 text-xs text-ink-400">Porte considerado: {size?.name ?? a.sizeId}.{can('finance.view') && ' Valores gravados no momento do agendamento.'}</p>
          </Panel>
          <Panel title="Pet" actions={catalog && can('pets.edit') && <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditPet(true)}>Editar</Button>}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-ink-500">Nome</dt><dd><Link className="font-semibold text-brand-700 underline-offset-2 hover:underline" to={`/admin/pets/${a.pet.id}`}>{a.pet.name}</Link></dd>
              <dt className="text-ink-500">Raça</dt><dd>{a.pet.breedName}</dd>
              <dt className="text-ink-500">Porte</dt><dd>{catalog?.sizes.find((s) => s.id === a.pet.sizeId)?.name}</dd>
              <dt className="text-ink-500">Peso</dt><dd>{a.pet.weightKg != null ? `${a.pet.weightKg} kg` : '—'}</dd>
              <dt className="text-ink-500">Idade</dt><dd>{formatAge(a.pet.ageMonths) || '—'}</dd>
              <dt className="text-ink-500">Obs.</dt><dd>{a.pet.notes || '—'}</dd>
            </dl>
          </Panel>
          <Panel title="Tutor" actions={can('customers.edit') && a.customer.address && <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditCustomer(true)}>Editar</Button>}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-ink-500">Nome</dt>
              <dd>
                {can('customers.view') ? (
                  <Link className="font-semibold text-brand-700 underline-offset-2 hover:underline" to={`/admin/clientes/${a.customer.id}`}>{a.customer.name}</Link>
                ) : (
                  <span className="font-semibold">{a.customer.name}</span>
                )}
              </dd>
              {a.customer.address && (
                <>
                  <dt className="text-ink-500">WhatsApp</dt><dd>{formatPhone(a.customer.whatsapp)}</dd>
                  <dt className="text-ink-500">E-mail</dt><dd className="break-all">{a.customer.email || '—'}</dd>
                  <dt className="text-ink-500">Endereço</dt>
                  <dd>{[a.customer.address.street && `${a.customer.address.street}, ${a.customer.address.number}`, a.customer.address.complement, a.customer.address.neighborhood, a.customer.address.city].filter(Boolean).join(' — ') || '—'}</dd>
                </>
              )}
            </dl>
          </Panel>
          <Panel title="Integrações" actions={can('agenda.edit') && <Button size="sm" variant="ghost" loading={resending} icon={<RefreshCw className="h-4 w-4" />} onClick={resend}>Reenviar</Button>}>
            {a.integrationLogs?.length ? (
              <ul className="space-y-2 text-sm">
                {a.integrationLogs.map((l) => (
                  <li key={l.id} className="rounded-xl bg-lilac-50 px-3 py-2">
                    <p className="flex justify-between font-semibold">
                      <span>{l.integration === 'whatsapp' ? 'WhatsApp' : 'Google Sheets'}</span>
                      <span className={l.status === 'failed' ? 'text-danger-600' : l.status === 'success' ? 'text-leaf-700' : 'text-ink-500'}>{LOG_LABEL[l.status]}</span>
                    </p>
                    <p className="text-xs text-ink-500">{l.detail}</p>
                    <p className="text-[11px] text-ink-400">{new Date(l.createdAt).toLocaleString('pt-BR')}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">Nenhum registro.</p>
            )}
          </Panel>
          <p className="text-xs text-ink-400">
            Criado em {new Date(a.createdAt).toLocaleString('pt-BR')} • Atualizado em {new Date(a.updatedAt).toLocaleString('pt-BR')} • Origem: {a.origin ? APPOINTMENT_ORIGIN_LABELS[a.origin] : a.source === 'online' ? 'Site' : 'Painel'}
            {a.createdByName && ` • criado por ${a.createdByName}`}
          </p>
        </div>
      </div>
      {editCustomer && <EditCustomerModal open customer={a.customer} onClose={() => setEditCustomer(false)} onSaved={() => void reload()} />}
      {editPet && catalog && <EditPetModal open pet={a.pet} catalog={catalog} onClose={() => setEditPet(false)} onSaved={() => void reload()} />}
    </div>
  );
}

/** De onde o cliente veio (anúncio, Instagram, Google…) — capturado no site no momento do agendamento. */
function OriginPanel({ attribution: o }: { attribution: AppointmentAttribution }) {
  const channel = attributionChannel(o);
  const rows: [string, string | undefined][] = [
    ['Campanha', o.utmCampaign],
    ['Anúncio / conteúdo', o.utmContent],
    ['Palavra-chave', o.utmTerm],
    ['Fonte / meio', [o.utmSource, o.utmMedium].filter(Boolean).join(' / ') || undefined],
    ['Veio do site', o.referrer],
    ['Primeira página', o.landingPage],
  ];
  return (
    <Panel title={<span className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-brand-600" aria-hidden /> Origem do cliente</span>}>
      <p className="flex flex-wrap items-center gap-2 font-semibold" data-testid="appointment-origin">
        {channel.label}
        {channel.paid && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-extrabold text-primary-dark">ANÚNCIO</span>}
      </p>
      <dl className="mt-2 space-y-1 text-sm">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-ink-500">{k}</dt>
              <dd className="break-all text-right font-medium">{v}</dd>
            </div>
          ))}
      </dl>
    </Panel>
  );
}

/** Planos do tutor que cobrem serviços deste atendimento: usar (desconta 1 uso) ou desfazer. */
function PlansPanel({ appointment: a, canUse }: { appointment: AppointmentDetail; canUse: boolean }) {
  const toast = useToast();
  const { data, error, setData } = useAsync(() => adminApi.appointmentPlans(a.id), [a.id]);
  const [busy, setBusy] = useState<string | null>(null);
  if (error || !data || (data.plans.length === 0 && data.usages.length === 0)) return null;

  const run = async (key: string, fn: () => Promise<typeof data>, ok: string) => {
    setBusy(key);
    try {
      setData(await fn());
      toast(ok);
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel title="Planos do tutor">
      <ul className="space-y-3 text-sm">
        {data.plans.map((p) => (
          <li key={p.id} className="rounded-2xl bg-lilac-50 px-3 py-2">
            <p className="flex flex-wrap justify-between gap-2 font-semibold">
              <span>{p.plan.name}{p.petName ? ` • ${p.petName}` : ''}</span>
              <span>{SUBSCRIPTION_STATUS_LABELS[p.effectiveStatus]} • {p.usesLeft} de {p.plan.usesPerPeriod} usos</span>
            </p>
            {canUse && p.effectiveStatus === 'active' && (
              <div className="mt-2 flex flex-wrap gap-2">
                {a.services
                  .filter((s) => p.plan.serviceIds.includes(s.serviceId) && !data.usages.some((u) => u.serviceId === s.serviceId))
                  .map((s) => (
                    <Button
                      key={s.serviceId}
                      size="sm"
                      variant="outline"
                      disabled={p.usesLeft <= 0}
                      loading={busy === `${p.id}:${s.serviceId}`}
                      onClick={() => run(`${p.id}:${s.serviceId}`, () => adminApi.usePlan(a.id, { customerPlanId: p.id, serviceId: s.serviceId }), 'Uso do plano registrado.')}
                    >
                      Usar para {s.name}
                    </Button>
                  ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {data.usages.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {data.usages.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2">
              <span>✅ {a.services.find((s) => s.serviceId === u.serviceId)?.name ?? u.serviceId} coberto pelo plano ({u.recordedByName})</span>
              {canUse && (
                <Button size="sm" variant="ghost" loading={busy === u.id} onClick={() => run(u.id, () => adminApi.revertPlanUsage(u.id), 'Uso desfeito.')}>
                  Desfazer
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Fotos de referência que o tutor enviou para ESTE atendimento (links temporários, armazenamento privado). */
function GroomingReferencesPanel({ appointment: a }: { appointment: AppointmentDetail }) {
  const { data } = useAsync(() => adminApi.pet(a.pet.id).catch(() => null), [a.pet.id]);
  const refs = (data?.references ?? []).filter((r) => r.appointmentId === a.id);
  if (!refs.length) return null;
  return (
    <Panel title={<span className="flex items-center gap-2"><Camera className="h-5 w-5 text-brand-500" aria-hidden /> Referência de tosa enviada pelo tutor</span>}>
      <ul className="space-y-3" data-testid="appointment-grooming-references">
        {refs.map((r) => (
          <li key={r.id}>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="block">
              <img src={r.url} alt={r.description || 'Foto de referência'} className="max-h-80 w-full rounded-2xl object-cover" />
            </a>
            {r.description && <p className="mt-2 text-sm text-ink-700">{r.description}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-400">Foto privada: o link expira em alguns minutos (recarregue a página para ver de novo).</p>
    </Panel>
  );
}

/** Transporte do Taxi Dog deste atendimento (status próprio). */
function TaxiPanel({ appointmentId }: { appointmentId: string }) {
  const { data, reload } = useAsync(
    () => Promise.all([adminApi.taxiTransports({ appointmentId }), adminApi.taxi()]).catch(() => null),
    [appointmentId],
  );
  if (!data || data[0].length === 0) return null;
  const [transports, overview] = data;
  return (
    <Panel title={<span className="flex items-center gap-2"><Car className="h-5 w-5 text-brand-600" aria-hidden /> Taxi Dog</span>}>
      <ul className="space-y-4">
        {transports.map((t) => (
          <TransportCard key={t.id} transport={t} drivers={overview.drivers} onSaved={() => void reload()} compact />
        ))}
      </ul>
      <Link to="/admin/taxi-dog" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">Ver todos os transportes</Link>
    </Panel>
  );
}
