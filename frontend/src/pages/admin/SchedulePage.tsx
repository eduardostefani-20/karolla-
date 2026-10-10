import { useEffect, useState } from 'react';
import { CalendarOff, Clock, Save, Trash2 } from 'lucide-react';
import { formatDateBR, nowInTimezone, WEEKDAY_LABELS, type BusinessHours } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { ApiError, friendlyMessage } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useCatalog } from '@/context/CatalogContext';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { PageHeader, Panel } from '@/components/admin/AdminUi';

type Day = Omit<BusinessHours, 'id'> & { hasBreak: boolean };

/** Vagas por horário e intervalo da agenda (atalho para as configurações mais usadas). */
function SlotsPanel({ onSaved }: { onSaved: () => void }) {
  const toast = useToast();
  const { data: settings, reload } = useAsync(() => adminApi.settings(), []);
  const [capacity, setCapacity] = useState('1');
  const [slotInterval, setSlotInterval] = useState('30');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!settings) return;
    setCapacity(String(settings.capacity));
    setSlotInterval(String(settings.slotIntervalMinutes));
  }, [settings]);
  if (!settings) return null;
  const n = Number(capacity) || 1;

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.saveSettings({ ...settings, capacity: Number(capacity), slotIntervalMinutes: Number(slotInterval) });
      toast('Vagas da agenda salvas. O site já usa a nova regra.');
      await reload();
      onSaved();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Vagas por horário">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Pets atendidos ao mesmo tempo" required hint="Com 1, quem agendar às 9:00 ocupa o horário inteiro.">
          {(p) => <Input {...p} type="number" min={1} max={50} inputMode="numeric" className="py-2.5" value={capacity} onChange={(e) => setCapacity(e.target.value)} />}
        </Field>
        <Field label="Horários de quanto em quanto tempo (min)" required hint="Ex.: 30 = 9:00, 9:30, 10:00...">
          {(p) => <Input {...p} type="number" min={5} step={5} inputMode="numeric" className="py-2.5" value={slotInterval} onChange={(e) => setSlotInterval(e.target.value)} />}
        </Field>
      </div>
      <p className="mt-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
        {n === 1
          ? 'Cada horário aceita 1 pet. Quando alguém agenda às 9:00, esse horário (e os seguintes, enquanto durar o atendimento) some para os outros clientes.'
          : `Cada horário aceita até ${n} pets ao mesmo tempo. Ao lotar, o horário some para os outros clientes.`}
      </p>
      <Button className="mt-3" variant="secondary" onClick={save} loading={saving} icon={<Save className="h-4 w-4" />}>
        Salvar vagas
      </Button>
    </Panel>
  );
}
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function SchedulePage() {
  useDocumentMeta({ title: 'Horários — Karolla Pet', noindex: true });
  const toast = useToast();
  const { reload: reloadPublic, catalog } = useCatalog();
  const { data, loading, error, reload } = useAsync(() => adminApi.schedule(), []);
  const [days, setDays] = useState<Day[]>([]);
  const [saving, setSaving] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const today = nowInTimezone(new Date(), catalog?.settings.timezone ?? 'America/Sao_Paulo').date;
  const [blockDate, setBlockDate] = useState({ date: '', reason: '' });
  const [blockTime, setBlockTime] = useState({ date: '', startTime: '12:00', endTime: '13:00', reason: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setDays(
      ORDER.map((weekday) => {
        const h = data.businessHours.find((x) => x.weekday === weekday);
        return {
          weekday,
          isOpen: h?.isOpen ?? false,
          openTime: h?.openTime ?? '08:00',
          closeTime: h?.closeTime ?? '18:00',
          breakStart: h?.breakStart ?? null,
          breakEnd: h?.breakEnd ?? null,
          hasBreak: Boolean(h?.breakStart),
        };
      }),
    );
  }, [data]);

  const setDay = (weekday: number, patch: Partial<Day>) => setDays((ds) => ds.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));

  const saveHours = async () => {
    setSaving(true);
    setHoursError(null);
    try {
      await adminApi.saveBusinessHours(
        days.map(({ hasBreak, ...d }) => ({ ...d, breakStart: hasBreak ? d.breakStart ?? '12:00' : null, breakEnd: hasBreak ? d.breakEnd ?? '13:00' : null })),
      );
      toast('Horários salvos.');
      await reload();
      void reloadPublic();
    } catch (err) {
      setHoursError(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const add = async (fn: () => Promise<unknown>, reset: () => void) => {
    setFieldErrors({});
    try {
      await fn();
      toast('Bloqueio adicionado.');
      reset();
      await reload();
      void reloadPublic();
    } catch (err) {
      if (err instanceof ApiError) setFieldErrors(err.fields);
      toast(friendlyMessage(err), 'error');
    }
  };

  const remove = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast('Bloqueio removido.');
      await reload();
      void reloadPublic();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    }
  };

  if (loading && !data) return <Spinner />;
  if (error) return <Alert tone="error">{error}</Alert>;

  return (
    <div>
      <PageHeader title="Horários" description="Funcionamento semanal, intervalo da equipe e bloqueios de datas/horários." />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Funcionamento">
          {hoursError && <Alert tone="error" className="mb-4">{hoursError}</Alert>}
          <div className="space-y-3">
            {days.map((d) => (
              <div key={d.weekday} className="rounded-2xl border border-ink-900/5 p-4" data-testid={`day-${d.weekday}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-lg font-semibold uppercase">{WEEKDAY_LABELS[d.weekday]?.split('-')[0]}</p>
                  <Toggle checked={d.isOpen} onChange={(v) => setDay(d.weekday, { isOpen: v })} label={d.isOpen ? 'Aberto' : 'Fechado'} />
                </div>
                {d.isOpen && (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-ink-400" aria-hidden />
                      <Input type="time" step={900} aria-label={`Abertura ${WEEKDAY_LABELS[d.weekday]}`} className="w-auto py-2" value={d.openTime} onChange={(e) => setDay(d.weekday, { openTime: e.target.value })} />
                      <span>—</span>
                      <Input type="time" step={900} aria-label={`Fechamento ${WEEKDAY_LABELS[d.weekday]}`} className="w-auto py-2" value={d.closeTime} onChange={(e) => setDay(d.weekday, { closeTime: e.target.value })} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <label className="flex items-center gap-2 font-semibold text-ink-600">
                        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={d.hasBreak} onChange={(e) => setDay(d.weekday, { hasBreak: e.target.checked, breakStart: d.breakStart ?? '12:00', breakEnd: d.breakEnd ?? '13:00' })} />
                        Intervalo
                      </label>
                      {d.hasBreak && (
                        <>
                          <Input type="time" step={900} aria-label="Início do intervalo" className="w-auto py-2" value={d.breakStart ?? ''} onChange={(e) => setDay(d.weekday, { breakStart: e.target.value })} />
                          <span>—</span>
                          <Input type="time" step={900} aria-label="Fim do intervalo" className="w-auto py-2" value={d.breakEnd ?? ''} onChange={(e) => setDay(d.weekday, { breakEnd: e.target.value })} />
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={saveHours} loading={saving} icon={<Save className="h-4 w-4" />}>
              Salvar horários
            </Button>
          </div>
        </Panel>

        <div className="space-y-6">
          <SlotsPanel onSaved={() => void reloadPublic()} />
          <Panel title="Bloquear data inteira">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Data" required error={fieldErrors.date}>{(p) => <Input {...p} type="date" min={today} className="py-2.5" value={blockDate.date} onChange={(e) => setBlockDate({ ...blockDate, date: e.target.value })} />}</Field>
              <Field label="Motivo">{(p) => <Input {...p} className="py-2.5" placeholder="Ex.: feriado" value={blockDate.reason} onChange={(e) => setBlockDate({ ...blockDate, reason: e.target.value })} />}</Field>
            </div>
            <Button className="mt-3" variant="outline" disabled={!blockDate.date} onClick={() => add(() => adminApi.addBlockedDate(blockDate), () => setBlockDate({ date: '', reason: '' }))}>
              Bloquear data
            </Button>
            <ul className="mt-4 space-y-2">
              {data?.blockedDates.length === 0 && <EmptyState icon={<CalendarOff className="h-8 w-8" />} title="Nenhuma data bloqueada" />}
              {data?.blockedDates.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-xl bg-cream-50 px-3 py-2 text-sm">
                  <span><strong>{formatDateBR(b.date)}</strong> {b.reason && `— ${b.reason}`}</span>
                  <Button size="sm" variant="ghost" aria-label={`Remover bloqueio de ${formatDateBR(b.date)}`} onClick={() => remove(() => adminApi.removeBlockedDate(b.id))} icon={<Trash2 className="h-4 w-4 text-red-500" />} />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Bloquear horário">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Data" required error={fieldErrors.date}>{(p) => <Input {...p} type="date" min={today} className="py-2.5" value={blockTime.date} onChange={(e) => setBlockTime({ ...blockTime, date: e.target.value })} />}</Field>
              <Field label="Início" required>{(p) => <Input {...p} type="time" step={900} className="py-2.5" value={blockTime.startTime} onChange={(e) => setBlockTime({ ...blockTime, startTime: e.target.value })} />}</Field>
              <Field label="Fim" required error={fieldErrors.endTime}>{(p) => <Input {...p} type="time" step={900} className="py-2.5" value={blockTime.endTime} onChange={(e) => setBlockTime({ ...blockTime, endTime: e.target.value })} />}</Field>
            </div>
            <Field label="Motivo" className="mt-3">{(p) => <Input {...p} className="py-2.5" value={blockTime.reason} onChange={(e) => setBlockTime({ ...blockTime, reason: e.target.value })} />}</Field>
            <Button className="mt-3" variant="outline" disabled={!blockTime.date} onClick={() => add(() => adminApi.addBlockedTime(blockTime), () => setBlockTime({ date: '', startTime: '12:00', endTime: '13:00', reason: '' }))}>
              Bloquear horário
            </Button>
            <ul className="mt-4 space-y-2">
              {data?.blockedTimes.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-xl bg-cream-50 px-3 py-2 text-sm">
                  <span><strong>{formatDateBR(b.date)}</strong> {b.startTime}–{b.endTime} {b.reason && `— ${b.reason}`}</span>
                  <Button size="sm" variant="ghost" aria-label="Remover bloqueio" onClick={() => remove(() => adminApi.removeBlockedTime(b.id))} icon={<Trash2 className="h-4 w-4 text-red-500" />} />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
