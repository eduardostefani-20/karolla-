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
  ContactLog,
  CustomerPlan,
  EffectiveSubscriptionStatus,
  Plan,
  PlanEvent,
  PlanPayment,
  PlanUsage,
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
  /** Recursos que dependem de atualização do banco (o site esconde o que ainda não está ativo). */
  features: { customerAccounts: boolean };
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
  /** Tentativas de contato pelo WhatsApp (mais recentes primeiro). */
  contacts: ContactLog[];
  /** E-mail da conta do portal vinculada (null = sem conta). */
  accountEmail: string | null;
}

export interface PetDetail extends Pet {
  customer: Customer;
  appointments: Appointment[];
  /** Link temporário da foto (armazenamento privado). */
  photoUrl: string | null;
  references: PortalReference[];
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
  /** Renova o acesso sem pedir a senha de novo (guardado só no navegador do usuário). */
  refreshToken?: string;
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
  /** Atualizações do banco aplicadas (false = recursos novos ainda "em ativação"). */
  schema: { portalCrm: boolean; agendaPlans: boolean };
}

// ---------------------------------------------------------------- Portal do cliente

/** Dados do cliente que ele mesmo vê (sem observações internas da equipe). */
export type PortalCustomer = Omit<Customer, 'notes' | 'userId'>;

export interface PortalReference {
  id: string;
  description: string;
  /** Link temporário (expira em minutos). */
  url: string;
  appointmentId: string | null;
  createdAt: string;
}

/** Pet como o tutor vê: sem observações internas; foto por link temporário. */
export interface PortalPet extends Omit<Pet, 'internalNotes' | 'photoPath'> {
  photoUrl: string | null;
  references: PortalReference[];
}

/** Atendimento como o tutor vê (sem anotações internas). */
export interface PortalAppointment extends Omit<Appointment, 'notes' | 'attribution'> {
  petName: string;
  professionalName: string | null;
}

export interface CustomerAccount {
  email: string;
  name: string;
  /** linked = conta ligada a um cadastro; pending = a equipe precisa confirmar o vínculo. */
  status: 'linked' | 'pending';
  customer: PortalCustomer | null;
}

export interface CustomerSession {
  token: string;
  refreshToken?: string;
  expiresAt: string;
  account: CustomerAccount;
}

export interface SignUpResponse {
  /** true = enviamos um e-mail de confirmação; o login só funciona depois de confirmar. */
  needsConfirmation: boolean;
  session: CustomerSession | null;
}

// ---------------------------------------------------------------- CRM

export type CrmSegment = 'new' | 'recurring' | 'inactive';

export interface CrmCustomer {
  id: string;
  name: string;
  whatsapp: string;
  email: string;
  marketingOptOut: boolean;
  hasAccount: boolean;
  pets: { id: string; name: string }[];
  segment: CrmSegment;
  /** Atendimentos concluídos. */
  visits: number;
  lastVisit: string | null;
  daysSinceLastVisit: number | null;
  nextAppointment: string | null;
  lastContact: ContactLog | null;
  createdAt: string;
}

export interface CrmResponse {
  inactiveDays: number;
  today: string;
  counts: Record<CrmSegment, number>;
  customers: CrmCustomer[];
}

export interface ContactResult {
  contact: ContactLog;
  /** Conversa do WhatsApp com a mensagem pronta (o envio é feito pela pessoa, não pelo sistema). */
  whatsappLink: string;
}

// ---------------------------------------------------------------- Planos

export interface CustomerPlanDetail extends CustomerPlan {
  plan: Pick<Plan, 'id' | 'name' | 'periodicity' | 'serviceIds' | 'usesPerPeriod' | 'rules'>;
  customerName: string;
  petName: string | null;
  effectiveStatus: EffectiveSubscriptionStatus;
  /** Período atual (usos contam a partir daqui até nextDueDate). */
  periodStart: string;
  usesInPeriod: number;
  usesLeft: number;
  payments: PlanPayment[];
  usages: PlanUsage[];
  events: PlanEvent[];
}

/** Plano como o tutor vê na conta (sem histórico interno). */
export type PortalCustomerPlan = Omit<CustomerPlanDetail, 'events' | 'notes' | 'customerName'>;
