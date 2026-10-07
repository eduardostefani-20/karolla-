import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';

/** Cartão selecionável grande (ótimo para toque) — radio ou checkbox. */
export function OptionCard({
  selected,
  onClick,
  disabled,
  children,
  multi,
  className,
  testId,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  multi?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'relative w-full rounded-3xl border-2 bg-white p-5 text-left transition-all hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-ink-900/10',
        selected ? 'border-brand-500 bg-brand-50/60 shadow-soft ring-4 ring-brand-500/10' : 'border-ink-900/10',
        className,
      )}
    >
      <span
        className={cn(
          'absolute right-4 top-4 grid h-6 w-6 place-items-center border-2 transition-colors',
          multi ? 'rounded-lg' : 'rounded-full',
          selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-900/20 bg-white',
        )}
        aria-hidden
      >
        {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      {children}
    </button>
  );
}
