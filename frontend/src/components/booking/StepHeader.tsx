import { BOOKING_STEPS } from '@karolla/shared';
import { TOTAL_STEPS } from './steps';

export function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle?: string }) {
  const pct = Math.round((step / TOTAL_STEPS) * 100);
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between text-sm font-semibold">
        <span className="text-brand-700" aria-live="polite">
          Etapa {step} de {TOTAL_STEPS}
        </span>
        <span className="text-ink-400">{BOOKING_STEPS[step - 1]?.title}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-brand-100" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={step} aria-label="Progresso do agendamento">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-coral-400 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <h1 className="mt-6 text-2xl font-semibold outline-none focus-visible:ring-0 sm:text-3xl" tabIndex={-1} id="etapa-titulo">
        {title}
      </h1>
      {subtitle && <p className="mt-2 text-ink-500">{subtitle}</p>}
    </div>
  );
}
