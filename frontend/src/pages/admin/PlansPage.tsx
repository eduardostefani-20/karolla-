import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, ReceiptText, Repeat } from 'lucide-react';
import {
  formatCents,
  formatDateBR,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PLAN_PERIODICITIES,
  PLAN_PERIODICITY_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  type CustomerPlanDetail,
  type EffectiveSubscriptionStatus,
  type PaymentMethod,
  type Plan,
  type PlanPeriodicity,
} from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { ApiError, friendlyMessage } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useAuth } from '@/context/AuthContext';
import { Alert, Badge, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { MoneyInput } from '@/components/admin/MoneyInput';
import { PageHeader } from '@/components/admin/AdminUi';
import { cn } from '@/utils/cn';

export const SUBSCRIPTION_BADGE: Record<EffectiveSubscriptionStatus, string> = {
  pending: 'bg-sun-100 text-ink-800',
  active: 'bg-leaf-50 text-leaf-800',
  overdue: 'bg-danger-50 text-danger-700',
  paused: 'bg-ink-900/10 text-ink-600',
  cancelled: 'bg-ink-900/10 text-ink-500',
};

const STATUS_FILTERS: ('' | EffectiveSubscriptionStatus)[] = ['', 'overdue', 'pending', 'active', 'paused', 'cancelled'];

/** Planos e mensalidades. Não há pagamento online: a equipe registra cada pagamento recebido. */
export default function PlansPage() {
  useDocumentMeta({ title: 'Planos — Karolla Pet', noindex: true });
  const [tab, setTab] = useState<'clientes' | 'planos'>('clientes');
  return (
    <div>
      <PageHeader
        title="Planos e mensalidades"
        description="Sem cobrança online: cada pagamento é registrado aqui por quem recebeu. Nada é marcado como pago sozinho."
      />
      <div className="mb-5 flex gap-2" role="tablist" aria-label="Seções">
        {(['clientes', 'planos'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn('rounded-full px-4 py-2 text-sm font-bold', tab === t ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 hover:bg-brand-50')}
          >
            {t === 'clientes' ? 'Clientes com plano' : 'Planos oferecidos'}
          </button>
        ))}
      </div>
      {tab === 'clientes' ? <Subscriptions /> : <PlanCatalog />}
    </div>
  );
}

function PlanCatalog() {
  const toast = useToast();
  const { can } = useAuth();
  const { data, loading, error, reload } = useAsync(() => adminApi.plans(), []);
  const { data: catalog } = useAsync(() => adminApi.catalog(), []);
  const [editing, setEditing] = useState<(Omit<Partial<Plan>, 'priceCents'> & { priceCents: number | null }) | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const serviceName = (id: string) => catalog?.services.find((s) => s.id === id)?.name ?? id;

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setErrors({});
    const body = {
      name: editing.name ?? '',
      description: editing.description ?? '',
      priceCents: editing.priceCents ?? Number.NaN,
      periodicity: editing.periodicity ?? 'monthly',
      serviceIds: editing.serviceIds ?? [],
      usesPerPeriod: Number(editing.usesPerPeriod) || 0,
      rules: editing.rules ?? '',
      active: editing.active ?? true,
    };
    try {
      if (editing.id) await adminApi.updatePlan(editing.id, body);
      else await adminApi.createPlan(body);
      toast(editing.id ? 'Plano atualizado.' : 'Plano criado.');
      setEditing(null);
      await reload();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      toast(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {can('plans.create') && (
        <Button onClick={() => setEditing({ priceCents: null, periodicity: 'monthly', serviceIds: [], usesPerPeriod: 4, active: true })} icon={<Plus className="h-4 w-4" />}>
          Novo plano
        </Button>
      )}
      {loading && !data && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && data.length === 0 && <EmptyState icon={<Repeat className="h-10 w-10" />} title="Nenhum plano cadastrado" />}
      {data && data.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((p) => (
            <li key={p.id} className="card p-4" data-testid={`plan-${p.name}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-heading text-lg font-semibold">
                    {p.name} {!p.active && <Badge className="bg-ink-900/10 text-ink-600">Inativo</Badge>}
                  </p>
                  <p className="text-sm text-ink-600">
                    {PLAN_PERIODICITY_LABELS[p.periodicity]} • {p.usesPerPeriod} uso(s) por período
                    {p.priceCents !== undefined && ` • ${formatCents(p.priceCents)}`}
                  </p>
                  <p className="text-sm text-ink-500">Cobre: {p.serviceIds.map(serviceName).join(', ')}</p>
                </div>
                {can('plans.edit') && (
                  <Button size="sm" variant="ghost" aria-label={`Editar ${p.name}`} onClick={() => setEditing({ ...p })} icon={<Pencil className="h-4 w-4" />} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <Modal
          open
          size="lg"
          onClose={() => setEditing(null)}
          title={editing.id ? 'Editar plano' : 'Novo plano'}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button variant="primary" onClick={save} loading={saving}>Salvar</Button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" required error={errors.name} className="sm:col-span-2">
              {(p) => <Input {...p} value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex.: Plano 4 banhos" />}
            </Field>
            <Field label="Valor" required error={errors.priceCents} hint="Preço do plano por período (definido pela Karolla Pet).">
              {(p) => <MoneyInput {...p} value={editing.priceCents} onChange={(v) => setEditing({ ...editing, priceCents: v })} />}
            </Field>
            <Field label="Periodicidade" required>
              {(p) => (
                <Select {...p} value={editing.periodicity ?? 'monthly'} onChange={(e) => setEditing({ ...editing, periodicity: e.target.value as PlanPeriodicity })}>
                  {PLAN_PERIODICITIES.map((x) => (
                    <option key={x} value={x}>{PLAN_PERIODICITY_LABELS[x]}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Usos por período" required error={errors.usesPerPeriod}>
              {(p) => <Input {...p} type="number" min={1} value={editing.usesPerPeriod ?? ''} onChange={(e) => setEditing({ ...editing, usesPerPeriod: Number(e.target.value) })} />}
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-semibold text-ink-700">Serviços incluídos</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {catalog?.services.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-ink-900/10 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-brand-600"
                      checked={editing.serviceIds?.includes(s.id) ?? false}
                      onChange={(e) =>
                        setEditing({ ...editing, serviceIds: e.target.checked ? [...(editing.serviceIds ?? []), s.id] : (editing.serviceIds ?? []).filter((x) => x !== s.id) })
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </div>
              {errors.serviceIds && <p className="mt-1 text-sm font-semibold text-danger-600">{errors.serviceIds}</p>}
            </fieldset>
            <Field label="Descrição" className="sm:col-span-2">
              {(p) => <Textarea {...p} rows={2} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />}
            </Field>
            <Field label="Regras" className="sm:col-span-2" hint="Ex.: usos não acumulam para o mês seguinte.">
              {(p) => <Textarea {...p} rows={2} value={editing.rules ?? ''} onChange={(e) => setEditing({ ...editing, rules: e.target.value })} />}
            </Field>
            <Toggle checked={editing.active ?? true} onChange={(v) => setEditing({ ...editing, active: v })} label="Ativo (pode ser contratado)" />
          </div>
        </Modal>
      )}
    </div>
  );
}

function Subscriptions() {
  const [status, setStatus] = useState<'' | EffectiveSubscriptionStatus>('');
  const { data, loading, error, reload } = useAsync(() => adminApi.customerPlans({ status: status || undefined }), [status]);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Situação">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || 'todos'}
            type="button"
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={cn('rounded-full px-3 py-1.5 text-sm font-semibold', status === s ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 hover:bg-brand-50')}
          >
            {s ? SUBSCRIPTION_STATUS_LABELS[s] : 'Todos'}
          </button>
        ))}
      </div>
      <p className="text-sm text-ink-500">Para contratar um plano, abra a ficha do cliente → “Planos”.</p>
      {loading && !data && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && data.length === 0 && <EmptyState icon={<ReceiptText className="h-10 w-10" />} title="Nenhum plano nesta situação" />}
      {data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => setOpen(s.id)} className="card flex w-full flex-wrap items-center gap-3 p-4 text-left hover:shadow-lift" data-testid={`subscription-${s.customerName}`}>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.customerName}{s.petName ? ` • ${s.petName}` : ''}</span>
                  <span className="block text-sm text-ink-500">
                    {s.plan.name} • vence {formatDateBR(s.nextDueDate)} • {s.usesLeft} de {s.plan.usesPerPeriod} usos
                  </span>
                </span>
                <Badge className={SUBSCRIPTION_BADGE[s.effectiveStatus]}>{SUBSCRIPTION_STATUS_LABELS[s.effectiveStatus]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <SubscriptionModal id={open} onClose={() => setOpen(null)} onChanged={() => void reload()} />}
    </div>
  );
}

/** Detalhe do plano do cliente: pagamentos, usos, histórico e ações. */
export function SubscriptionModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged?: () => void }) {
  const toast = useToast();
  const { can } = useAuth();
  const { data: s, setData, loading, error } = useAsync(() => adminApi.customerPlan(id), [id]);
  const [payment, setPayment] = useState<{ amountCents: number | null; paidAt: string; method: PaymentMethod; notes: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<CustomerPlanDetail>, ok: string) => {
    setBusy(true);
    setErrors({});
    try {
      setData(await fn());
      toast(ok);
      onChanged?.();
      return true;
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      toast(friendlyMessage(err), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open size="lg" onClose={onClose} title={s ? `${s.plan.name} — ${s.customerName}` : 'Plano do cliente'} footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      {loading && !s && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {s && (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={SUBSCRIPTION_BADGE[s.effectiveStatus]}>{SUBSCRIPTION_STATUS_LABELS[s.effectiveStatus]}</Badge>
            <span>Próximo vencimento: <strong>{formatDateBR(s.nextDueDate)}</strong></span>
            {s.priceCents !== undefined && <span>• Valor: <strong>{formatCents(s.priceCents)}</strong></span>}
            <span>• Usos no período: {s.usesInPeriod}/{s.plan.usesPerPeriod}</span>
            <Link to={`/admin/clientes/${s.customerId}`} className="font-semibold text-brand-700 underline">Ver cliente</Link>
          </div>
          {s.plan.rules && <p className="rounded-2xl bg-lilac-50 px-3 py-2 text-ink-700">{s.plan.rules}</p>}

          <div className="flex flex-wrap gap-2">
            {can('plans.confirm') && s.status !== 'cancelled' && (
              <Button size="sm" onClick={() => setPayment({ amountCents: s.priceCents ?? null, paidAt: new Date().toISOString().slice(0, 10), method: 'pix', notes: '' })}>
                Registrar pagamento recebido
              </Button>
            )}
            {can('plans.edit') && s.status === 'active' && (
              <Button size="sm" variant="outline" loading={busy} onClick={() => act(() => adminApi.updateSubscription(s.id, { status: 'paused' }), 'Plano pausado.')}>Pausar</Button>
            )}
            {can('plans.edit') && s.status === 'paused' && (
              <Button size="sm" variant="outline" loading={busy} onClick={() => act(() => adminApi.updateSubscription(s.id, { status: 'active' }), 'Plano reativado.')}>Reativar</Button>
            )}
            {can('plans.edit') && s.status !== 'cancelled' && (
              <Button size="sm" variant="danger" loading={busy} onClick={() => act(() => adminApi.updateSubscription(s.id, { status: 'cancelled' }), 'Plano cancelado.')}>Cancelar plano</Button>
            )}
          </div>

          {payment && (
            <div className="card space-y-3 p-4">
              <p className="font-semibold">Pagamento recebido (não há cobrança online)</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Valor" required error={errors.amountCents}>
                  {(p) => <MoneyInput {...p} value={payment.amountCents} onChange={(v) => setPayment({ ...payment, amountCents: v })} />}
                </Field>
                <Field label="Data" required error={errors.paidAt}>
                  {(p) => <Input {...p} type="date" value={payment.paidAt} onChange={(e) => setPayment({ ...payment, paidAt: e.target.value })} />}
                </Field>
                <Field label="Forma">
                  {(p) => (
                    <Select {...p} value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value as PaymentMethod })}>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <Field label="Observação">{(p) => <Input {...p} value={payment.notes} onChange={(e) => setPayment({ ...payment, notes: e.target.value })} />}</Field>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setPayment(null)}>Cancelar</Button>
                <Button
                  loading={busy}
                  onClick={async () => {
                    const ok = await act(
                      () => adminApi.recordPayment(s.id, { ...payment, amountCents: payment.amountCents ?? Number.NaN }),
                      'Pagamento registrado. O vencimento foi para o próximo período.',
                    );
                    if (ok) setPayment(null);
                  }}
                >
                  Confirmar pagamento
                </Button>
              </div>
            </div>
          )}

          {s.payments.length > 0 && (
            <section>
              <h3 className="mb-1 font-semibold">Pagamentos</h3>
              <ul className="divide-y divide-ink-900/5">
                {s.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                    <span>{formatDateBR(p.paidAt)} • {PAYMENT_METHOD_LABELS[p.method]} • período {formatDateBR(p.periodFrom)}–{formatDateBR(p.periodTo)}</span>
                    <span className="text-ink-500">{p.amountCents !== undefined && `${formatCents(p.amountCents)} • `}{p.recordedByName}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {s.usages.length > 0 && (
            <section>
              <h3 className="mb-1 font-semibold">Usos</h3>
              <ul className="divide-y divide-ink-900/5">
                {s.usages.map((u) => (
                  <li key={u.id} className="flex justify-between gap-2 py-1.5">
                    <Link to={`/admin/agendamentos/${u.appointmentId}`} className="text-brand-700 underline">{formatDateBR(u.usedAt)}</Link>
                    <span className="text-ink-500">{u.recordedByName}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h3 className="mb-1 font-semibold">Histórico</h3>
            <ul className="space-y-1 text-ink-600">
              {s.events.map((e) => (
                <li key={e.id}>
                  <span className="text-ink-400">{new Date(e.createdAt).toLocaleString('pt-BR')}</span> — {e.detail} <span className="text-ink-400">({e.actorName})</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Modal>
  );
}
