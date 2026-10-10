import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppointmentInspiration, BookingResult } from '@karolla/shared';

/**
 * Rascunho do agendamento. Fica salvo no sessionStorage enquanto o cliente navega pelas
 * etapas — voltar, recarregar a página ou trocar de aba não perde o que já foi preenchido.
 */
export interface BookingDraft {
  speciesId: string | null;
  pet: {
    name: string;
    breedId: string | null;
    breedName: string;
    sizeId: string;
    weightKg: number | null;
    ageMonths: number | null;
    notes: string;
  };
  serviceId: string | null;
  addonIds: string[];
  date: string | null;
  time: string | null;
  /** Profissional escolhido (null = sem preferência). */
  professionalId: string | null;
  /** Foto escolhida no catálogo de inspirações (só a referência vai para o agendamento). */
  inspiration: AppointmentInspiration | null;
  tutor: {
    name: string;
    whatsapp: string;
    email: string;
    address: { street: string; number: string; complement: string; neighborhood: string; city: string };
    notes: string;
  };
  result: BookingResult | null;
}

export const emptyDraft = (): BookingDraft => ({
  speciesId: null,
  pet: { name: '', breedId: null, breedName: '', sizeId: '', weightKg: null, ageMonths: null, notes: '' },
  serviceId: null,
  addonIds: [],
  date: null,
  time: null,
  professionalId: null,
  inspiration: null,
  tutor: { name: '', whatsapp: '', email: '', address: { street: '', number: '', complement: '', neighborhood: '', city: '' }, notes: '' },
  result: null,
});

const STORAGE_KEY = 'karolla:booking-draft:v1';

function load(): BookingDraft {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return { ...emptyDraft(), ...(JSON.parse(raw) as Partial<BookingDraft>) };
  } catch {
    /* storage indisponível */
  }
  return emptyDraft();
}

interface BookingState {
  draft: BookingDraft;
  update: (patch: Partial<BookingDraft> | ((d: BookingDraft) => Partial<BookingDraft>)) => void;
  reset: () => void;
}

const BookingContext = createContext<BookingState | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<BookingDraft>(load);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft]);

  const update = useCallback<BookingState['update']>((patch) => {
    setDraft((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) }));
  }, []);
  const reset = useCallback(() => setDraft(emptyDraft()), []);

  const value = useMemo(() => ({ draft, update, reset }), [draft, update, reset]);
  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking(): BookingState {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking deve ser usado dentro de BookingProvider');
  return ctx;
}
