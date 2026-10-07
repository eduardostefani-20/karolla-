import type { ReactNode } from 'react';
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@karolla/shared';
import { Badge } from '@/components/ui/Feedback';
import { cn } from '@/utils/cn';

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const STATUS_STYLES: Record<AppointmentStatus, string> = {
  pending: 'bg-sun-200 text-amber-900',
  confirmed: 'bg-brand-100 text-brand-800',
  in_progress: 'bg-violet-100 text-violet-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-ink-900/10 text-ink-600',
  no_show: 'bg-red-100 text-red-700',
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge className={STATUS_STYLES[status]}>{APPOINTMENT_STATUS_LABELS[status]}</Badge>;
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('card p-5 sm:p-6', className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, icon, tone = 'brand' }: { label: string; value: ReactNode; icon: ReactNode; tone?: 'brand' | 'coral' | 'sun' | 'ink' }) {
  const tones = {
    brand: 'bg-brand-100 text-brand-700',
    coral: 'bg-coral-100 text-coral-600',
    sun: 'bg-sun-200 text-amber-800',
    ink: 'bg-ink-900/5 text-ink-600',
  };
  return (
    <div className="card flex items-center gap-4 p-4 sm:p-5">
      <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', tones[tone])}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold uppercase tracking-wide text-ink-400">{label}</p>
        <p className="font-display text-2xl font-semibold text-ink-900">{value}</p>
      </div>
    </div>
  );
}
