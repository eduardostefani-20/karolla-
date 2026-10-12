/**
 * Entidades de domínio da Karolla Pet.
 *
 * Estes tipos são compartilhados entre front-end e back-end. Valores monetários
 * são SEMPRE armazenados em centavos (inteiros) para evitar erros de ponto flutuante.
 * Datas de agendamento usam o formato local `YYYY-MM-DD` e horários `HH:MM`,
 * interpretados no fuso horário configurado em `BusinessSettings.timezone`.
 */

import { STAFF_ROLES, type PermissionSet, type StaffRole } from '../auth/permissions';

export type ID = string;

export const APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Status que NÃO ocupam a agenda (liberam o horário). */
export const NON_BLOCKING_STATUSES: readonly AppointmentStatus[] = ['cancelled', 'no_show'];

/** Perfis da equipe — veja shared/src/auth/permissions.ts. */
export const ADMIN_ROLES = STAFF_ROLES;
export type AdminRole = StaffRole;

export interface Species {
  id: ID;
  name: string;
  emoji: string;
  active: boolean;
  sortOrder: number;
}

export interface Breed {
  id: ID;
  speciesId: ID;
  name: string;
  /** Porte sugerido ao escolher a raça (o tutor pode alterar). */
  defaultSizeId: ID | null;
  active: boolean;
  sortOrder: number;
}

export interface PetSize {
  id: ID;
  name: string;
  description: string;
  minWeightKg: number | null;
  maxWeightKg: number | null;
  active: boolean;
  sortOrder: number;
}

export interface Service {
  id: ID;
  name: string;
  description: string;
  category: string;
  /** Duração padrão em minutos (pode ser sobrescrita por porte em ServicePrice). */
  durationMinutes: number;
  active: boolean;
  sortOrder: number;
  /** Espécies atendidas. Lista vazia = todas as espécies. */
  speciesIds: ID[];
}

export interface ServicePrice {
  id: ID;
  serviceId: ID;
  sizeId: ID;
  priceCents: number;
  /** Duração específica para este porte. `null` = usa a duração padrão do serviço. */
  durationMinutes: number | null;
}

export interface Addon {
  id: ID;
  name: string;
  description: string;
  priceCents: number;
  durationMinutes: number;
  active: boolean;
  sortOrder: number;
}

export interface Address {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
}

export interface Customer {
  id: ID;
  name: string;
  /** Somente dígitos, com DDD. Ex.: 11999999999 */
  whatsapp: string;
  email: string;
  address: Address;
  /** Observações INTERNAS da equipe (o cliente nunca vê). */
  notes: string;
  /** Conta do portal do cliente vinculada (null = sem login). */
  userId: ID | null;
  /** O cliente pediu para não receber mensagens de lembrete/promoção (o CRM respeita). */
  marketingOptOut: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Pet {
  id: ID;
  customerId: ID;
  name: string;
  speciesId: ID;
  /** `null` quando o tutor digitou uma raça que não está na lista. */
  breedId: ID | null;
  /** Nome da raça (da lista ou digitado manualmente). */
  breedName: string;
  sizeId: ID;
  weightKg: number | null;
  ageMonths: number | null;
  /** Data de nascimento (aaaa-mm-dd). Quando informada, a idade é calculada a partir dela. */
  birthDate: string | null;
  /** Observações do tutor (visíveis para o cliente e a equipe). */
  notes: string;
  /** Temperamento e características (ex.: medroso com secador, idoso, alérgico). */
  characteristics: string;
  /** Preferências de tosa informadas pelo tutor. */
  groomingPreferences: string;
  /** Observações INTERNAS da equipe (o cliente nunca vê). */
  internalNotes: string;
  /** Foto do pet no armazenamento PRIVADO ('' = sem foto). Exibida por link temporário. */
  photoPath: string;
  createdAt: string;
  updatedAt: string;
}

/** Valores iniciais dos campos acrescentados ao cliente e ao pet (portal/CRM). */
export const CUSTOMER_DEFAULTS = { userId: null, marketingOptOut: false } satisfies Pick<Customer, 'userId' | 'marketingOptOut'>;
export const PET_DEFAULTS = {
  birthDate: null,
  characteristics: '',
  groomingPreferences: '',
  internalNotes: '',
  photoPath: '',
} satisfies Pick<Pet, 'birthDate' | 'characteristics' | 'groomingPreferences' | 'internalNotes' | 'photoPath'>;

/** Foto de referência (ex.: corte desejado) guardada em armazenamento privado. */
export interface PetReference {
  id: ID;
  petId: ID;
  customerId: ID;
  path: string;
  description: string;
  /** Agendamento ao qual a referência foi associada (null = referência geral do pet). */
  appointmentId: ID | null;
  uploadedBy: 'customer' | 'staff';
  createdAt: string;
}

export const CONTACT_KINDS = ['reactivation', 'pickup', 'other'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];
export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  reactivation: 'Reativação (cliente inativo)',
  pickup: 'Aviso de retirada',
  other: 'Outro contato',
};
export const CONTACT_STATUSES = ['opened', 'sent', 'cancelled'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];
export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  opened: 'WhatsApp aberto (envio não confirmado)',
  sent: 'Enviado',
  cancelled: 'Não enviado',
};

/**
 * Tentativa de contato pelo WhatsApp. O sistema NUNCA envia sozinho: abre a conversa com a mensagem
 * pronta e a equipe confirma se enviou.
 */
export interface ContactLog {
  id: ID;
  customerId: ID;
  appointmentId: ID | null;
  kind: ContactKind;
  status: ContactStatus;
  message: string;
  actorId: ID | null;
  actorName: string;
  createdAt: string;
  updatedAt: string;
}

/** Profissional da equipe (banhista, tosador...). Cada profissional atende 1 pet por vez. */
export interface Professional {
  id: ID;
  name: string;
  /** Serviços que executa. Lista vazia = todos os serviços. */
  serviceIds: ID[];
  /** Cor usada na agenda do painel. */
  color: string;
  active: boolean;
  sortOrder: number;
}

/** Foto do catálogo de inspirações de tosa (estilo Instagram). */
export interface Inspiration {
  id: ID;
  title: string;
  description: string;
  speciesId: ID;
  breedId: ID | null;
  breedName: string;
  /** URL pública da foto. */
  imageUrl: string;
  /** Caminho no armazenamento (para excluir o arquivo). Vazio para imagens estáticas. */
  storagePath: string;
  /** Serviço sugerido para este visual (opcional, apenas informativo). */
  serviceId: ID | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Referência da inspiração escolhida, "fotografada" no agendamento. */
export interface AppointmentInspiration {
  id: ID;
  title: string;
  imageUrl: string;
  breedName: string;
}

export type StoryMediaType = 'image' | 'video';

/** Story com validade de 24h (expiresAt persistido no banco). */
export interface Story {
  id: ID;
  mediaType: StoryMediaType;
  mediaUrl: string;
  storagePath: string;
  caption: string;
  createdAt: string;
  expiresAt: string;
}

export const STORY_TTL_HOURS = 24;

/** Itens são "fotografados" no momento do agendamento: mudanças de preço futuras não alteram o histórico. */
export interface AppointmentServiceItem {
  serviceId: ID;
  name: string;
  priceCents: number;
  durationMinutes: number;
}

export interface AppointmentAddonItem {
  addonId: ID;
  name: string;
  priceCents: number;
  durationMinutes: number;
}

export type AppointmentSource = 'online' | 'admin';

export interface Appointment {
  id: ID;
  customerId: ID;
  petId: ID;
  /** Porte usado no cálculo do preço. */
  sizeId: ID;
  date: string;
  time: string;
  durationMinutes: number;
  totalCents: number;
  status: AppointmentStatus;
  /** Observações internas / do atendimento. */
  notes: string;
  /** Observações escritas pelo tutor no formulário. */
  customerNotes: string;
  source: AppointmentSource;
  /** Profissional responsável (null = sem profissional definido). */
  professionalId: ID | null;
  /** Inspiração de tosa escolhida pelo cliente (null = nenhuma). */
  inspiration: AppointmentInspiration | null;
  /** De onde o cliente veio (anúncio, Instagram, Google…). null = agendamento antigo ou feito pelo painel. */
  attribution: AppointmentAttribution | null;
  services: AppointmentServiceItem[];
  addons: AppointmentAddonItem[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Origem do cliente, capturada no site a partir dos parâmetros do link (UTM e identificadores de clique
 * dos anúncios) e do site de onde ele veio. Serve para saber quais campanhas trazem agendamentos.
 */
export interface AppointmentAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  /** Clique em anúncio do Google Ads (gclid / gbraid / wbraid). */
  gclid?: string;
  /** Clique vindo do Instagram/Facebook (anúncio ou link orgânico). */
  fbclid?: string;
  /** Clique em anúncio do TikTok. */
  ttclid?: string;
  /** Site de onde o cliente veio (só o domínio). */
  referrer?: string;
  /** Primeira página que o cliente abriu (caminho, sem domínio). */
  landingPage?: string;
  /** Quando a origem foi registrada (ISO). */
  capturedAt?: string;
}

export interface BusinessHours {
  id: ID;
  /** 0 = domingo ... 6 = sábado */
  weekday: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breakStart: string | null;
  breakEnd: string | null;
}

export interface BlockedDate {
  id: ID;
  date: string;
  reason: string;
}

export interface BlockedTime {
  id: ID;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
}

export interface BusinessSettings {
  businessName: string;
  /** Número da Karolla Pet para WhatsApp (somente dígitos, com DDI 55). Fonte única do número. */
  whatsappNumber: string;
  contactEmail: string;
  addressLine: string;
  city: string;
  instagram: string;
  timezone: string;
  /** Intervalo entre horários exibidos no calendário. */
  slotIntervalMinutes: number;
  /** Quantos atendimentos simultâneos a equipe comporta. */
  capacity: number;
  /** Antecedência mínima para agendar online (minutos). */
  minAdvanceMinutes: number;
  /** Até quantos dias à frente o cliente pode agendar. */
  maxAdvanceDays: number;
  /** Mensagem exibida no resumo/confirmação. */
  bookingNotice: string;
  /** Pixel da Meta (Instagram/Facebook Ads) — só números. Vazio = desligado. */
  metaPixelId: string;
  /** Tag do Google Ads (AW-123456789). Vazio = desligado. */
  googleAdsId: string;
  /** Rótulo da conversão "agendamento concluído" no Google Ads. */
  googleAdsBookingLabel: string;
  /** Rótulo da conversão "clique no WhatsApp" no Google Ads (opcional). */
  googleAdsWhatsappLabel: string;
  /** Pixel do TikTok Ads. Vazio = desligado. */
  tiktokPixelId: string;
  /** CRM: cliente sem atendimento concluído há mais de N dias é considerado inativo. */
  crmInactiveDays: number;
  /** CRM: mensagem de reativação. Variáveis: {tutor}, {pet}, {dias}. */
  crmReactivationMessage: string;
}

export const FORM_FIELD_KEYS = [
  'pet.weight',
  'pet.age',
  'pet.notes',
  'tutor.email',
  'tutor.address',
  'tutor.notes',
] as const;
export type FormFieldKey = (typeof FORM_FIELD_KEYS)[number];

/** Configuração editável de campos do formulário de agendamento. */
export interface FormFieldConfig {
  key: FormFieldKey;
  label: string;
  helpText: string;
  enabled: boolean;
  required: boolean;
}

export type IntegrationName = 'whatsapp' | 'google_sheets';
export type IntegrationStatus = 'success' | 'failed' | 'skipped' | 'link_generated';

export interface IntegrationLog {
  id: ID;
  appointmentId: ID;
  integration: IntegrationName;
  status: IntegrationStatus;
  detail: string;
  createdAt: string;
}

export interface AdminUser {
  id: ID;
  email: string;
  name: string;
  role: AdminRole;
  /** Permissões efetivas (perfil ou personalização). O servidor sempre revalida. */
  permissions: PermissionSet;
  /** Profissional vinculado à conta (agenda "somente os próprios atendimentos"). */
  professionalId: ID | null;
}

/** Conta da equipe vista na tela "Equipe e permissões". */
export interface StaffMember {
  id: ID;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  /** null = usa as permissões do perfil. */
  customPermissions: PermissionSet | null;
  permissions: PermissionSet;
  professionalId: ID | null;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Registro das principais ações administrativas. */
export interface AuditLog {
  id: ID;
  actorId: ID | null;
  actorEmail: string;
  action: string;
  entity: string;
  entityId: string | null;
  status: number;
  createdAt: string;
}
