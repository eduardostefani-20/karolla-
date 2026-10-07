import { ArrowDown, ArrowUp } from 'lucide-react';

/** Alterar ordem com botões (acessível por teclado e toque, sem arrastar). */
export function ReorderButtons({ index, total, onMove, label }: { index: number; total: number; onMove: (from: number, to: number) => void; label: string }) {
  return (
    <div className="flex flex-col">
      <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} className="rounded-lg p-1 text-ink-400 hover:bg-ink-900/5 hover:text-ink-700 disabled:opacity-20" aria-label={`Mover ${label} para cima`}>
        <ArrowUp className="h-4 w-4" />
      </button>
      <button type="button" disabled={index === total - 1} onClick={() => onMove(index, index + 1)} className="rounded-lg p-1 text-ink-400 hover:bg-ink-900/5 hover:text-ink-700 disabled:opacity-20" aria-label={`Mover ${label} para baixo`}>
        <ArrowDown className="h-4 w-4" />
      </button>
    </div>
  );
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item as T);
  return copy;
}
