import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { AdminCatalog } from '@karolla/shared';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { ManualAppointmentModal } from './ManualAppointmentModal';

/** Botão "Novo agendamento" (só para quem pode criar agendamentos). */
export function NewAppointmentButton({ catalog, defaultDate }: { catalog: AdminCatalog | null; defaultDate: string }) {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  if (!can('agenda.create')) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!catalog} icon={<Plus className="h-4 w-4" aria-hidden />}>
        Novo agendamento
      </Button>
      {open && catalog && <ManualAppointmentModal catalog={catalog} defaultDate={defaultDate} onClose={() => setOpen(false)} />}
    </>
  );
}
