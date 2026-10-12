import type {
  Addon,
  Appointment,
  BlockedDate,
  BlockedTime,
  Breed,
  BusinessHours,
  BusinessSettings,
  ContactLog,
  Customer,
  FormFieldConfig,
  IntegrationLog,
  Inspiration,
  Pet,
  PetReference,
  Professional,
  InspirationComment,
  TaxiBlock,
  TaxiDriver,
  TaxiRegion,
  TaxiTransport,
  Plan,
  CustomerPlan,
  PlanPayment,
  PlanUsage,
  PlanEvent,
  ProfessionalTimeOff,
  Story,
  PetSize,
  Service,
  ServicePrice,
  Species,
} from '@karolla/shared';
import { DEFAULT_CRM_INACTIVE_DAYS, DEFAULT_CRM_REACTIVATION_MESSAGE, DEFAULT_PICKUP_MESSAGE, DEFAULT_PROFESSIONAL_COLOR } from '@karolla/shared';

/**
 * Conversão entre o modelo de domínio (camelCase) e as colunas do PostgreSQL (snake_case).
 * Mantém o restante da aplicação independente dos nomes de colunas do banco.
 */

export type Row = Record<string, unknown>;

export interface TableMapping<T> {
  table: string;
  /** Converte um objeto (parcial) do domínio em colunas. Campos `undefined` são omitidos. */
  toRow(entity: Partial<T>): Row;
  fromRow(row: Row): T;
  order: { column: string; ascending: boolean }[];
  /** Colunas criadas por migração recente: se o banco ainda não as tiver, a gravação segue sem elas. */
  optionalColumns?: string[];
  /** Tabela criada por migração recente: sem ela, leituras devolvem vazio. */
  optionalTable?: boolean;
}

const hhmm = (v: unknown) => (typeof v === 'string' ? v.slice(0, 5) : null);
const num = (v: unknown) => (v == null ? null : Number(v));
const str = (v: unknown) => (v == null ? '' : String(v));

/** Monta a linha apenas com campos definidos (para PATCH parcial). */
function pick(entity: Row, map: Record<string, string>, transforms: Record<string, (v: unknown) => unknown> = {}): Row {
  const row: Row = {};
  for (const [key, column] of Object.entries(map)) {
    if (entity[key] !== undefined) row[column] = transforms[key] ? transforms[key]!(entity[key]) : entity[key];
  }
  return row;
}

const sortOrder = [{ column: 'sort_order', ascending: true }];

export const speciesMapping: TableMapping<Species> = {
  table: 'pet_species',
  order: sortOrder,
  toRow: (e) => pick(e as Row, { id: 'id', name: 'name', emoji: 'emoji', active: 'active', sortOrder: 'sort_order' }),
  fromRow: (r) => ({ id: str(r.id), name: str(r.name), emoji: str(r.emoji), active: Boolean(r.active), sortOrder: Number(r.sort_order) }),
};

export const breedMapping: TableMapping<Breed> = {
  table: 'pet_breeds',
  order: sortOrder,
  toRow: (e) =>
    pick(e as Row, { id: 'id', speciesId: 'species_id', name: 'name', defaultSizeId: 'default_size_id', active: 'active', sortOrder: 'sort_order' }),
  fromRow: (r) => ({
    id: str(r.id),
    speciesId: str(r.species_id),
    name: str(r.name),
    defaultSizeId: (r.default_size_id as string | null) ?? null,
    active: Boolean(r.active),
    sortOrder: Number(r.sort_order),
  }),
};

export const sizeMapping: TableMapping<PetSize> = {
  table: 'pet_sizes',
  order: sortOrder,
  toRow: (e) =>
    pick(e as Row, {
      id: 'id', name: 'name', description: 'description', minWeightKg: 'min_weight_kg', maxWeightKg: 'max_weight_kg', active: 'active', sortOrder: 'sort_order',
    }),
  fromRow: (r) => ({
    id: str(r.id),
    name: str(r.name),
    description: str(r.description),
    minWeightKg: num(r.min_weight_kg),
    maxWeightKg: num(r.max_weight_kg),
    active: Boolean(r.active),
    sortOrder: Number(r.sort_order),
  }),
};

export const serviceMapping: TableMapping<Service> = {
  table: 'services',
  order: sortOrder,
  optionalColumns: ['max_concurrent', 'includes_grooming'],
  toRow: (e) =>
    pick(e as Row, {
      id: 'id', name: 'name', description: 'description', category: 'category', durationMinutes: 'duration_minutes', active: 'active', sortOrder: 'sort_order', speciesIds: 'species_ids', maxConcurrent: 'max_concurrent', includesGrooming: 'includes_grooming',
    }),
  fromRow: (r) => ({
    id: str(r.id),
    name: str(r.name),
    description: str(r.description),
    category: str(r.category),
    durationMinutes: Number(r.duration_minutes),
    active: Boolean(r.active),
    sortOrder: Number(r.sort_order),
    speciesIds: (r.species_ids as string[] | null) ?? [],
    maxConcurrent: r.max_concurrent == null ? null : Number(r.max_concurrent),
    // antes da migração 0011: considera "tosa" no nome/categoria
    includesGrooming: r.includes_grooming == null ? /tosa/i.test(`${str(r.name)} ${str(r.category)}`) : Boolean(r.includes_grooming),
  }),
};

export const servicePriceMapping: TableMapping<ServicePrice> = {
  table: 'service_prices',
  order: [{ column: 'service_id', ascending: true }],
  toRow: (e) =>
    pick(e as Row, { id: 'id', serviceId: 'service_id', sizeId: 'size_id', priceCents: 'price_cents', durationMinutes: 'duration_minutes' }),
  fromRow: (r) => ({
    id: str(r.id),
    serviceId: str(r.service_id),
    sizeId: str(r.size_id),
    priceCents: Number(r.price_cents),
    durationMinutes: num(r.duration_minutes),
  }),
};

export const addonMapping: TableMapping<Addon> = {
  table: 'addons',
  order: sortOrder,
  toRow: (e) =>
    pick(e as Row, {
      id: 'id', name: 'name', description: 'description', priceCents: 'price_cents', durationMinutes: 'duration_minutes', active: 'active', sortOrder: 'sort_order',
    }),
  fromRow: (r) => ({
    id: str(r.id),
    name: str(r.name),
    description: str(r.description),
    priceCents: Number(r.price_cents),
    durationMinutes: Number(r.duration_minutes),
    active: Boolean(r.active),
    sortOrder: Number(r.sort_order),
  }),
};

export const customerMapping: TableMapping<Customer> = {
  table: 'customers',
  optionalColumns: ['marketing_opt_out'],
  order: [{ column: 'created_at', ascending: true }],
  toRow: (e) => {
    const row = pick(e as Row, { id: 'id', name: 'name', whatsapp: 'whatsapp', email: 'email', notes: 'notes', userId: 'user_id', marketingOptOut: 'marketing_opt_out' });
    if (e.address) {
      Object.assign(row, {
        address_street: e.address.street,
        address_number: e.address.number,
        address_complement: e.address.complement,
        address_neighborhood: e.address.neighborhood,
        address_city: e.address.city,
      });
    }
    return row;
  },
  fromRow: (r) => ({
    id: str(r.id),
    name: str(r.name),
    whatsapp: str(r.whatsapp),
    email: str(r.email),
    address: {
      street: str(r.address_street),
      number: str(r.address_number),
      complement: str(r.address_complement),
      neighborhood: str(r.address_neighborhood),
      city: str(r.address_city),
    },
    notes: str(r.notes),
    userId: (r.user_id as string | null) ?? null,
    marketingOptOut: Boolean(r.marketing_opt_out),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  }),
};

export const petMapping: TableMapping<Pet> = {
  table: 'pets',
  optionalColumns: ['birth_date', 'characteristics', 'grooming_preferences', 'internal_notes', 'photo_path'],
  order: [{ column: 'created_at', ascending: true }],
  toRow: (e) =>
    pick(e as Row, {
      id: 'id', customerId: 'customer_id', name: 'name', speciesId: 'species_id', breedId: 'breed_id', breedName: 'breed_name', sizeId: 'size_id', weightKg: 'weight_kg', ageMonths: 'age_months', notes: 'notes',
      birthDate: 'birth_date', characteristics: 'characteristics', groomingPreferences: 'grooming_preferences', internalNotes: 'internal_notes', photoPath: 'photo_path',
    }),
  fromRow: (r) => ({
    id: str(r.id),
    customerId: str(r.customer_id),
    name: str(r.name),
    speciesId: str(r.species_id),
    breedId: (r.breed_id as string | null) ?? null,
    breedName: str(r.breed_name),
    sizeId: str(r.size_id),
    weightKg: num(r.weight_kg),
    ageMonths: num(r.age_months),
    birthDate: (r.birth_date as string | null) ?? null,
    notes: str(r.notes),
    characteristics: str(r.characteristics),
    groomingPreferences: str(r.grooming_preferences),
    internalNotes: str(r.internal_notes),
    photoPath: str(r.photo_path),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  }),
};

export const businessHoursMapping: TableMapping<BusinessHours> = {
  table: 'business_hours',
  order: [{ column: 'weekday', ascending: true }],
  toRow: (e) =>
    pick(e as Row, {
      id: 'id', weekday: 'weekday', isOpen: 'is_open', openTime: 'open_time', closeTime: 'close_time', breakStart: 'break_start', breakEnd: 'break_end',
    }),
  fromRow: (r) => ({
    id: str(r.id),
    weekday: Number(r.weekday),
    isOpen: Boolean(r.is_open),
    openTime: hhmm(r.open_time) ?? '08:00',
    closeTime: hhmm(r.close_time) ?? '18:00',
    breakStart: hhmm(r.break_start),
    breakEnd: hhmm(r.break_end),
  }),
};

export const blockedDateMapping: TableMapping<BlockedDate> = {
  table: 'blocked_dates',
  order: [{ column: 'date', ascending: true }],
  toRow: (e) => pick(e as Row, { id: 'id', date: 'date', reason: 'reason' }),
  fromRow: (r) => ({ id: str(r.id), date: str(r.date), reason: str(r.reason) }),
};

export const blockedTimeMapping: TableMapping<BlockedTime> = {
  table: 'blocked_times',
  order: [
    { column: 'date', ascending: true },
    { column: 'start_time', ascending: true },
  ],
  toRow: (e) => pick(e as Row, { id: 'id', date: 'date', startTime: 'start_time', endTime: 'end_time', reason: 'reason' }),
  fromRow: (r) => ({ id: str(r.id), date: str(r.date), startTime: hhmm(r.start_time) ?? '', endTime: hhmm(r.end_time) ?? '', reason: str(r.reason) }),
};

export const integrationLogMapping: TableMapping<IntegrationLog> = {
  table: 'integration_logs',
  order: [{ column: 'created_at', ascending: true }],
  toRow: (e) =>
    pick(e as Row, { id: 'id', appointmentId: 'appointment_id', integration: 'integration', status: 'status', detail: 'detail', createdAt: 'created_at' }),
  fromRow: (r) => ({
    id: str(r.id),
    appointmentId: str(r.appointment_id),
    integration: r.integration as IntegrationLog['integration'],
    status: r.status as IntegrationLog['status'],
    detail: str(r.detail),
    createdAt: str(r.created_at),
  }),
};

export function settingsToRow(s: Partial<BusinessSettings>): Row {
  return pick(s as Row, {
    businessName: 'business_name',
    whatsappNumber: 'whatsapp_number',
    contactEmail: 'contact_email',
    addressLine: 'address_line',
    city: 'city',
    instagram: 'instagram',
    timezone: 'timezone',
    slotIntervalMinutes: 'slot_interval_minutes',
    capacity: 'capacity',
    minAdvanceMinutes: 'min_advance_minutes',
    maxAdvanceDays: 'max_advance_days',
    bookingNotice: 'booking_notice',
    metaPixelId: 'meta_pixel_id',
    googleAdsId: 'google_ads_id',
    googleAdsBookingLabel: 'google_ads_booking_label',
    googleAdsWhatsappLabel: 'google_ads_whatsapp_label',
    tiktokPixelId: 'tiktok_pixel_id',
    crmInactiveDays: 'crm_inactive_days',
    crmReactivationMessage: 'crm_reactivation_message',
    pickupMessage: 'pickup_message',
    slotCapacityLimit: 'slot_capacity_limit',
    taxiEnabled: 'taxi_enabled',
    taxiWindows: 'taxi_windows',
    taxiPickupLeadMinutes: 'taxi_pickup_lead_minutes',
    taxiSlotMinutes: 'taxi_slot_minutes',
  });
}

/** Colunas de configurações criadas pela migração 0009. */
export const SETTINGS_OPTIONAL_COLUMNS = [
  'crm_inactive_days',
  'crm_reactivation_message',
  'pickup_message',
  'slot_capacity_limit',
  'taxi_enabled',
  'taxi_windows',
  'taxi_pickup_lead_minutes',
  'taxi_slot_minutes',
];

export function settingsFromRow(r: Row): BusinessSettings {
  return {
    businessName: str(r.business_name),
    whatsappNumber: str(r.whatsapp_number),
    contactEmail: str(r.contact_email),
    addressLine: str(r.address_line),
    city: str(r.city),
    instagram: str(r.instagram),
    timezone: str(r.timezone) || 'America/Sao_Paulo',
    slotIntervalMinutes: Number(r.slot_interval_minutes),
    capacity: Number(r.capacity),
    minAdvanceMinutes: Number(r.min_advance_minutes),
    maxAdvanceDays: Number(r.max_advance_days),
    bookingNotice: str(r.booking_notice),
    metaPixelId: str(r.meta_pixel_id),
    googleAdsId: str(r.google_ads_id),
    googleAdsBookingLabel: str(r.google_ads_booking_label),
    googleAdsWhatsappLabel: str(r.google_ads_whatsapp_label),
    tiktokPixelId: str(r.tiktok_pixel_id),
    crmInactiveDays: r.crm_inactive_days == null ? DEFAULT_CRM_INACTIVE_DAYS : Number(r.crm_inactive_days),
    crmReactivationMessage: str(r.crm_reactivation_message) || DEFAULT_CRM_REACTIVATION_MESSAGE,
    pickupMessage: str(r.pickup_message) || DEFAULT_PICKUP_MESSAGE,
    slotCapacityLimit: r.slot_capacity_limit == null ? null : Number(r.slot_capacity_limit),
    taxiEnabled: Boolean(r.taxi_enabled),
    taxiWindows: Array.isArray(r.taxi_windows) ? (r.taxi_windows as BusinessSettings['taxiWindows']) : [],
    taxiPickupLeadMinutes: r.taxi_pickup_lead_minutes == null ? 30 : Number(r.taxi_pickup_lead_minutes),
    taxiSlotMinutes: r.taxi_slot_minutes == null ? 30 : Number(r.taxi_slot_minutes),
  };
}

export function formFieldFromRow(r: Row): FormFieldConfig {
  return {
    key: r.key as FormFieldConfig['key'],
    label: str(r.label),
    helpText: str(r.help_text),
    enabled: Boolean(r.enabled),
    required: Boolean(r.required),
  };
}

export function formFieldToRow(f: FormFieldConfig): Row {
  return { key: f.key, label: f.label, help_text: f.helpText, enabled: f.enabled, required: f.required };
}

export function appointmentToRow(a: Partial<Appointment>): Row {
  const row = pick(a as Row, {
    customerId: 'customer_id',
    petId: 'pet_id',
    sizeId: 'size_id',
    date: 'date',
    time: 'start_time',
    durationMinutes: 'duration_minutes',
    totalCents: 'total_cents',
    status: 'status',
    notes: 'notes',
    customerNotes: 'customer_notes',
    source: 'source',
    professionalId: 'professional_id',
  });
  if (a.inspiration !== undefined) {
    row.inspiration_id = a.inspiration?.id ?? null;
    row.inspiration_snapshot = a.inspiration ?? null;
  }
  if (a.attribution !== undefined) row.attribution = a.attribution ?? null;
  return row;
}

export function appointmentFromRow(r: Row): Appointment {
  const services = ((r.appointment_services as Row[] | undefined) ?? [])
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((s) => ({ serviceId: str(s.service_id), name: str(s.name), priceCents: Number(s.price_cents), durationMinutes: Number(s.duration_minutes) }));
  const addons = ((r.appointment_addons as Row[] | undefined) ?? [])
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((s) => ({ addonId: str(s.addon_id), name: str(s.name), priceCents: Number(s.price_cents), durationMinutes: Number(s.duration_minutes) }));
  return {
    id: str(r.id),
    customerId: str(r.customer_id),
    petId: str(r.pet_id),
    sizeId: str(r.size_id),
    date: str(r.date),
    time: hhmm(r.start_time) ?? '',
    durationMinutes: Number(r.duration_minutes),
    totalCents: Number(r.total_cents),
    status: r.status as Appointment['status'],
    notes: str(r.notes),
    customerNotes: str(r.customer_notes),
    source: (r.source as Appointment['source']) ?? 'online',
    professionalId: (r.professional_id as string | null) ?? null,
    inspiration: (r.inspiration_snapshot as Appointment['inspiration']) ?? null,
    attribution: (r.attribution as Appointment['attribution']) ?? null,
    origin: (r.origin as Appointment['origin']) ?? null,
    createdByName: str(r.created_by_name),
    services,
    addons,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function serviceItemsToJson(items: Appointment['services']) {
  return items.map((s, position) => ({ service_id: s.serviceId, name: s.name, price_cents: s.priceCents, duration_minutes: s.durationMinutes, position }));
}

export function addonItemsToJson(items: Appointment['addons']) {
  return items.map((a, position) => ({ addon_id: a.addonId, name: a.name, price_cents: a.priceCents, duration_minutes: a.durationMinutes, position }));
}

export const professionalMapping: TableMapping<Professional> = {
  table: 'professionals',
  order: sortOrder,
  optionalColumns: ['capacity', 'work_hours'],
  toRow: (e) =>
    pick(e as Row, { id: 'id', name: 'name', serviceIds: 'service_ids', color: 'color', active: 'active', sortOrder: 'sort_order', capacity: 'capacity', workHours: 'work_hours' }),
  fromRow: (r) => ({
    id: str(r.id),
    name: str(r.name),
    serviceIds: (r.service_ids as string[] | null) ?? [],
    color: str(r.color) || DEFAULT_PROFESSIONAL_COLOR,
    active: Boolean(r.active),
    sortOrder: Number(r.sort_order),
    capacity: r.capacity == null ? 1 : Number(r.capacity),
    workHours: Array.isArray(r.work_hours) ? (r.work_hours as Professional['workHours']) : [],
  }),
};

export const professionalTimeOffMapping: TableMapping<ProfessionalTimeOff> = {
  table: 'professional_time_off',
  optionalTable: true,
  order: [{ column: 'date_from', ascending: true }],
  toRow: (e) =>
    pick(e as Row, { id: 'id', professionalId: 'professional_id', dateFrom: 'date_from', dateTo: 'date_to', startTime: 'start_time', endTime: 'end_time', reason: 'reason' }),
  fromRow: (r) => ({
    id: str(r.id),
    professionalId: str(r.professional_id),
    dateFrom: str(r.date_from),
    dateTo: str(r.date_to),
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    reason: str(r.reason),
    createdAt: str(r.created_at),
  }),
};

export const inspirationMapping: TableMapping<Inspiration> = {
  table: 'inspirations',
  optionalColumns: ['size_id', 'grooming_type'],
  order: [
    { column: 'sort_order', ascending: true },
    { column: 'created_at', ascending: false },
  ],
  toRow: (e) =>
    pick(e as Row, {
      id: 'id', title: 'title', description: 'description', speciesId: 'species_id', breedId: 'breed_id', breedName: 'breed_name',
      imageUrl: 'image_url', storagePath: 'storage_path', serviceId: 'service_id', active: 'active', sortOrder: 'sort_order',
      sizeId: 'size_id', groomingType: 'grooming_type',
    }),
  fromRow: (r) => ({
    id: str(r.id),
    title: str(r.title),
    description: str(r.description),
    speciesId: str(r.species_id),
    breedId: (r.breed_id as string | null) ?? null,
    breedName: str(r.breed_name),
    imageUrl: str(r.image_url),
    storagePath: str(r.storage_path),
    serviceId: (r.service_id as string | null) ?? null,
    sizeId: (r.size_id as string | null) ?? null,
    groomingType: (r.grooming_type as Inspiration['groomingType']) ?? null,
    active: Boolean(r.active),
    sortOrder: Number(r.sort_order),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  }),
};

export const storyMapping: TableMapping<Story> = {
  table: 'stories',
  order: [{ column: 'created_at', ascending: true }],
  toRow: (e) =>
    pick(e as Row, {
      id: 'id', mediaType: 'media_type', mediaUrl: 'media_url', storagePath: 'storage_path', caption: 'caption', expiresAt: 'expires_at',
    }),
  fromRow: (r) => ({
    id: str(r.id),
    mediaType: r.media_type as Story['mediaType'],
    mediaUrl: str(r.media_url),
    storagePath: str(r.storage_path),
    caption: str(r.caption),
    createdAt: new Date(str(r.created_at)).toISOString(),
    expiresAt: new Date(str(r.expires_at)).toISOString(),
  }),
};

export const petReferenceMapping: TableMapping<PetReference> = {
  table: 'pet_references',
  optionalTable: true,
  order: [{ column: 'created_at', ascending: true }],
  toRow: (e) =>
    pick(e as Row, { id: 'id', petId: 'pet_id', customerId: 'customer_id', path: 'path', description: 'description', appointmentId: 'appointment_id', uploadedBy: 'uploaded_by' }),
  fromRow: (r) => ({
    id: str(r.id),
    petId: str(r.pet_id),
    customerId: str(r.customer_id),
    path: str(r.path),
    description: str(r.description),
    appointmentId: (r.appointment_id as string | null) ?? null,
    uploadedBy: r.uploaded_by === 'staff' ? 'staff' : 'customer',
    createdAt: str(r.created_at),
  }),
};

export const contactLogMapping: TableMapping<ContactLog> = {
  table: 'contact_logs',
  optionalTable: true,
  order: [{ column: 'created_at', ascending: true }],
  toRow: (e) =>
    pick(e as Row, {
      id: 'id', customerId: 'customer_id', appointmentId: 'appointment_id', kind: 'kind', status: 'status', message: 'message', actorId: 'actor_id', actorName: 'actor_name',
    }),
  fromRow: (r) => ({
    id: str(r.id),
    customerId: str(r.customer_id),
    appointmentId: (r.appointment_id as string | null) ?? null,
    kind: r.kind as ContactLog['kind'],
    status: r.status as ContactLog['status'],
    message: str(r.message),
    actorId: (r.actor_id as string | null) ?? null,
    actorName: str(r.actor_name),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  }),
};

const ts = (r: Row) => ({ createdAt: str(r.created_at) });

export const planMapping: TableMapping<Plan> = {
  table: 'plans',
  optionalTable: true,
  order: [{ column: 'created_at', ascending: true }],
  toRow: (e) =>
    pick(e as Row, {
      id: 'id', name: 'name', description: 'description', priceCents: 'price_cents', periodicity: 'periodicity', serviceIds: 'service_ids', usesPerPeriod: 'uses_per_period', rules: 'rules', active: 'active',
    }),
  fromRow: (r) => ({
    id: str(r.id),
    name: str(r.name),
    description: str(r.description),
    priceCents: Number(r.price_cents),
    periodicity: r.periodicity as Plan['periodicity'],
    serviceIds: (r.service_ids as string[] | null) ?? [],
    usesPerPeriod: Number(r.uses_per_period),
    rules: str(r.rules),
    active: Boolean(r.active),
    ...ts(r),
    updatedAt: str(r.updated_at),
  }),
};

export const customerPlanMapping: TableMapping<CustomerPlan> = {
  table: 'customer_plans',
  optionalTable: true,
  order: [{ column: 'created_at', ascending: true }],
  toRow: (e) =>
    pick(e as Row, {
      id: 'id', customerId: 'customer_id', planId: 'plan_id', petId: 'pet_id', startDate: 'start_date', nextDueDate: 'next_due_date', status: 'status', priceCents: 'price_cents', notes: 'notes',
    }),
  fromRow: (r) => ({
    id: str(r.id),
    customerId: str(r.customer_id),
    planId: str(r.plan_id),
    petId: (r.pet_id as string | null) ?? null,
    startDate: str(r.start_date),
    nextDueDate: str(r.next_due_date),
    status: r.status as CustomerPlan['status'],
    priceCents: Number(r.price_cents),
    notes: str(r.notes),
    ...ts(r),
    updatedAt: str(r.updated_at),
  }),
};

export const planPaymentMapping: TableMapping<PlanPayment> = {
  table: 'plan_payments',
  optionalTable: true,
  order: [{ column: 'created_at', ascending: true }],
  toRow: (e) =>
    pick(e as Row, {
      id: 'id', customerPlanId: 'customer_plan_id', amountCents: 'amount_cents', paidAt: 'paid_at', method: 'method', periodFrom: 'period_from', periodTo: 'period_to', notes: 'notes', recordedByName: 'recorded_by_name',
    }),
  fromRow: (r) => ({
    id: str(r.id),
    customerPlanId: str(r.customer_plan_id),
    amountCents: Number(r.amount_cents),
    paidAt: str(r.paid_at),
    method: r.method as PlanPayment['method'],
    periodFrom: str(r.period_from),
    periodTo: str(r.period_to),
    notes: str(r.notes),
    recordedByName: str(r.recorded_by_name),
    ...ts(r),
  }),
};

export const planUsageMapping: TableMapping<PlanUsage> = {
  table: 'plan_usages',
  optionalTable: true,
  order: [{ column: 'created_at', ascending: true }],
  toRow: (e) =>
    pick(e as Row, {
      id: 'id', customerPlanId: 'customer_plan_id', appointmentId: 'appointment_id', serviceId: 'service_id', periodStart: 'period_start', usedAt: 'used_at', recordedByName: 'recorded_by_name',
    }),
  fromRow: (r) => ({
    id: str(r.id),
    customerPlanId: str(r.customer_plan_id),
    appointmentId: str(r.appointment_id),
    serviceId: str(r.service_id),
    periodStart: str(r.period_start),
    usedAt: str(r.used_at),
    recordedByName: str(r.recorded_by_name),
    ...ts(r),
  }),
};

export const planEventMapping: TableMapping<PlanEvent> = {
  table: 'plan_events',
  optionalTable: true,
  order: [{ column: 'created_at', ascending: true }],
  toRow: (e) => pick(e as Row, { id: 'id', customerPlanId: 'customer_plan_id', kind: 'kind', detail: 'detail', actorName: 'actor_name' }),
  fromRow: (r) => ({
    id: str(r.id),
    customerPlanId: str(r.customer_plan_id),
    kind: r.kind as PlanEvent['kind'],
    detail: str(r.detail),
    actorName: str(r.actor_name),
    ...ts(r),
  }),
};

export const commentMapping: TableMapping<InspirationComment> = {
  table: 'inspiration_comments',
  optionalTable: true,
  order: [{ column: 'created_at', ascending: true }],
  toRow: (e) => pick(e as Row, { id: 'id', inspirationId: 'inspiration_id', customerId: 'customer_id', authorName: 'author_name', body: 'body', status: 'status' }),
  fromRow: (r) => ({
    id: str(r.id),
    inspirationId: str(r.inspiration_id),
    customerId: str(r.customer_id),
    authorName: str(r.author_name),
    body: str(r.body),
    status: r.status === 'removed' ? 'removed' : 'visible',
    createdAt: str(r.created_at),
  }),
};

export const taxiRegionMapping: TableMapping<TaxiRegion> = {
  table: 'taxi_regions',
  optionalTable: true,
  order: sortOrder,
  toRow: (e) =>
    pick(e as Row, { id: 'id', name: 'name', neighborhoods: 'neighborhoods', feeOneWayCents: 'fee_one_way_cents', feeRoundTripCents: 'fee_round_trip_cents', active: 'active', sortOrder: 'sort_order' }),
  fromRow: (r) => ({
    id: str(r.id),
    name: str(r.name),
    neighborhoods: (r.neighborhoods as string[] | null) ?? [],
    feeOneWayCents: Number(r.fee_one_way_cents),
    feeRoundTripCents: Number(r.fee_round_trip_cents),
    active: Boolean(r.active),
    sortOrder: Number(r.sort_order),
  }),
};

export const taxiDriverMapping: TableMapping<TaxiDriver> = {
  table: 'taxi_drivers',
  optionalTable: true,
  order: sortOrder,
  toRow: (e) => pick(e as Row, { id: 'id', name: 'name', phone: 'phone', active: 'active', capacity: 'capacity', workHours: 'work_hours', sortOrder: 'sort_order' }),
  fromRow: (r) => ({
    id: str(r.id),
    name: str(r.name),
    phone: str(r.phone),
    active: Boolean(r.active),
    capacity: Number(r.capacity ?? 1),
    workHours: Array.isArray(r.work_hours) ? (r.work_hours as TaxiDriver['workHours']) : [],
    sortOrder: Number(r.sort_order),
  }),
};

export const taxiBlockMapping: TableMapping<TaxiBlock> = {
  table: 'taxi_blocks',
  optionalTable: true,
  order: [{ column: 'date_from', ascending: true }],
  toRow: (e) => pick(e as Row, { id: 'id', driverId: 'driver_id', dateFrom: 'date_from', dateTo: 'date_to', startTime: 'start_time', endTime: 'end_time', reason: 'reason' }),
  fromRow: (r) => ({
    id: str(r.id),
    driverId: (r.driver_id as string | null) ?? null,
    dateFrom: str(r.date_from),
    dateTo: str(r.date_to),
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    reason: str(r.reason),
    createdAt: str(r.created_at),
  }),
};

export const taxiTransportMapping: TableMapping<TaxiTransport> = {
  table: 'taxi_transports',
  optionalTable: true,
  order: [{ column: 'created_at', ascending: true }],
  toRow: (e) =>
    pick(e as Row, {
      id: 'id', appointmentId: 'appointment_id', customerId: 'customer_id', petId: 'pet_id', regionId: 'region_id', direction: 'direction', date: 'date',
      pickupTime: 'pickup_time', dropoffTime: 'dropoff_time', address: 'address', notes: 'notes', feeCents: 'fee_cents', driverId: 'driver_id', status: 'status',
    }),
  fromRow: (r) => ({
    id: str(r.id),
    appointmentId: str(r.appointment_id),
    customerId: str(r.customer_id),
    petId: str(r.pet_id),
    regionId: (r.region_id as string | null) ?? null,
    direction: r.direction as TaxiTransport['direction'],
    date: str(r.date),
    pickupTime: hhmm(r.pickup_time),
    dropoffTime: hhmm(r.dropoff_time),
    address: str(r.address),
    notes: str(r.notes),
    feeCents: Number(r.fee_cents),
    driverId: (r.driver_id as string | null) ?? null,
    status: r.status as TaxiTransport['status'],
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  }),
};
