import type {
  AdminCatalog,
  Addon,
  AppointmentDetail,
  AppointmentListQuery,
  AppointmentStatus,
  AppointmentUpdateInput,
  AuthSession,
  BlockedDate,
  BlockedTime,
  Breed,
  BusinessHours,
  BusinessSettings,
  Customer,
  CustomerDetail,
  CustomerSummary,
  DashboardData,
  FormFieldConfig,
  Pet,
  PetDetail,
  PetSize,
  Service,
  ServicePrice,
  Species,
  SystemStatus,
} from '@karolla/shared';
import { apiRequest } from './api';

const auth = { auth: true } as const;

type Body = Record<string, unknown>;

export const authApi = {
  login: (email: string, password: string) => apiRequest<AuthSession>('POST', '/auth/login', { body: { email, password } }),
  me: () => apiRequest<{ user: AuthSession['user'] }>('GET', '/auth/me', auth),
  logout: () => apiRequest<void>('POST', '/auth/logout', auth),
};

export const adminApi = {
  dashboard: () => apiRequest<DashboardData>('GET', '/admin/dashboard', auth),
  systemStatus: () => apiRequest<SystemStatus>('GET', '/admin/system-status', auth),

  appointments: (query: AppointmentListQuery = {}) =>
    apiRequest<AppointmentDetail[]>('GET', '/admin/appointments', { ...auth, query: query as Record<string, string | undefined> }),
  appointment: (id: string) => apiRequest<AppointmentDetail>('GET', `/admin/appointments/${id}`, auth),
  updateAppointment: (id: string, body: AppointmentUpdateInput) =>
    apiRequest<AppointmentDetail>('PATCH', `/admin/appointments/${id}`, { ...auth, body }),
  updateStatus: (id: string, status: AppointmentStatus) =>
    apiRequest<AppointmentDetail>('PATCH', `/admin/appointments/${id}/status`, { ...auth, body: { status } }),
  resendNotifications: (id: string) => apiRequest<AppointmentDetail>('POST', `/admin/appointments/${id}/resend-notifications`, auth),

  customers: (search?: string) => apiRequest<CustomerSummary[]>('GET', '/admin/customers', { ...auth, query: { search } }),
  customer: (id: string) => apiRequest<CustomerDetail>('GET', `/admin/customers/${id}`, auth),
  updateCustomer: (id: string, body: Partial<Customer>) => apiRequest<CustomerDetail>('PATCH', `/admin/customers/${id}`, { ...auth, body }),
  pets: (search?: string) => apiRequest<(Pet & { customerName: string })[]>('GET', '/admin/pets', { ...auth, query: { search } }),
  pet: (id: string) => apiRequest<PetDetail>('GET', `/admin/pets/${id}`, auth),
  updatePet: (id: string, body: Partial<Pet>) => apiRequest<PetDetail>('PATCH', `/admin/pets/${id}`, { ...auth, body }),

  catalog: () => apiRequest<AdminCatalog>('GET', '/admin/catalog', auth),
  createService: (body: Body) => apiRequest<Service>('POST', '/admin/services', { ...auth, body }),
  updateService: (id: string, body: Body) => apiRequest<Service>('PATCH', `/admin/services/${id}`, { ...auth, body }),
  deleteService: (id: string) => apiRequest<void>('DELETE', `/admin/services/${id}`, auth),
  reorder: (entity: 'services' | 'addons' | 'sizes', ids: string[]) => apiRequest<unknown>('POST', `/admin/${entity}/reorder`, { ...auth, body: { ids } }),
  savePrices: (prices: { serviceId: string; sizeId: string; priceCents: number | null; durationMinutes: number | null }[]) =>
    apiRequest<ServicePrice[]>('PUT', '/admin/prices', { ...auth, body: { prices } }),
  createAddon: (body: Body) => apiRequest<Addon>('POST', '/admin/addons', { ...auth, body }),
  updateAddon: (id: string, body: Body) => apiRequest<Addon>('PATCH', `/admin/addons/${id}`, { ...auth, body }),
  deleteAddon: (id: string) => apiRequest<void>('DELETE', `/admin/addons/${id}`, auth),
  createSpecies: (body: Body) => apiRequest<Species>('POST', '/admin/species', { ...auth, body }),
  updateSpecies: (id: string, body: Body) => apiRequest<Species>('PATCH', `/admin/species/${id}`, { ...auth, body }),
  deleteSpecies: (id: string) => apiRequest<void>('DELETE', `/admin/species/${id}`, auth),
  createBreed: (body: Body) => apiRequest<Breed>('POST', '/admin/breeds', { ...auth, body }),
  updateBreed: (id: string, body: Body) => apiRequest<Breed>('PATCH', `/admin/breeds/${id}`, { ...auth, body }),
  deleteBreed: (id: string) => apiRequest<void>('DELETE', `/admin/breeds/${id}`, auth),
  createSize: (body: Body) => apiRequest<PetSize>('POST', '/admin/sizes', { ...auth, body }),
  updateSize: (id: string, body: Body) => apiRequest<PetSize>('PATCH', `/admin/sizes/${id}`, { ...auth, body }),
  deleteSize: (id: string) => apiRequest<void>('DELETE', `/admin/sizes/${id}`, auth),
  saveFormFields: (fields: FormFieldConfig[]) => apiRequest<FormFieldConfig[]>('PUT', '/admin/form-fields', { ...auth, body: { fields } }),

  schedule: () => apiRequest<{ businessHours: BusinessHours[]; blockedDates: BlockedDate[]; blockedTimes: BlockedTime[] }>('GET', '/admin/schedule', auth),
  saveBusinessHours: (days: Omit<BusinessHours, 'id'>[]) => apiRequest<BusinessHours[]>('PUT', '/admin/business-hours', { ...auth, body: { days } }),
  addBlockedDate: (body: { date: string; reason: string }) => apiRequest<BlockedDate>('POST', '/admin/blocked-dates', { ...auth, body }),
  removeBlockedDate: (id: string) => apiRequest<void>('DELETE', `/admin/blocked-dates/${id}`, auth),
  addBlockedTime: (body: { date: string; startTime: string; endTime: string; reason: string }) =>
    apiRequest<BlockedTime>('POST', '/admin/blocked-times', { ...auth, body }),
  removeBlockedTime: (id: string) => apiRequest<void>('DELETE', `/admin/blocked-times/${id}`, auth),
  settings: () => apiRequest<BusinessSettings>('GET', '/admin/settings', auth),
  saveSettings: (body: BusinessSettings) => apiRequest<BusinessSettings>('PUT', '/admin/settings', { ...auth, body }),
};
