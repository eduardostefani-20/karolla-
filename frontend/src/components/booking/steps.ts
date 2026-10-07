import { BOOKING_STEPS } from '@karolla/shared';
import type { BookingDraft } from '@/context/BookingContext';

export const TOTAL_STEPS = BOOKING_STEPS.length; // 9

/** Primeira etapa que ainda falta preencher — impede pular etapas pela URL. */
export function firstIncompleteStep(d: BookingDraft): number {
  if (!d.speciesId) return 1;
  if (!d.pet.name || !d.pet.sizeId || !d.pet.breedName) return 2;
  if (!d.serviceId) return 3;
  // etapa 4 (adicionais) é opcional
  if (!d.date) return 5;
  if (!d.time) return 6;
  if (!d.tutor.name || !d.tutor.whatsapp) return 7;
  return 8;
}
