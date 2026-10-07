import { useId, useMemo, useRef, useState } from 'react';
import { Check, PenLine, Search } from 'lucide-react';
import type { Breed } from '@karolla/shared';
import { cn } from '@/utils/cn';
import { inputClass } from '@/components/ui/Field';

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const OTHER_BREED = '__other__';

/**
 * Lista de raças pesquisável (padrão ARIA combobox) com a opção "Outra raça".
 * Teclado: ↑/↓ navega, Enter seleciona, Esc fecha.
 */
export function BreedCombobox({
  breeds,
  value,
  onSelect,
  invalid,
  describedBy,
  inputId,
}: {
  breeds: Breed[];
  value: { breedId: string | null; breedName: string; isOther: boolean };
  onSelect: (breed: Breed | typeof OTHER_BREED) => void;
  invalid?: boolean;
  describedBy?: string;
  inputId: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState(value.isOther ? '' : value.breedName);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => {
    const q = normalize(query);
    const list = q && q !== normalize(value.breedName) ? breeds.filter((b) => normalize(b.name).includes(q)) : breeds;
    return [...list.slice(0, 50), OTHER_BREED] as (Breed | typeof OTHER_BREED)[];
  }, [breeds, query, value.breedName]);

  const choose = (opt: Breed | typeof OTHER_BREED) => {
    onSelect(opt);
    setQuery(opt === OTHER_BREED ? '' : opt.name);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      const opt = options[active];
      if (opt) choose(opt);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" aria-hidden />
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder={value.isOther ? 'Outra raça selecionada' : 'Digite a raça...'}
        className={cn(inputClass, 'pl-12')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul id={listId} role="listbox" className="scroll-thin absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-ink-900/10 bg-white p-1.5 shadow-soft">
          {options.map((opt, i) => {
            const isOther = opt === OTHER_BREED;
            const selected = isOther ? value.isOther : value.breedId === opt.id;
            return (
              <li
                key={isOther ? OTHER_BREED : opt.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(opt)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[15px]',
                  i === active && 'bg-brand-50',
                  isOther && 'mt-1 border-t border-ink-900/5 font-semibold text-coral-600',
                )}
              >
                <span className="flex items-center gap-2">
                  {isOther ? <PenLine className="h-4 w-4" aria-hidden /> : <Search className="h-4 w-4 text-ink-300" aria-hidden />}
                  {isOther ? 'Outra raça (digitar)' : opt.name}
                </span>
                {selected && <Check className="h-4 w-4 text-brand-600" aria-hidden />}
              </li>
            );
          })}
          {options.length === 1 && <li className="px-3 py-2 text-sm text-ink-500">Nenhuma raça encontrada. Use "Outra raça".</li>}
        </ul>
      )}
    </div>
  );
}
