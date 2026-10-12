import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';
import { isBlockingStatus, NON_BLOCKING_STATUSES, type AuditLog, type Customer, type PermissionSet, type Story } from '@karolla/shared';
import { InfrastructureError, NotFoundError, SlotConflictError, ConflictError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import type {
  AdminPatch,
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
  contactLogMapping,
  petReferenceMapping,
  formFieldFromRow,
  formFieldToRow,
  integrationLogMapping,
  inspirationMapping,
  petMapping,
  professionalMapping,
  professionalTimeOffMapping,
  planMapping,
  customerPlanMapping,
  planPaymentMapping,
  planUsageMapping,
  planEventMapping,
  storyMapping,
  serviceItemsToJson,
  serviceMapping,
  servicePriceMapping,
  settingsFromRow,
  SETTINGS_OPTIONAL_COLUMNS,
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

/** Coluna ainda inexistente no banco (migração pendente). */
const isMissingColumn = (e: PostgrestError) => e.code === 'PGRST204' || e.code === '42703';
/** Tabela ainda inexistente no banco (migração pendente). */
const isMissingTable = (e: PostgrestError) => e.code === 'PGRST205' || e.code === '42P01';

function without(row: Row, columns: string[] = []): Row {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !columns.includes(k)));
}

let warnedPending = false;
function warnPending(table: string) {
  if (warnedPending) return;
  warnedPending = true;
  logger.warn(`Migração do banco pendente (${table}): recursos novos ficam desativados até aplicar database/migrations.`);
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
    if (error && this.mapping.optionalTable && isMissingTable(error)) {
      warnPending(this.mapping.table);
      return [];
    }
    if (error) fail(error, `list ${this.mapping.table}`);
    return (data as Row[]).map(this.mapping.fromRow);
  }

  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.client.from(this.mapping.table).select('*').eq('id', id).maybeSingle();
    if (error && this.mapping.optionalTable && isMissingTable(error)) return null;
    if (error) fail(error, `find ${this.mapping.table}`);
    return data ? this.mapping.fromRow(data as Row) : null;
  }

  /** Grava; se o banco ainda não tiver as colunas novas (migração pendente), grava sem elas. */
  private async write<R>(row: Row, run: (row: Row) => PromiseLike<{ data: R; error: PostgrestError | null }>, context: string): Promise<R> {
    let { data, error } = await run(row);
    if (error && isMissingColumn(error) && this.mapping.optionalColumns?.length) {
      warnPending(this.mapping.table);
      ({ data, error } = await run(without(row, this.mapping.optionalColumns)));
    }
    if (error) fail(error, context);
    return data;
  }

  async create(input: NewEntity<T>): Promise<T> {
    const data = await this.write(
      this.mapping.toRow(input as Partial<T>),
      (row) => this.client.from(this.mapping.table).insert(row).select('*').single(),
      `insert ${this.mapping.table}`,
    );
    return this.mapping.fromRow(data as Row);
  }

  async update(id: string, patch: EntityPatch<T>): Promise<T> {
    const data = await this.write(
      this.mapping.toRow(patch as Partial<T>),
      (row) => this.client.from(this.mapping.table).update(row).eq('id', id).select('*').maybeSingle(),
      `update ${this.mapping.table}`,
    );
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
  async findByUserId(userId: string): Promise<Customer | null> {
    const { data, error } = await this.client.from('customers').select('*').eq('user_id', userId).maybeSingle();
    if (error) fail(error, 'find customer by user');
    return data ? customerMapping.fromRow(data as Row) : null;
  }

  async findUnlinkedByEmail(email: string): Promise<Customer[]> {
    // ilike sem curingas: compara sem diferenciar maiúsculas (escapa % e _ do e-mail)
    const pattern = email.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data, error } = await this.client.from('customers').select('*').is('user_id', null).ilike('email', pattern);
    if (error) fail(error, 'find customers by email');
    return (data as Row[]).map((r) => customerMapping.fromRow(r));
  }

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
      .select('id, date, start_time, duration_minutes, status, professional_id, appointment_services(service_id)')
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
        serviceIds: ((r.appointment_services as Row[] | null) ?? []).map((s) => String(s.service_id)),
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
    if (input.origin || input.createdByName) {
      const { error: originError } = await this.client
        .from('appointments')
        .update({ origin: input.origin, created_by_name: input.createdByName })
        .eq('id', String(data));
      if (originError && !isMissingColumn(originError)) fail(originError, 'set appointment origin');
    }
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
  petReferences;
  contacts;
  appointments;
  businessHours;
  blockedDates;
  blockedTimes;
  integrationLogs;
  professionals;
  professionalTimeOff;
  plans;
  customerPlans;
  planPayments;
  planUsages;
  planEvents;
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
    this.petReferences = new SupabaseTable(this.client, petReferenceMapping);
    this.contacts = new SupabaseTable(this.client, contactLogMapping);
    this.appointments = new SupabaseAppointments(this.client);
    this.businessHours = new SupabaseTable(this.client, businessHoursMapping);
    this.blockedDates = new SupabaseTable(this.client, blockedDateMapping);
    this.blockedTimes = new SupabaseTable(this.client, blockedTimeMapping);
    this.integrationLogs = new SupabaseTable(this.client, integrationLogMapping);
    this.professionals = new SupabaseTable(this.client, professionalMapping);
    this.professionalTimeOff = new SupabaseTable(this.client, professionalTimeOffMapping);
    this.plans = new SupabaseTable(this.client, planMapping);
    this.customerPlans = new SupabaseTable(this.client, customerPlanMapping);
    this.planPayments = new SupabaseTable(this.client, planPaymentMapping);
    this.planUsages = new SupabaseTable(this.client, planUsageMapping);
    this.planEvents = new SupabaseTable(this.client, planEventMapping);
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
      const run = (row: Row) => this.client.from('business_settings').update(row).eq('id', 1).select('*').single();
      let { data, error } = await run(settingsToRow(patch));
      if (error && isMissingColumn(error)) {
        warnPending('business_settings');
        ({ data, error } = await run(without(settingsToRow(patch), SETTINGS_OPTIONAL_COLUMNS)));
      }
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

  private adminFromRow(r: Row & { users?: Row | null }): AdminRecord {
    const perms = r.permissions as PermissionSet | null;
    return {
      userId: String(r.user_id),
      role: r.role as AdminRecord['role'],
      active: Boolean(r.active),
      email: String(r.users?.email ?? ''),
      name: String(r.users?.name ?? ''),
      customPermissions: perms && Array.isArray(perms.grants) ? perms : null,
      professionalId: (r.professional_id as string | null) ?? null,
      lastLoginAt: (r.last_login_at as string | null) ?? null,
      createdAt: String(r.created_at ?? ''),
    };
  }

  admins = {
    findByUserId: async (userId: string): Promise<AdminRecord | null> => {
      const { data, error } = await this.client.from('admins').select('*, users(email, name)').eq('user_id', userId).maybeSingle();
      if (error) fail(error, 'find admin');
      return data ? this.adminFromRow(data as Row) : null;
    },
    list: async (): Promise<AdminRecord[]> => {
      const { data, error } = await this.client.from('admins').select('*, users(email, name)').order('created_at');
      if (error) fail(error, 'list admins');
      return (data as Row[]).map((r) => this.adminFromRow(r));
    },
    create: async (record: Omit<AdminRecord, 'createdAt' | 'lastLoginAt'>): Promise<AdminRecord> => {
      // public.users é criado pelo gatilho on_auth_user_created; garante o nome atualizado
      await this.client.from('users').update({ name: record.name }).eq('id', record.userId);
      const { data, error } = await this.client
        .from('admins')
        .insert({
          user_id: record.userId,
          role: record.role,
          active: record.active,
          permissions: record.customPermissions,
          professional_id: record.professionalId,
        })
        .select('*, users(email, name)')
        .single();
      if (error) fail(error, 'insert admin');
      return this.adminFromRow(data as Row);
    },
    update: async (userId: string, patch: AdminPatch): Promise<AdminRecord> => {
      if (patch.name !== undefined) {
        const { error } = await this.client.from('users').update({ name: patch.name }).eq('id', userId);
        if (error) fail(error, 'update user name');
      }
      const row: Row = {};
      if (patch.role !== undefined) row.role = patch.role;
      if (patch.active !== undefined) row.active = patch.active;
      if (patch.customPermissions !== undefined) row.permissions = patch.customPermissions;
      if (patch.professionalId !== undefined) row.professional_id = patch.professionalId;
      const query = Object.keys(row).length
        ? this.client.from('admins').update(row).eq('user_id', userId).select('*, users(email, name)').maybeSingle()
        : this.client.from('admins').select('*, users(email, name)').eq('user_id', userId).maybeSingle();
      const { data, error } = await query;
      if (error) fail(error, 'update admin');
      if (!data) throw new NotFoundError('Conta não encontrada.');
      return this.adminFromRow(data as Row);
    },
    touchLogin: async (userId: string, at: string) => {
      await this.client.from('admins').update({ last_login_at: at }).eq('user_id', userId);
    },
  };

  audit = {
    create: async (entry: Omit<AuditLog, 'id' | 'createdAt'>) => {
      const { error } = await this.client.from('audit_logs').insert({
        actor_id: entry.actorId,
        actor_email: entry.actorEmail,
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entityId,
        status: entry.status,
      });
      if (error) fail(error, 'insert audit');
    },
    list: async (filter: { limit: number; actorId?: string; entity?: string }): Promise<AuditLog[]> => {
      let query = this.client.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(filter.limit);
      if (filter.actorId) query = query.eq('actor_id', filter.actorId);
      if (filter.entity) query = query.eq('entity', filter.entity);
      const { data, error } = await query;
      if (error) fail(error, 'list audit');
      return (data as Row[]).map((r) => ({
        id: String(r.id),
        actorId: (r.actor_id as string | null) ?? null,
        actorEmail: String(r.actor_email ?? ''),
        action: String(r.action),
        entity: String(r.entity),
        entityId: (r.entity_id as string | null) ?? null,
        status: Number(r.status),
        createdAt: String(r.created_at),
      }));
    },
  };

  private features = new Map<number, { ok: boolean; at: number }>();

  /** A migração indicada já foi aplicada? Fica em cache; enquanto não, reconfere a cada minuto. */
  async featuresReady(level: 9 | 10 = 9): Promise<boolean> {
    const cached = this.features.get(level);
    if (cached && (cached.ok || Date.now() - cached.at < 60_000)) return cached.ok;
    const probes =
      level === 9
        ? [this.client.from('business_settings').select('crm_inactive_days').limit(1), this.client.from('contact_logs').select('id').limit(1)]
        : [this.client.from('business_settings').select('pickup_message').limit(1), this.client.from('plans').select('id').limit(1)];
    const results = await Promise.all(probes);
    const ok = results.every((r) => !r.error) && (level === 9 || (await this.featuresReady(9)));
    this.features.set(level, { ok, at: Date.now() });
    if (!ok) warnPending(`migração ${level === 9 ? '0009' : '0010'}`);
    return ok;
  }

  async healthCheck() {
    const { error } = await this.client.from('business_settings').select('id').limit(1);
    return !error;
  }
}
