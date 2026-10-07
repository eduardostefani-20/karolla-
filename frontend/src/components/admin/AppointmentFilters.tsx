import { Search } from 'lucide-react';
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABELS, type AppointmentStatus, type Service } from '@karolla/shared';
import { Input, Select } from '@/components/ui/Field';

export interface FilterState {
  status: AppointmentStatus | '';
  serviceId: string;
  search: string;
}

export function AppointmentFilters({ value, onChange, services }: { value: FilterState; onChange: (v: FilterState) => void; services: Service[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="relative block">
        <span className="sr-only">Buscar pet ou cliente</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
        <Input className="py-2.5 pl-10" placeholder="Pet, cliente ou WhatsApp" value={value.search} onChange={(e) => onChange({ ...value, search: e.target.value })} />
      </label>
      <label className="block">
        <span className="sr-only">Status</span>
        <Select className="py-2.5" value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value as FilterState['status'] })}>
          <option value="">Todos os status</option>
          {APPOINTMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {APPOINTMENT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </label>
      <label className="block">
        <span className="sr-only">Serviço</span>
        <Select className="py-2.5" value={value.serviceId} onChange={(e) => onChange({ ...value, serviceId: e.target.value })}>
          <option value="">Todos os serviços</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.active ? '' : ' (inativo)'}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
