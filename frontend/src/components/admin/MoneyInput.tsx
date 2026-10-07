import { useEffect, useState } from 'react';
import { parseMoneyInput } from '@karolla/shared';
import { cn } from '@/utils/cn';
import { inputClass } from '@/components/ui/Field';

/** Campo de valor em reais (aceita "45", "45,90", "1.234,50"). Trabalha em centavos. */
export function MoneyInput({
  value,
  onChange,
  className,
  ...aria
}: {
  value: number | null;
  onChange: (cents: number | null) => void;
  className?: string;
  id?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const toText = (v: number | null) => (v == null ? '' : (v / 100).toFixed(2).replace('.', ','));
  const [text, setText] = useState(toText(value));
  useEffect(() => {
    if (parseMoneyInput(text) !== value) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-400">R$</span>
      <input
        {...aria}
        inputMode="decimal"
        className={cn(inputClass, 'py-2.5 pl-10 text-right tabular-nums')}
        value={text}
        placeholder="—"
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d,.]/g, '');
          setText(v);
          onChange(v === '' ? null : parseMoneyInput(v));
        }}
        onBlur={() => setText(toText(parseMoneyInput(text)))}
      />
    </div>
  );
}
