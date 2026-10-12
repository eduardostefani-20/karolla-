import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { formatCents, formatPhone, TAXI_DIRECTION_LABELS, TAXI_STATUS_LABELS, TAXI_STATUSES, type TaxiDriver, type TaxiStatus, type TaxiTransportDetail } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { friendlyMessage } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';

export const TAXI_STATUS_BADGE: Record<TaxiStatus, string> = {
  requested: 'bg-sun-100 text-ink-800',
  confirmed: 'bg-brand-50 text-brand-800',
  on_the_way: 'bg-lilac-50 text-ink-800',
  picked_up: 'bg-lilac-50 text-ink-800',
  at_shop: 'bg-brand-50 text-brand-800',
  out_for_delivery: 'bg-lilac-50 text-ink-800',
  delivered: 'bg-leaf-50 text-leaf-800',
  cancelled: 'bg-ink-900/10 text-ink-600',
};

/** Um transporte do Taxi Dog: motorista e status próprios (o servidor recusa motorista indisponível). */
export function TransportCard({ transport: t, drivers, onSaved, compact }: { transport: TaxiTransportDetail; drivers: TaxiDriver[]; onSaved: () => void; compact?: boolean }) {
  const toast = useToast();
  const { can } = useAuth();
  const [driverId, setDriverId] = useState(t.driverId ?? '');
  const [status, setStatus] = useState<TaxiStatus>(t.status);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setDriverId(t.driverId ?? '');
    setStatus(t.status);
  }, [t.driverId, t.status]);
  const dirty = driverId !== (t.driverId ?? '') || status !== t.status;
  const editable = can('taxidog.edit');
  // Motoristas inativos só aparecem se já estiverem neste transporte.
  const options = drivers.filter((d) => d.active || d.id === t.driverId);

  const save = async () => {
    setSaving(true);
    try {
      // Escolher motorista num pedido "Solicitado" já confirma o transporte (o servidor confere a disponibilidade).
      const nextStatus = status === 'requested' && driverId && !t.driverId ? 'confirmed' : status;
      await adminApi.updateTaxiTransport(t.id, { driverId: driverId || null, status: nextStatus });
      toast(nextStatus === 'confirmed' && t.status === 'requested' ? 'Transporte confirmado.' : 'Transporte atualizado.');
      onSaved();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className={cn('list-none', compact ? '' : 'card p-4')} data-testid="taxi-transport">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-lg font-semibold">
            {t.pickupTime && <>Buscar {t.pickupTime}</>}
            {t.pickupTime && t.dropoffTime && ' • '}
            {t.dropoffTime && <>Levar ~{t.dropoffTime}</>}
          </p>
          {!compact && (
            <p className="text-sm text-ink-600">
              <Link to={`/admin/agendamentos/${t.appointmentId}`} className="font-bold hover:underline">
                {t.petName}
              </Link>{' '}
              • {t.customerName}
              {t.customerWhatsapp && ` • ${formatPhone(t.customerWhatsapp)}`} • atendimento {t.appointmentTime}
            </p>
          )}
          <p className="mt-1 flex items-start gap-1 text-sm text-ink-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {t.address || 'Endereço não informado'}
              {t.regionName && ` • ${t.regionName}`}
            </span>
          </p>
          <p className="text-sm text-ink-500">
            {TAXI_DIRECTION_LABELS[t.direction]}
            {typeof t.feeCents === 'number' && ` • taxa ${formatCents(t.feeCents)}`}
            {t.notes && ` • ${t.notes}`}
          </p>
        </div>
        <Badge className={TAXI_STATUS_BADGE[t.status]}>{TAXI_STATUS_LABELS[t.status]}</Badge>
      </div>
      {editable ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-ink-700">Motorista</span>
            <Select className="w-auto py-2" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              <option value="">Sem motorista</option>
              {options.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.capacity > 1 ? ` (até ${d.capacity} pets)` : ''}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-ink-700">Status do transporte</span>
            <Select className="w-auto py-2" value={status} onChange={(e) => setStatus(e.target.value as TaxiStatus)}>
              {TAXI_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TAXI_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </label>
          <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>
            Salvar
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink-600">Motorista: {t.driverName ?? 'ainda não definido'}</p>
      )}
    </li>
  );
}
