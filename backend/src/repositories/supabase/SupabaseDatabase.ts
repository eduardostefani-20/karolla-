import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';
import { isBlockingStatus, NON_BLOCKING_STATUSES, type Customer, type Story } from '@karolla/shared';
import { InfrastructureError, NotFoundError, SlotConflictError, ConflictError } from '../../utils/errors';
import type {
  AdminRecord,
  AppointmentFilter,
  AppointmentPatch,
  AppointmentRepository,
  CapacityGuard,
  DatabaseService,
  EntityPatch,
  NewAppointment,
  NewEntity,
  TableRepository,
} from '../types';
import {
  addonItemsToJson,
  addonMapping,
  appointmentFromRow,
  appointmentToRow,
  blockedDateMapping,
  blockedTimeMapping,
  breedMapping,
  businessHoursMapping,
  customerMapping,
  formFieldFromRow,
  formFieldToRow,
  integrationLogMapping,
  inspirationMapping,
  petMapping,
  professionalMapping,
  storyMapping,
  serviceItemsToJson,
  serviceMapping,
  servicePriceMapping,
  settingsFromRow,
  settingsToRow,
  sizeMapping,
  speciesMapping,
  type Row,
  type TableMapping,
} from './mappers';

/**
 * PRODUÇÃO — implementação do DatabaseService sobre Supabase (PostgreSQL).
 *
 * Usa a SERVICE ROLE KEY apenas no servidor (ignora RLS por design: o back-end é quem
 * aplica autenticação/autorização). O front-end nunca recebe esta chave.
 * O schema correspondente está em /database/migrations.
 */

function fail(error: PostgrestError, context: string): never {
  // 23505 = unique_violation, 23503 = foreign_key_violation
  if (error.code === '23505') throw new ConflictError('DUPLICATED', 'Já existe um registro com estes dados.');
  if (error.code === '23503') {
    throw new ConflictError('IN_USE', 'Este registro está sendo usado em outros cadastros. Desative-o em vez de excluir.');
  }
  if (error.message?.includes('SLOT_UNAVAILABLE')) throw new SlotConflictError();
  if (error.message?.includes('APPOINTMENT_NOT_FOUND')) throw new NotFoundError('Agendamento não encontrado.');
  throw new InfrastructureError(`Supabase (${context}): ${error.message}`, error);
}

class SupabaseTable<T extends { id: string }> implements TableRepository<T> {
  constructor(
    protected readonly client: SupabaseClient,
    protected readonly mapping: TableMapping<T>,
  ) {}

  async list(filter: Partial<T> = {}): Promise<T[]> {
    let query = this.client.from(this.mapping.table).select('*');
    const match = this.mapping.toRow(filter);
    if (Object.keys(match).length) query = query.match(match);
    for (const o of this.mapping.order) query = query.order(o.column, { ascending: o.ascending });
    const { data, error } = await query;
    if (error) fail(error, `list ${this.mapping.table}`);
    return (data as Row[]).map(this.mapping.fromRow);
  }

  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.client.from(this.mapping.table).select('*').eq('id', id).maybeSingle();
    if (error) fail(error, `find ${this.mapping.table}`);
    return data ? this.mapping.fromRow(data as Row) : null;
  }

  async create(input: NewEntity<T>): Promise<T> {
    const { data, error } = await this.client
      .from(this.mapping.table)
      .insert(this.mapping.toRow(input as Partial<T>))
      .select('*')
      .single();
    if (error) fail(error, `insert ${this.mapping.table}`);
    return this.mapping.fromRow(data as Row);
  }

  async update(id: string, patch: EntityPatch<T>): Promise<T> {
    const { data, error } = await this.client
      .from(this.mapping.table)
      .update(this.mapping.toRow(patch as Partial<T>))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) fail(error, `update ${this.mapping.table}`);
    if (!data) throw new NotFoundError();
    return this.mapping.fromRow(data as Row);
  }

  async delete(id: string): Promise<void> {
    const { error, count } = await this.client.from(this.mapping.table).delete({ count: 'exact' }).eq('id', id);
    if (error) fail(error, `delete ${this.mapping.table}`);
    if (!count) throw new NotFoundError();
  }
}

class SupabaseCustomers extends SupabaseTable<Customer> {
  async findByWhatsapp(whatsapp: string): Promise<Customer | null> {
    const { data, error } = await this.client.from('customers').select('*').eq('whatsapp', whatsapp).maybeSingle();
    if (error) fail(error, 'find customer by whatsapp');
    return data ? this.mapping.fromRow(data as Row) : null;
  }
}

const APPOINTMENT_SELECT = '*, appointment_services(*), appointment_addons(*)';

class SupabaseAppointments implements AppointmentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filter: AppointmentFilter = {}) {
    let query = this.client.from('appointments').select(APPOINTMENT_SELECT);
    if (filter.from) query = query.gte('date', filter.from);
    if (filter.to) query = query.lte('date', filter.to);
    if (filter.status) query = query.eq('status', filter.status);
    if (filter.customerId) query = query.eq('customer_id', filter.customerId);
    if (filter.petId) query = query.eq('pet_id', filter.petId);
    if (filter.professionalId) query = query.eq('professional_id', filter.professionalId);
    if (filter.serviceId) {
      const { data, error } = await this.client.from('appointment_services').select('appointment_id').eq('service_id', filter.serviceId);
      if (error) fail(error, 'filter by service');
      const ids = [...new Set((data as Row[]).map((r) => String(r.appointment_id)))];
      if (!ids.length) return [];
      query = query.in('id', ids);
    }
    const { data, error } = await query.order('date').order('start_time');
    if (error) fail(error, 'list appointments');
    return (data as Row[]).map(appointmentFromRow);
  }

  async findById(id: string) {
    const { data, error } = await this.client.from('appointments').select(APPOINTMENT_SELECT).eq('id', id).maybeSingle();
    if (error) fail(error, 'find appointment');
    return data ? appointmentFromRow(data as Row) : null;
  }

  async listOccupying(from: string, to: string) {
    const { data, error } = await this.client
      .from('appointments')
      .select('id, date, start_time, duration_minutes, status, professional_id')
      .gte('date', from)
      .lte('date', to)
      .not('status', 'in', `(${NON_BLOCKING_STATUSES.join(',')})`);
    if (error) fail(error, 'list occupying');
    return (data as Row[])
      .map((r) => ({
        id: String(r.id),
        date: String(r.date),
        time: String(r.start_time).slice(0, 5),
        durationMinutes: Number(r.duration_minutes),
        status: r.status as NewAppointment['status'],
        professionalId: (r.professional_id as string | null) ?? null,
      }))
      .filter((a) => isBlockingStatus(a.status));
  }

  /** Inserção atômica via função SQL `create_appointment_v2` (lock por data + checagem de capacidade). */
  async create(input: NewAppointment, guard: CapacityGuard) {
    const { data, error } = await this.client.rpc('create_appointment_v2', {
      p_appointment: appointmentToRow(input),
      p_services: serviceItemsToJson(input.services),
      p_addons: addonItemsToJson(input.addons),
      p_capacity: guard.capacity,
      p_professional_id: guard.professionalId ?? null,
    });
    if (error) fail(error, 'create appointment');
    const created = await this.findById(String(data));
    if (!created) throw new InfrastructureError('Agendamento criado mas não encontrado.');
    return created;
  }

  async update(id: string, patch: AppointmentPatch, guard: CapacityGuard | null) {
    const { error } = await this.client.rpc('update_appointment', {
      p_id: id,
      p_patch: appointmentToRow(patch),
      p_services: patch.services ? serviceItemsToJson(patch.services) : null,
      p_addons: patch.addons ? addonItemsToJson(patch.addons) : null,
      p_capacity: guard?.capacity ?? null,
    });
    if (error) fail(error, 'update appointment');
    const updated = await this.findById(id);
    if (!updated) throw new NotFoundError('Agendamento não encontrado.');
    return updated;
  }

  private async countRefs(table: string, column: string, id: string) {
    const { count, error } = await this.client.from(table).select('id', { count: 'exact', head: true }).eq(column, id);
    if (error) fail(error, `count ${table}`);
    return count ?? 0;
  }

  countByService(serviceId: string) {
    return this.countRefs('appointment_services', 'service_id', serviceId);
  }

  countByAddon(addonId: string) {
    return this.countRefs('appointment_addons', 'addon_id', addonId);
  }

  countByInspiration(inspirationId: string) {
    return this.countRefs('appointments', 'inspiration_id', inspirationId);
  }

  countByProfessional(professionalId: string) {
    return this.countRefs('appointments', 'professional_id', professionalId);
  }
}

class SupabaseStories extends SupabaseTable<Story> {
  async listActive(nowIso: string) {
    const { data, error } = await this.client.from('stories').select('*').gt('expires_at', nowIso).order('created_at');
    if (error) fail(error, 'list active stories');
    return (data as Row[]).map(this.mapping.fromRow);
  }
  async listExpired(nowIso: string) {
    const { data, error } = await this.client.from('stories').select('*').lte('expires_at', nowIso);
    if (error) fail(error, 'list expired stories');
    return (data as Row[]).map(this.mapping.fromRow);
  }
}

export class SupabaseDatabase implements DatabaseService {
  readonly provider = 'supabase' as const;
  private readonly client: SupabaseClient;

  species;
  breeds;
  sizes;
  services;
  servicePrices;
  addons;
  customers;
  pets;
  appointments;
  businessHours;
  blockedDates;
  blockedTimes;
  integrationLogs;
  professionals;
  inspirations;
  stories;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.species = new SupabaseTable(this.client, speciesMapping);
    this.breeds = new SupabaseTable(this.client, breedMapping);
    this.sizes = new SupabaseTable(this.client, sizeMapping);
    this.services = new SupabaseTable(this.client, serviceMapping);
    this.servicePrices = new SupabaseTable(this.client, servicePriceMapping);
    this.addons = new SupabaseTable(this.client, addonMapping);
    this.customers = new SupabaseCustomers(this.client, customerMapping);
    this.pets = new SupabaseTable(this.client, petMapping);
    this.appointments = new SupabaseAppointments(this.client);
    this.businessHours = new SupabaseTable(this.client, businessHoursMapping);
    this.blockedDates = new SupabaseTable(this.client, blockedDateMapping);
    this.blockedTimes = new SupabaseTable(this.client, blockedTimeMapping);
    this.integrationLogs = new SupabaseTable(this.client, integrationLogMapping);
    this.professionals = new SupabaseTable(this.client, professionalMapping);
    this.inspirations = new SupabaseTable(this.client, inspirationMapping);
    this.stories = new SupabaseStories(this.client, storyMapping);
  }

  /** Cliente com service role — usado também pelo armazenamento de mídia (Supabase Storage). */
  get rawClient(): SupabaseClient {
    return this.client;
  }

  settings = {
    get: async () => {
      const { data, error } = await this.client.from('business_settings').select('*').eq('id', 1).single();
      if (error) fail(error, 'get settings');
      return settingsFromRow(data as Row);
    },
    update: async (patch: Parameters<DatabaseService['settings']['update']>[0]) => {
      const { data, error } = await this.client
        .from('business_settings')
        .update(settingsToRow(patch))
        .eq('id', 1)
        .select('*')
        .single();
      if (error) fail(error, 'update settings');
      return settingsFromRow(data as Row);
    },
  };

  formFields = {
    list: async () => {
      const { data, error } = await this.client.from('form_options').select('*').order('sort_order');
      if (error) fail(error, 'list form options');
      return (data as Row[]).map(formFieldFromRow);
    },
    upsertMany: async (fields: Parameters<DatabaseService['formFields']['upsertMany']>[0]) => {
      const { error } = await this.client.from('form_options').upsert(fields.map(formFieldToRow), { onConflict: 'key' });
      if (error) fail(error, 'upsert form options');
      return this.formFields.list();
    },
  };

  admins = {
    findByUserId: async (userId: string): Promise<AdminRecord | null> => {
      const { data, error } = await this.client
        .from('admins')
        .select('user_id, role, active, users(email, name)')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) fail(error, 'find admin');
      if (!data) return null;
      const r = data as unknown as Row & { users: Row | null };
      return {
        userId: String(r.user_id),
        role: r.role as AdminRecord['role'],
        active: Boolean(r.active),
        email: String(r.users?.email ?? ''),
        name: String(r.users?.name ?? ''),
      };
    },
  };

  async healthCheck() {
    const { error } = await this.client.from('business_settings').select('id').limit(1);
    return !error;
  }
}
