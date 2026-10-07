import type { AvailabilityResponse, BookingRequestInput, BookingResult, PublicCatalog } from '@karolla/shared';
import { apiRequest } from './api';

export const publicApi = {
  catalog: () => apiRequest<PublicCatalog>('GET', '/public/catalog'),

  availability: (params: { date: string; serviceIds: string[]; addonIds: string[]; sizeId: string; speciesId?: string }, signal?: AbortSignal) =>
    apiRequest<AvailabilityResponse>('GET', '/public/availability', {
      query: {
        date: params.date,
        serviceIds: params.serviceIds.join(','),
        addonIds: params.addonIds.join(','),
        sizeId: params.sizeId,
        speciesId: params.speciesId,
      },
      signal,
    }),

  createAppointment: (payload: BookingRequestInput) => apiRequest<BookingResult>('POST', '/public/appointments', { body: payload }),
};
