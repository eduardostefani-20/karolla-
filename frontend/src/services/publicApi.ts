import type {
  AvailabilityResponse,
  BookingRequestInput,
  BookingResult,
  InstagramFeedResponse,
  PublicCatalog,
  PublicInspiration,
  PublicStory,
} from '@karolla/shared';
import { apiRequest } from './api';

export const publicApi = {
  catalog: () => apiRequest<PublicCatalog>('GET', '/public/catalog'),

  availability: (
    params: { date: string; serviceIds: string[]; addonIds: string[]; sizeId: string; speciesId?: string; professionalId?: string },
    signal?: AbortSignal,
  ) =>
    apiRequest<AvailabilityResponse>('GET', '/public/availability', {
      query: {
        date: params.date,
        serviceIds: params.serviceIds.join(','),
        addonIds: params.addonIds.join(','),
        sizeId: params.sizeId,
        speciesId: params.speciesId,
        professionalId: params.professionalId,
      },
      signal,
    }),

  inspirations: () => apiRequest<PublicInspiration[]>('GET', '/public/inspirations'),
  inspiration: (id: string) => apiRequest<PublicInspiration>('GET', `/public/inspirations/${encodeURIComponent(id)}`),
  stories: () => apiRequest<PublicStory[]>('GET', '/public/stories'),
  instagramFeed: () => apiRequest<InstagramFeedResponse>('GET', '/public/instagram-feed'),

  createAppointment: (payload: BookingRequestInput) => apiRequest<BookingResult>('POST', '/public/appointments', { body: payload }),
};
