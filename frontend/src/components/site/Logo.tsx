import { cn } from '@/utils/cn';

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 64 64" className="h-10 w-10 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="18" fill={light ? '#fff7ee' : '#1b7a75'} />
        <g fill={light ? '#1b7a75' : '#fff7ee'}>
          <ellipse cx="32" cy="40" rx="12" ry="10" />
          <ellipse cx="18" cy="27" rx="5" ry="6.5" />
          <ellipse cx="46" cy="27" rx="5" ry="6.5" />
          <ellipse cx="25.5" cy="17.5" rx="4.5" ry="6" />
          <ellipse cx="38.5" cy="17.5" rx="4.5" ry="6" />
        </g>
        <circle cx="49" cy="49" r="6" fill="#ff7d57" />
      </svg>
      <span className={cn('font-display text-2xl font-semibold leading-none tracking-tight', light ? 'text-white' : 'text-brand-800')}>
        Karolla <span className="text-coral-500">Pet</span>
      </span>
    </span>
  );
}
