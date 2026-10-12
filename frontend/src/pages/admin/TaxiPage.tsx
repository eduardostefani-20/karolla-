import { useState } from 'react';
import { CalendarOff, Car, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import {
  addDays,
  formatCents,
  formatDateBR,
  formatPhone,
  nowInTimezone,
  WEEKDAY_LABELS,
  type ProfessionalWorkHours,
  type TaxiDriver,
  type TaxiOverview,
  type TaxiRegion,
  type TaxiWindow,
} from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { ApiError, friendlyMessage } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useAuth } from '@/context/AuthContext';
import { useCatalog } from '@/context/CatalogContext';
import { Alert, Badge, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { MoneyInput } from '@/components/admin/MoneyInput';
import { PageHeader, Panel } from '@/components/admin/AdminUi';
import { WorkHoursEditor } from '@/components/admin/WorkHoursEditor';
import { TransportCard } from '@/components/admin/TaxiTransportCard';
import { cn } from '@/utils/cn';

type Tab = 'transports' | 'settings';

/** Taxi Dog: transportes do dia (motorista e status próprios) e configuração do serviço. */
export default function TaxiPage() {
  useDocumentMeta({ title: 'Taxi Dog — Karolla Pet', noindex: true });
  const [tab, setTab] = useState<Tab>('transports');
  const { data, loading, error, reload } = useAsync(() => adminApi.taxi(), []);

  return (
    <div>
      <PageHeader
        title="Taxi Dog"
        description="Busca e entrega dos pets. O transporte tem status próprio, separado do atendimento, e só é confirmado com um motorista disponível."
      />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Taxi Dog">
        {(
          [
            ['transports', 'Transportes'],
            ['settings', 'Configuração'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn('rounded-full px-4 py-2 text-sm font-bold', tab === key ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 hover:bg-brand-50')}
          >
            {label}
          </button>
        ))}
      </div>
      {loading && !data && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && !data.settings.taxiEnabled && (
        <Alert tone="info" className="mb-5">
          O Taxi Dog está desligado: o site não oferece a opção. Ligue em “Configuração” depois de cadastrar regiões e motoristas.
        </Alert>
      )}
      {data && tab === 'transports' && <TransportsTab overview={data} />}
      {data && tab === 'settings' && <SettingsTab overview={data} reload={reload} />}
    </div>
  );
}

// ------------------------------------------------------------------ transportes

function TransportsTab({ overview }: { overview: TaxiOverview }) {
  const { catalog } = useCatalog();
  const today = nowInTimezone(new Date(), catalog?.settings.timezone ?? 'America/Sao_Paulo').date;
  const [date, setDate] = useState(today);
  const { data, loading, error, reload } = useAsync(() => adminApi.taxiTransports({ date }), [date]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">‹</Button>
        <Input type="date" aria-label="Data" className="w-auto py-2" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <Button variant="outline" size="sm" onClick={() => setDate(addDays(date, 1))} aria-label="Próximo dia">›</Button>
        {date !== today && <Button variant="ghost" size="sm" onClick={() => setDate(today)}>Hoje</Button>}
      </div>
      {loading && !data && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && data.length === 0 && <EmptyState icon={<Car className="h-10 w-10" />} title={`Nenhum transporte em ${formatDateBR(date)}`} />}
      {data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((t) => (
            <TransportCard key={t.id} transport={t} drivers={overview.drivers} onSaved={() => void reload()} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ configuração

function SettingsTab({ overview, reload }: { overview: TaxiOverview; reload: () => Promise<unknown> }) {
  const { can } = useAuth();
  const editable = can('taxidog.edit');
  return (
    <div className="space-y-6">
      <GeneralPanel overview={overview} reload={reload} editable={editable} />
      <RegionsPanel regions={overview.regions} reload={reload} canCreate={can('taxidog.create')} editable={editable} />
      <DriversPanel drivers={overview.drivers} reload={reload} canCreate={can('taxidog.create')} editable={editable} />
      <BlocksPanel overview={overview} reload={reload} editable={editable} />
    </div>
  );
}

function GeneralPanel({ overview, reload, editable }: { overview: TaxiOverview; reload: () => Promise<unknown>; editable: boolean }) {
  const toast = useToast();
  const [form, setForm] = useState(overview.settings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const win = (w: number) => form.taxiWindows.find((x) => x.weekday === w);
  const setWin = (w: number, patch: Partial<TaxiWindow> | null) => {
    const others = form.taxiWindows.filter((x) => x.weekday !== w);
    const current = win(w) ?? { weekday: w, startTime: '08:00', endTime: '17:00' };
    setForm({ ...form, taxiWindows: patch === null ? others : [...others, { ...current, ...patch }].sort((a, b) => a.weekday - b.weekday) });
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      await adminApi.updateTaxiSettings(form);
      toast('Configuração do Taxi Dog salva.');
      await reload();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      toast(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const ready = overview.regions.some((r) => r.active) && overview.drivers.some((d) => d.active) && form.taxiWindows.length > 0;

  return (
    <Panel title="Funcionamento">
      <fieldset disabled={!editable} className="space-y-4">
        <Toggle
          checked={form.taxiEnabled}
          onChange={(v) => setForm({ ...form, taxiEnabled: v })}
          label="Oferecer Taxi Dog no site"
          description={ready ? 'Aparece no agendamento só para endereços das regiões atendidas e em horários com motorista livre.' : 'Cadastre ao menos uma região, um motorista e um dia de funcionamento para o site oferecer.'}
        />
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-700">Dias e horários do Taxi Dog</p>
          <ul className="space-y-2">
            {WEEKDAY_LABELS.map((label, w) => {
              const d = win(w);
              return (
                <li key={w} className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex w-36 items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={Boolean(d)} onChange={(e) => setWin(w, e.target.checked ? {} : null)} />
                    {label}
                  </label>
                  {d ? (
                    <>
                      <Input type="time" aria-label={`${label}: início do Taxi Dog`} className="w-auto py-1.5" value={d.startTime} onChange={(e) => setWin(w, { startTime: e.target.value })} />
                      <span>às</span>
                      <Input type="time" aria-label={`${label}: fim do Taxi Dog`} className="w-auto py-1.5" value={d.endTime} onChange={(e) => setWin(w, { endTime: e.target.value })} />
                    </>
                  ) : (
                    <span className="text-ink-400">Sem Taxi Dog</span>
                  )}
                </li>
              );
            })}
          </ul>
          {errors.taxiWindows && <p className="mt-2 text-sm font-semibold text-danger-600">{errors.taxiWindows}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Buscar quantos minutos antes do horário" hint="Ex.: 30 = busca às 9h30 para atendimento às 10h." error={errors.taxiPickupLeadMinutes}>
            {(p) => <Input {...p} type="number" min={0} max={240} value={form.taxiPickupLeadMinutes} onChange={(e) => setForm({ ...form, taxiPickupLeadMinutes: Number(e.target.value) || 0 })} />}
          </Field>
          <Field label="Duração de cada viagem (minutos)" hint="Tempo que o motorista fica ocupado por viagem." error={errors.taxiSlotMinutes}>
            {(p) => <Input {...p} type="number" min={10} max={180} value={form.taxiSlotMinutes} onChange={(e) => setForm({ ...form, taxiSlotMinutes: Number(e.target.value) || 30 })} />}
          </Field>
        </div>
        {editable && (
          <Button onClick={save} loading={saving}>
            Salvar funcionamento
          </Button>
        )}
      </fieldset>
    </Panel>
  );
}

type RegionDraft = { id?: string; name: string; neighborhoods: string; feeOneWayCents: number | null; feeRoundTripCents: number | null; active: boolean };

function RegionsPanel({ regions, reload, canCreate, editable }: { regions: TaxiRegion[]; reload: () => Promise<unknown>; canCreate: boolean; editable: boolean }) {
  const toast = useToast();
  const [editing, setEditing] = useState<RegionDraft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // Sem permissão financeira o servidor não envia as taxas; o formulário então não mexe nelas.
  const showFees = regions.length === 0 || regions.some((r) => typeof r.feeOneWayCents === 'number');

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setErrors({});
    const body: Record<string, unknown> = {
      name: editing.name,
      neighborhoods: editing.neighborhoods.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean),
      active: editing.active,
    };
    if (showFees) {
      body.feeOneWayCents = editing.feeOneWayCents;
      body.feeRoundTripCents = editing.feeRoundTripCents;
    }
    try {
      if (editing.id) await adminApi.updateTaxiRegion(editing.id, body);
      else await adminApi.createTaxiRegion(body);
      toast('Região salva.');
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
    <Panel
      title="Regiões e taxas"
      actions={
        canCreate && (
          <Button size="sm" onClick={() => setEditing({ name: '', neighborhoods: '', feeOneWayCents: null, feeRoundTripCents: null, active: true })} icon={<Plus className="h-4 w-4" />}>
            Nova região
          </Button>
        )
      }
    >
      {regions.length === 0 ? (
        <p className="text-sm text-ink-500">Nenhuma região cadastrada. Sem região, o site não oferece Taxi Dog.</p>
      ) : (
        <ul className="divide-y divide-ink-900/5">
          {regions.map((r) => (
            <li key={r.id} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {r.name} {!r.active && <Badge className="bg-ink-900/10 text-ink-600">Inativa</Badge>}
                </p>
                <p className="text-sm text-ink-500">{r.neighborhoods.includes('*') ? 'Cidade inteira' : r.neighborhoods.join(', ')}</p>
                {typeof r.feeOneWayCents === 'number' && (
                  <p className="text-sm text-ink-600">
                    Só ida ou só volta {formatCents(r.feeOneWayCents)} • ida e volta {formatCents(r.feeRoundTripCents)}
                  </p>
                )}
              </div>
              {editable && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Editar região ${r.name}`}
                  onClick={() => setEditing({ id: r.id, name: r.name, neighborhoods: r.neighborhoods.join('\n'), feeOneWayCents: r.feeOneWayCents ?? null, feeRoundTripCents: r.feeRoundTripCents ?? null, active: r.active })}
                  icon={<Pencil className="h-4 w-4" />}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing.id ? 'Editar região' : 'Nova região'}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button variant="primary" onClick={save} loading={saving}>Salvar</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Nome da região" required error={errors.name}>
              {(p) => <Input {...p} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex.: Centro e arredores" />}
            </Field>
            <Field label="Bairros atendidos" required hint="Um por linha (ou separados por vírgula). Use * para a cidade inteira. Acentos e maiúsculas não importam." error={errors.neighborhoods}>
              {(p) => <Textarea {...p} rows={4} value={editing.neighborhoods} onChange={(e) => setEditing({ ...editing, neighborhoods: e.target.value })} />}
            </Field>
            {showFees && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Taxa só ida ou só volta" required error={errors.feeOneWayCents}>
                  {(p) => <MoneyInput {...p} value={editing.feeOneWayCents} onChange={(v) => setEditing({ ...editing, feeOneWayCents: v })} />}
                </Field>
                <Field label="Taxa ida e volta" required error={errors.feeRoundTripCents}>
                  {(p) => <MoneyInput {...p} value={editing.feeRoundTripCents} onChange={(v) => setEditing({ ...editing, feeRoundTripCents: v })} />}
                </Field>
              </div>
            )}
            <Toggle checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="Região ativa" />
          </div>
        </Modal>
      )}
    </Panel>
  );
}

type DriverDraft = { id?: string; name: string; phone: string; capacity: number; workHours: ProfessionalWorkHours[]; active: boolean };

function DriversPanel({ drivers, reload, canCreate, editable }: { drivers: TaxiDriver[]; reload: () => Promise<unknown>; canCreate: boolean; editable: boolean }) {
  const toast = useToast();
  const [editing, setEditing] = useState<DriverDraft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setErrors({});
    const body = { name: editing.name, phone: editing.phone.replace(/\D/g, ''), capacity: editing.capacity, workHours: editing.workHours, active: editing.active };
    try {
      if (editing.id) await adminApi.updateTaxiDriver(editing.id, body);
      else await adminApi.createTaxiDriver(body);
      toast('Motorista salvo.');
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
    <Panel
      title="Motoristas"
      actions={
        canCreate && (
          <Button size="sm" onClick={() => setEditing({ name: '', phone: '', capacity: 1, workHours: [], active: true })} icon={<Plus className="h-4 w-4" />}>
            Novo motorista
          </Button>
        )
      }
    >
      {drivers.length === 0 ? (
        <p className="text-sm text-ink-500">Nenhum motorista cadastrado. Sem motorista disponível, nenhum transporte é confirmado.</p>
      ) : (
        <ul className="divide-y divide-ink-900/5">
          {drivers.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <UserRound className="h-5 w-5 shrink-0 text-ink-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {d.name} {!d.active && <Badge className="bg-ink-900/10 text-ink-600">Inativo</Badge>}
                </p>
                <p className="text-sm text-ink-500">
                  {d.capacity} pet(s) por viagem • {d.workHours.length ? 'horário próprio' : 'toda a janela do Taxi Dog'}
                  {d.phone && ` • ${formatPhone(d.phone)}`}
                </p>
              </div>
              {editable && (
                <Button size="sm" variant="ghost" aria-label={`Editar motorista ${d.name}`} onClick={() => setEditing({ ...d, phone: d.phone ?? '' })} icon={<Pencil className="h-4 w-4" />} />
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing.id ? 'Editar motorista' : 'Novo motorista'}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button variant="primary" onClick={save} loading={saving}>Salvar</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Nome" required error={errors.name}>
              {(p) => <Input {...p} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />}
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Telefone (opcional)" error={errors.phone}>
                {(p) => <Input {...p} inputMode="tel" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />}
              </Field>
              <Field label="Pets por viagem" error={errors.capacity}>
                {(p) => <Input {...p} type="number" min={1} max={10} value={editing.capacity} onChange={(e) => setEditing({ ...editing, capacity: Number(e.target.value) || 1 })} />}
              </Field>
            </div>
            <WorkHoursEditor
              value={editing.workHours}
              onChange={(workHours) => setEditing({ ...editing, workHours })}
              error={errors.workHours}
              customLabel="Horário próprio (sem marcar = toda a janela do Taxi Dog)"
            />
            <Toggle checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="Motorista ativo" />
          </div>
        </Modal>
      )}
    </Panel>
  );
}

function BlocksPanel({ overview, reload, editable }: { overview: TaxiOverview; reload: () => Promise<unknown>; editable: boolean }) {
  const toast = useToast();
  const empty = { driverId: '', dateFrom: '', dateTo: '', startTime: '', endTime: '', reason: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const driverName = (id: string | null) => (id ? (overview.drivers.find((d) => d.id === id)?.name ?? 'Motorista') : 'Todo o Taxi Dog');

  const add = async () => {
    setSaving(true);
    setErrors({});
    try {
      await adminApi.addTaxiBlock({
        driverId: form.driverId || null,
        dateFrom: form.dateFrom,
        dateTo: form.dateTo || form.dateFrom,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        reason: form.reason,
      });
      setForm(empty);
      toast('Indisponibilidade registrada.');
      await reload();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      toast(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await adminApi.removeTaxiBlock(id);
      await reload();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    }
  };

  return (
    <Panel title="Períodos sem Taxi Dog">
      {overview.blocks.length === 0 ? (
        <p className="mb-4 text-sm text-ink-500">Nenhum período bloqueado.</p>
      ) : (
        <ul className="mb-4 space-y-2 text-sm">
          {overview.blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 rounded-2xl bg-lilac-50 px-3 py-2">
              <span className="flex items-center gap-2">
                <CalendarOff className="h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <strong>{driverName(b.driverId)}</strong> • {formatDateBR(b.dateFrom)}
                  {b.dateTo !== b.dateFrom && ` a ${formatDateBR(b.dateTo)}`}
                  {b.startTime ? ` • ${b.startTime}–${b.endTime}` : ' • dia inteiro'}
                  {b.reason && ` • ${b.reason}`}
                </span>
              </span>
              {editable && <Button size="sm" variant="ghost" aria-label="Remover período" onClick={() => remove(b.id)} icon={<Trash2 className="h-4 w-4 text-danger-500" />} />}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="space-y-3">
          <Field label="Quem fica indisponível">
            {(p) => (
              <Select {...p} value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
                <option value="">Todo o Taxi Dog</option>
                {overview.drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="De" required error={errors.dateFrom}>{(p) => <Input {...p} type="date" value={form.dateFrom} onChange={(e) => setForm({ ...form, dateFrom: e.target.value })} />}</Field>
            <Field label="Até" hint="Vazio = só um dia." error={errors.dateTo}>{(p) => <Input {...p} type="date" value={form.dateTo} onChange={(e) => setForm({ ...form, dateTo: e.target.value })} />}</Field>
            <Field label="Das (opcional)">{(p) => <Input {...p} type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />}</Field>
            <Field label="Até as (opcional)" error={errors.endTime}>{(p) => <Input {...p} type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />}</Field>
          </div>
          <Field label="Motivo (interno)">{(p) => <Input {...p} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ex.: carro na revisão" />}</Field>
          <Button onClick={add} loading={saving} disabled={!form.dateFrom}>
            Adicionar período
          </Button>
        </div>
      )}
    </Panel>
  );
}
