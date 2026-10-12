import type {
  CustomerAccount,
  CustomerSession,
  PortalAppointment,
  PublicComment,
  PortalCustomerPlan,
  PortalCustomer,
  PortalPet,
  SignUpResponse,
  UploadTicket,
} from '@karolla/shared';
import { apiRequest } from './api';

const auth = { auth: 'customer' } as const;
type Body = Record<string, unknown>;

/** Portal do cliente ("Minha conta"). O servidor só devolve dados do próprio cadastro. */
export const accountApi = {
  signUp: (body: Body) => apiRequest<SignUpResponse>('POST', '/account/signup', { body }),
  login: (email: string, password: string) => apiRequest<CustomerSession>('POST', '/account/login', { body: { email, password } }),
  refresh: (refreshToken: string) => apiRequest<CustomerSession>('POST', '/account/refresh', { body: { refreshToken } }),
  logout: () => apiRequest<void>('POST', '/account/logout', auth),
  forgotPassword: (email: string) => apiRequest<void>('POST', '/auth/forgot-password', { body: { email } }),

  me: () => apiRequest<CustomerAccount>('GET', '/account/me', auth),
  updateProfile: (body: Body) => apiRequest<PortalCustomer>('PATCH', '/account/me', { ...auth, body }),
  changeEmail: (email: string) => apiRequest<void>('POST', '/account/me/email', { ...auth, body: { email } }),

  pets: () => apiRequest<PortalPet[]>('GET', '/account/me/pets', auth),
  pet: (id: string) => apiRequest<PortalPet>('GET', `/account/me/pets/${id}`, auth),
  createPet: (body: Body) => apiRequest<PortalPet>('POST', '/account/me/pets', { ...auth, body }),
  updatePet: (id: string, body: Body) => apiRequest<PortalPet>('PATCH', `/account/me/pets/${id}`, { ...auth, body }),
  uploadTicket: (petId: string, body: { kind: 'pet-photo' | 'pet-reference'; contentType: string; size: number }) =>
    apiRequest<UploadTicket>('POST', `/account/me/pets/${petId}/upload-ticket`, { ...auth, body }),
  setPhoto: (petId: string, path: string) => apiRequest<PortalPet>('PUT', `/account/me/pets/${petId}/photo`, { ...auth, body: { path } }),
  addReference: (petId: string, body: { path: string; description: string; appointmentId?: string | null }) =>
    apiRequest<PortalPet>('POST', `/account/me/pets/${petId}/references`, { ...auth, body }),
  removeReference: (id: string) => apiRequest<void>('DELETE', `/account/me/references/${id}`, auth),

  appointments: () => apiRequest<PortalAppointment[]>('GET', '/account/me/appointments', auth),
  addComment: (inspirationId: string, body: string) => apiRequest<PublicComment>('POST', `/account/me/inspirations/${inspirationId}/comments`, { ...auth, body: { body } }),
  plans: () => apiRequest<PortalCustomerPlan[]>('GET', '/account/me/plans', auth),
};
