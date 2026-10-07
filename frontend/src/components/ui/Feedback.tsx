import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

export function Spinner({ label = 'Carregando...', className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn('flex items-center justify-center gap-3 py-10 text-ink-500', className)}>
      <Loader2 className="h-6 w-6 animate-spin text-brand-500" aria-hidden />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

const tones = {
  info: { box: 'bg-brand-50 text-brand-900 border-brand-200', icon: Info },
  success: { box: 'bg-emerald-50 text-emerald-900 border-emerald-200', icon: CheckCircle2 },
  warning: { box: 'bg-sun-100 text-amber-900 border-sun-300', icon: AlertTriangle },
  error: { box: 'bg-red-50 text-red-900 border-red-200', icon: XCircle },
};

export function Alert({ tone = 'info', title, children, action, className }: { tone?: keyof typeof tones; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const { box, icon: Icon } = tones[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-2xl border p-4 text-sm', box, className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-ink-900/10 px-6 py-12 text-center">
      {icon && <div className="text-brand-400">{icon}</div>}
      <p className="font-display text-lg text-ink-800">{title}</p>
      {children && <div className="max-w-sm text-sm text-ink-500">{children}</div>}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', className)}>{children}</span>;
}
