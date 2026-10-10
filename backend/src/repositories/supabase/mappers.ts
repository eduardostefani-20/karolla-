import type {
  Addon,
  Appointment,
  BlockedDate,
  BlockedTime,
  Breed,
  BusinessHours,
  BusinessSettings,
  Customer,
  FormFieldConfig,
  IntegrationLog,
  Inspiration,
  Pet,
  Professional,
  Story,
  PetSize,
  Service,
  ServicePrice,
  Species,
} from '@karolla/shared';

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
  toRow: (e) =>
    pick(e as Row, {
      id: 'id', name: 'name', description: 'description', category: 'category', durationMinutes: 'duration_minutes', active: 'active', sortOrder: 'sort_order', speciesIds: 'species_ids',
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
  order: [{ column: 'created_at', ascending: true }],
  toRow: (e) => {
    const row = pick(e as Row, { id: 'id', name: 'name', whatsapp: 'whatsapp', email: 'email', notes: 'notes' });
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
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  }),
};

export const petMapping: TableMapping<Pet> = {
  table: 'pets',
  order: [{ column: 'created_at', ascending: true }],
  toRow: (e) =>
    pick(e as Row, {
      id: 'id', customerId: 'customer_id', name: 'name', speciesId: 'species_id', breedId: 'breed_id', breedName: 'breed_name', sizeId: 'size_id', weightKg: 'weight_kg', ageMonths: 'age_months', notes: 'notes',
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
    notes: str(r.notes),
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
  });
}

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
  toRow: (e) => pick(e as Row, { id: 'id', name: 'name', serviceIds: 'service_ids', color: 'color', active: 'active', sortOrder: 'sort_order' }),
  fromRow: (r) => ({
    id: str(r.id),
    name: str(r.name),
    serviceIds: (r.service_ids as string[] | null) ?? [],
    color: str(r.color) || '#279790',
    active: Boolean(r.active),
    sortOrder: Number(r.sort_order),
  }),
};

export const inspirationMapping: TableMapping<Inspiration> = {
  table: 'inspirations',
  order: [
    { column: 'sort_order', ascending: true },
    { column: 'created_at', ascending: false },
  ],
  toRow: (e) =>
    pick(e as Row, {
      id: 'id', title: 'title', description: 'description', speciesId: 'species_id', breedId: 'breed_id', breedName: 'breed_name',
      imageUrl: 'image_url', storagePath: 'storage_path', serviceId: 'service_id', active: 'active', sortOrder: 'sort_order',
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
