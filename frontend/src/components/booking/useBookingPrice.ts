import { useMemo } from 'react';
import { calculateAppointmentPrice, PricingError, type PriceBreakdown } from '@karolla/shared';
import { useCatalog } from '@/context/CatalogContext';
import { useBooking } from '@/context/BookingContext';

/** Preço em tempo real — usa o MESMO motor (calculateAppointmentPrice) que o back-end. */
export function useBookingPrice(): { price: PriceBreakdown | null; error: string | null } {
  const { catalog } = useCatalog();
  const { draft } = useBooking();
  return useMemo(() => {
    if (!catalog || !draft.serviceId || !draft.pet.sizeId) return { price: null, error: null };
    try {
      const price = calculateAppointmentPrice(
        { serviceIds: [draft.serviceId], sizeId: draft.pet.sizeId, addonIds: draft.addonIds, speciesId: draft.speciesId ?? undefined },
        catalog,
      );
      return { price, error: null };
    } catch (err) {
      return { price: null, error: err instanceof PricingError ? err.message : 'Não foi possível calcular o valor.' };
    }
  }, [catalog, draft.serviceId, draft.pet.sizeId, draft.addonIds, draft.speciesId]);
}
