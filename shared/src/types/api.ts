import type {
  AdminUser,
  Addon,
  Appointment,
  Breed,
  BusinessHours,
  BusinessSettings,
  Customer,
  FormFieldConfig,
  IntegrationLog,
  Pet,
  PetSize,
  Service,
  ServicePrice,
  Species,
} from './domain';

/** Contratos da API REST (request/response) compartilhados entre front e back. */

export interface ApiErrorBody {
  error: {
    code: string;
    /** Mensagem amigável, pronta para exibir ao usuário final. */
    message: string;
    fields?: Record<string, string>;
  };
}

export type PublicSettings = Pick<
  BusinessSettings,
  | 'businessName'
  | 'whatsappNumber'
  | 'contactEmail'
  | 'addressLine'
  | 'city'
  | 'instagram'
  | 'timezone'
  | 'maxAdvanceDays'
  | 'bookingNotice'
>;

/** Tudo que o site público precisa para montar o formulário (somente itens ativos). */
export interface PublicCatalog {
  species: Species[];
  breeds: Breed[];
  sizes: PetSize[];
  services: Service[];
  servicePrices: ServicePrice[];
  addons: Addon[];
  formFields: FormFieldConfig[];
  businessHours: BusinessHours[];
  /** Datas futuras bloqueadas (sem o motivo, que é interno). */
  closedDates: string[];
  settings: PublicSettings;
  mode: AppMode;
}

export type AppMode = 'demo' | 'production';

export interface AvailabilityResponse {
  date: string;
  durationMinutes: number;
  closedReason: string | null;
  closedMessage: string | null;
  slots: { time: string; available: boolean }[];
}

export interface BookingResult {
  appointment: Appointment;
  pet: Pet;
  customer: Pick<Customer, 'name'>;
  whatsappLink: string;
}

export interface AppointmentDetail extends Appointment {
  customer: Customer;
  pet: Pet;
  integrationLogs?: IntegrationLog[];
}

export interface CustomerSummary extends Customer {
  petCount: number;
  lastAppointmentDate: string | null;
}

export interface CustomerDetail extends Customer {
  pets: Pet[];
  appointments: Appointment[];
}

export interface PetDetail extends Pet {
  customer: Customer;
  appointments: Appointment[];
}

export interface DashboardData {
  today: string;
  stats: {
    appointmentsToday: number;
    upcoming: number;
    pending: number;
    confirmed: number;
    customers: number;
    pets: number;
    revenueTodayCents: number;
  };
  todayAgenda: AppointmentDetail[];
  nextAppointments: AppointmentDetail[];
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: AdminUser;
}

export interface AdminCatalog {
  species: Species[];
  breeds: Breed[];
  sizes: PetSize[];
  services: Service[];
  servicePrices: ServicePrice[];
  addons: Addon[];
  formFields: FormFieldConfig[];
}

export interface SystemStatus {
  mode: AppMode;
  database: { provider: string; connected: boolean };
  auth: { provider: string };
  whatsapp: { provider: string; configured: boolean };
  googleSheets: { provider: string; configured: boolean };
}
