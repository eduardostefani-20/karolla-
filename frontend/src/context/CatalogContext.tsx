import { createContext, useContext, type ReactNode } from 'react';
import type { PublicCatalog } from '@karolla/shared';
import { publicApi } from '@/services/publicApi';
import { useAsync } from '@/hooks/useAsync';

interface CatalogState {
  catalog: PublicCatalog | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<PublicCatalog | null>;
}

const CatalogContext = createContext<CatalogState | null>(null);

/** Catálogo público (serviços, preços, raças, formulário) vindo da API — nada fixo no código. */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, reload } = useAsync(() => publicApi.catalog(), []);
  return <CatalogContext.Provider value={{ catalog: data, loading, error, reload }}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogState {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog deve ser usado dentro de CatalogProvider');
  return ctx;
}
