import { FlaskConical } from 'lucide-react';
import { useCatalog } from '@/context/CatalogContext';

/** Deixa explícito quando o sistema roda com dados fictícios (modo DEMO). */
export function DemoBanner() {
  const { catalog } = useCatalog();
  if (catalog?.mode !== 'demo') return null;
  return (
    <div className="bg-sun-200 px-4 py-2 text-center text-xs font-semibold text-amber-950">
      <FlaskConical className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
      MODO DEMONSTRAÇÃO — preços, horários e clientes são fictícios. Nenhum agendamento real é criado.
    </div>
  );
}
