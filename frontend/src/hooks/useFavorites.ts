import { useCallback, useEffect, useState } from 'react';

const KEY = 'karolla:inspiracoes-favoritas';

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Favoritos do visitante, salvos só neste aparelho (sem login). */
export function useFavorites() {
  const [ids, setIds] = useState<string[]>(read);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === KEY && setIds(read());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const toggle = useCallback((id: string) => {
    setIds((current) => {
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* armazenamento indisponível: favorito vale só nesta visita */
      }
      return next;
    });
  }, []);
  return { ids, isFavorite: (id: string) => ids.includes(id), toggle };
}
