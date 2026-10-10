import type {
  AdminUser,
  Inspiration,
  Professional,
  Story,
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
  | 'metaPixelId'
  | 'googleAdsId'
  | 'googleAdsBookingLabel'
  | 'googleAdsWhatsappLabel'
  | 'tiktokPixelId'
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
  /** Profissionais ativos (o cliente pode escolher ou deixar "sem preferência"). */
  professionals: Pick<Professional, 'id' | 'name' | 'serviceIds'>[];
  /** Datas futuras bloqueadas (sem o motivo, que é interno). */
  closedDates: string[];
  settings: PublicSettings;
  mode: AppMode;
}

export type AppMode = 'demo' | 'production';

export interface AvailabilityResponse {
  date: string;
  durationMinutes: number;
  /** Profissionais que fazem os serviços escolhidos (vazio = agenda sem profissionais). */
  professionals: Pick<Professional, 'id' | 'name'>[];
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
  professional: Pick<Professional, 'id' | 'name' | 'color'> | null;
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
  /** Agendamentos feitos nos últimos 30 dias, agrupados por origem (anúncios, Instagram, Google…). */
  channels: { key: string; label: string; paid: boolean; count: number; revenueCents: number }[];
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: AdminUser;
}

export type PublicInspiration = Omit<Inspiration, 'storagePath' | 'active' | 'sortOrder' | 'updatedAt'>;
export type PublicStory = Omit<Story, 'storagePath'>;

export interface InstagramPost {
  id: string;
  caption: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  mediaUrl: string;
  thumbnailUrl: string | null;
  permalink: string;
  timestamp: string;
}

export interface InstagramFeedResponse {
  /** false = integração oficial da Meta não configurada (nenhum post é inventado). */
  configured: boolean;
  posts: InstagramPost[];
}

/** Upload direto para o armazenamento (URL assinada e temporária). */
export interface UploadTicket {
  provider: 'supabase' | 'memory';
  /** Supabase: URL do storage, bucket e token para uploadToSignedUrl. */
  storageUrl?: string;
  bucket?: string;
  token?: string;
  apiKey?: string;
  /** Memória (demo): URL para PUT do arquivo. */
  uploadUrl?: string;
  path: string;
  publicUrl: string;
}

export interface AdminCatalog {
  species: Species[];
  breeds: Breed[];
  sizes: PetSize[];
  services: Service[];
  servicePrices: ServicePrice[];
  addons: Addon[];
  formFields: FormFieldConfig[];
  professionals: Professional[];
}

export interface SystemStatus {
  mode: AppMode;
  storage: { provider: string };
  instagramFeed: { configured: boolean };
  database: { provider: string; connected: boolean };
  auth: { provider: string };
  whatsapp: { provider: string; configured: boolean };
  googleSheets: { provider: string; configured: boolean };
}
