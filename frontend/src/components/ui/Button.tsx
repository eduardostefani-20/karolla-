import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'accent' | 'secondary' | 'outline' | 'onDark' | 'ghost' | 'danger' | 'whatsapp';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-pill font-bold transition-all duration-150 active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 select-none';

/** "Pulo" no hover (desligado automaticamente com prefers-reduced-motion). */
const lift = 'hover:-translate-y-0.5';

const variants: Record<Variant, string> = {
  // roxo da marca, texto branco (9:1)
  primary: `bg-primary text-white shadow-soft hover:bg-primary-dark ${lift}`,
  // destaque/promoção: amarelo-ouro com texto roxo profundo (7.9:1) — nunca texto branco
  accent: `bg-accent font-extrabold text-primary-dark shadow-soft hover:bg-sun-300 ${lift}`,
  // contorno roxo, fundo transparente
  secondary: `border-2 border-primary bg-transparent text-primary hover:bg-brand-50 ${lift}`,
  outline: `border-2 border-primary bg-transparent text-primary hover:bg-brand-50 ${lift}`,
  // contorno branco para fundos roxos (hero, faixas)
  onDark: `border-2 border-white/80 bg-transparent text-white hover:bg-white/10 ${lift}`,
  ghost: 'text-ink-600 hover:bg-ink-900/5',
  danger: 'bg-danger-600 text-white hover:bg-danger-700',
  whatsapp: `bg-whatsapp text-white shadow-soft hover:bg-whatsapp-dark ${lift}`,
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-14 px-7 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], block && 'w-full', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  block,
  className,
  icon,
  children,
  ...props
}: LinkProps & { variant?: Variant; size?: Size; block?: boolean; icon?: ReactNode }) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], block && 'w-full', className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}

export function ExternalButton({
  href,
  variant = 'primary',
  size = 'md',
  block,
  className,
  icon,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  className?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn(base, variants[variant], sizes[size], block && 'w-full', className)}>
      {icon}
      {children}
    </a>
  );
}
