import type {
  AdminCatalog,
  AdminComment,
  TaxiBlock,
  TaxiDriver,
  TaxiOverview,
  TaxiRegion,
  TaxiTransportDetail,
  Addon,
  AppointmentDetail,
  AppointmentListQuery,
  AppointmentStatus,
  AppointmentUpdateInput,
  AuditLog,
  ContactLog,
  ContactResult,
  CustomerPlanDetail,
  Plan,
  PlanUsage,
  ProfessionalTimeOff,
  CrmResponse,
  AuthSession,
  StaffMember,
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
  Inspiration,
  Professional,
  Story,
  UploadTicket,
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
  refresh: (refreshToken: string) => apiRequest<AuthSession>('POST', '/auth/refresh', { body: { refreshToken } }),
  forgotPassword: (email: string) => apiRequest<void>('POST', '/auth/forgot-password', { body: { email } }),
  resetPassword: (token: string, password: string) => apiRequest<void>('POST', '/auth/reset-password', { body: { token, password } }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<void>('POST', '/auth/change-password', { ...auth, body: { currentPassword, newPassword } }),
};

export const teamApi = {
  list: () => apiRequest<StaffMember[]>('GET', '/admin/team', auth),
  create: (body: Body) => apiRequest<StaffMember>('POST', '/admin/team', { ...auth, body }),
  update: (id: string, body: Body) => apiRequest<StaffMember>('PATCH', `/admin/team/${id}`, { ...auth, body }),
  setPassword: (id: string, password: string) => apiRequest<void>('PUT', `/admin/team/${id}/password`, { ...auth, body: { password } }),
  sendReset: (id: string) => apiRequest<void>('POST', `/admin/team/${id}/send-reset`, auth),
  audit: (query: { actorId?: string; entity?: string } = {}) => apiRequest<AuditLog[]>('GET', '/admin/audit', { ...auth, query }),
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
  reorder: (entity: 'services' | 'addons' | 'sizes' | 'professionals', ids: string[]) => apiRequest<unknown>('POST', `/admin/${entity}/reorder`, { ...auth, body: { ids } }),
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

  createProfessional: (body: Body) => apiRequest<Professional>('POST', '/admin/professionals', { ...auth, body }),
  updateProfessional: (id: string, body: Body) => apiRequest<Professional>('PATCH', `/admin/professionals/${id}`, { ...auth, body }),
  deleteProfessional: (id: string) => apiRequest<void>('DELETE', `/admin/professionals/${id}`, auth),

  uploadTicket: (body: { kind: 'inspiration' | 'story'; contentType: string; size: number }) =>
    apiRequest<UploadTicket>('POST', '/admin/media/upload-ticket', { ...auth, body }),
  inspirations: () => apiRequest<Inspiration[]>('GET', '/admin/inspirations', auth),
  createInspiration: (body: Body) => apiRequest<Inspiration>('POST', '/admin/inspirations', { ...auth, body }),
  updateInspiration: (id: string, body: Body) => apiRequest<Inspiration>('PATCH', `/admin/inspirations/${id}`, { ...auth, body }),
  deleteInspiration: (id: string) => apiRequest<void>('DELETE', `/admin/inspirations/${id}`, auth),
  stories: () => apiRequest<Story[]>('GET', '/admin/stories', auth),
  createStory: (body: Body) => apiRequest<Story>('POST', '/admin/stories', { ...auth, body }),
  deleteStory: (id: string) => apiRequest<void>('DELETE', `/admin/stories/${id}`, auth),

  schedule: () =>
    apiRequest<{ businessHours: BusinessHours[]; blockedDates: BlockedDate[]; blockedTimes: BlockedTime[]; professionalTimeOff: ProfessionalTimeOff[] }>('GET', '/admin/schedule', auth),
  saveBusinessHours: (days: Omit<BusinessHours, 'id'>[]) => apiRequest<BusinessHours[]>('PUT', '/admin/business-hours', { ...auth, body: { days } }),
  addBlockedDate: (body: { date: string; reason: string }) => apiRequest<BlockedDate>('POST', '/admin/blocked-dates', { ...auth, body }),
  removeBlockedDate: (id: string) => apiRequest<void>('DELETE', `/admin/blocked-dates/${id}`, auth),
  addBlockedTime: (body: { date: string; startTime: string; endTime: string; reason: string }) =>
    apiRequest<BlockedTime>('POST', '/admin/blocked-times', { ...auth, body }),
  removeBlockedTime: (id: string) => apiRequest<void>('DELETE', `/admin/blocked-times/${id}`, auth),
  settings: () => apiRequest<BusinessSettings>('GET', '/admin/settings', auth),
  saveSettings: (body: BusinessSettings) => apiRequest<BusinessSettings>('PUT', '/admin/settings', { ...auth, body }),

  createAppointment: (body: Body) => apiRequest<AppointmentDetail>('POST', '/admin/appointments', { ...auth, body }),
  notifyPickup: (id: string) => apiRequest<ContactResult>('POST', `/admin/appointments/${id}/notify-pickup`, auth),
  addTimeOff: (body: Body) => apiRequest<ProfessionalTimeOff>('POST', '/admin/professional-time-off', { ...auth, body }),
  removeTimeOff: (id: string) => apiRequest<void>('DELETE', `/admin/professional-time-off/${id}`, auth),

  plans: () => apiRequest<Plan[]>('GET', '/admin/plans', auth),
  createPlan: (body: Body) => apiRequest<Plan>('POST', '/admin/plans', { ...auth, body }),
  updatePlan: (id: string, body: Body) => apiRequest<Plan>('PATCH', `/admin/plans/${id}`, { ...auth, body }),
  deletePlan: (id: string) => apiRequest<void>('DELETE', `/admin/plans/${id}`, auth),
  customerPlans: (query: { customerId?: string; status?: string } = {}) => apiRequest<CustomerPlanDetail[]>('GET', '/admin/customer-plans', { ...auth, query }),
  customerPlan: (id: string) => apiRequest<CustomerPlanDetail>('GET', `/admin/customer-plans/${id}`, auth),
  subscribe: (body: Body) => apiRequest<CustomerPlanDetail>('POST', '/admin/customer-plans', { ...auth, body }),
  updateSubscription: (id: string, body: Body) => apiRequest<CustomerPlanDetail>('PATCH', `/admin/customer-plans/${id}`, { ...auth, body }),
  recordPayment: (id: string, body: Body) => apiRequest<CustomerPlanDetail>('POST', `/admin/customer-plans/${id}/payments`, { ...auth, body }),
  appointmentPlans: (id: string) => apiRequest<{ plans: CustomerPlanDetail[]; usages: PlanUsage[] }>('GET', `/admin/appointments/${id}/plans`, auth),
  usePlan: (id: string, body: { customerPlanId: string; serviceId: string }) =>
    apiRequest<{ plans: CustomerPlanDetail[]; usages: PlanUsage[] }>('POST', `/admin/appointments/${id}/plan-usages`, { ...auth, body }),
  revertPlanUsage: (usageId: string) => apiRequest<{ plans: CustomerPlanDetail[]; usages: PlanUsage[] }>('DELETE', `/admin/plan-usages/${usageId}`, auth),

  crm: (query: { segment?: string; search?: string } = {}) => apiRequest<CrmResponse>('GET', '/admin/crm', { ...auth, query }),
  startContact: (customerId: string, body: { kind: 'reactivation' | 'pickup' | 'other'; appointmentId?: string | null }) =>
    apiRequest<ContactResult>('POST', `/admin/customers/${customerId}/contacts`, { ...auth, body }),
  updateContact: (id: string, status: 'sent' | 'cancelled' | 'opened') => apiRequest<ContactLog>('PATCH', `/admin/contacts/${id}`, { ...auth, body: { status } }),
  linkAccount: (customerId: string, email: string) => apiRequest<CustomerDetail>('POST', `/admin/customers/${customerId}/link-account`, { ...auth, body: { email } }),
  unlinkAccount: (customerId: string) => apiRequest<CustomerDetail>('DELETE', `/admin/customers/${customerId}/link-account`, auth),
  petUploadTicket: (petId: string, body: { kind: 'pet-photo' | 'pet-reference'; contentType: string; size: number }) =>
    apiRequest<UploadTicket>('POST', `/admin/pets/${petId}/upload-ticket`, { ...auth, body }),
  setPetPhoto: (petId: string, path: string) => apiRequest<PetDetail>('PUT', `/admin/pets/${petId}/photo`, { ...auth, body: { path } }),
  addPetReference: (petId: string, body: { path: string; description: string }) => apiRequest<PetDetail>('POST', `/admin/pets/${petId}/references`, { ...auth, body }),
  removePetReference: (petId: string, refId: string) => apiRequest<PetDetail>('DELETE', `/admin/pets/${petId}/references/${refId}`, auth),

  comments: () => apiRequest<AdminComment[]>('GET', '/admin/comments', auth),
  removeComment: (id: string) => apiRequest<void>('DELETE', `/admin/comments/${id}`, auth),

  taxi: () => apiRequest<TaxiOverview>('GET', '/admin/taxi', auth),
  updateTaxiSettings: (body: Body) => apiRequest<TaxiOverview>('PUT', '/admin/taxi/settings', { ...auth, body }),
  createTaxiRegion: (body: Body) => apiRequest<TaxiRegion>('POST', '/admin/taxi/regions', { ...auth, body }),
  updateTaxiRegion: (id: string, body: Body) => apiRequest<TaxiRegion>('PATCH', `/admin/taxi/regions/${id}`, { ...auth, body }),
  createTaxiDriver: (body: Body) => apiRequest<TaxiDriver>('POST', '/admin/taxi/drivers', { ...auth, body }),
  updateTaxiDriver: (id: string, body: Body) => apiRequest<TaxiDriver>('PATCH', `/admin/taxi/drivers/${id}`, { ...auth, body }),
  addTaxiBlock: (body: Body) => apiRequest<TaxiBlock>('POST', '/admin/taxi/blocks', { ...auth, body }),
  removeTaxiBlock: (id: string) => apiRequest<void>('DELETE', `/admin/taxi/blocks/${id}`, auth),
  taxiTransports: (query: { date?: string; appointmentId?: string }) => apiRequest<TaxiTransportDetail[]>('GET', '/admin/taxi/transports', { ...auth, query }),
  updateTaxiTransport: (id: string, body: Body) => apiRequest<TaxiTransportDetail>('PATCH', `/admin/taxi/transports/${id}`, { ...auth, body }),
};
