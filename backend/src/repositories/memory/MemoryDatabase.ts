import { randomUUID } from 'node:crypto';
import {
  isBlockingStatus,
  maxConcurrentInInterval,
  timeToMinutes,
  type Appointment,
  type BusinessSettings,
  type Customer,
  type FormFieldConfig,
  type Story,
} from '@karolla/shared';
import { NotFoundError, SlotConflictError } from '../../utils/errors';
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

/**
 * ⚠️ MODO DEMO — banco em memória.
 * Os dados são fictícios e se perdem ao reiniciar o servidor. Nunca usar em produção
 * (o carregamento de configuração impede APP_MODE=production com este provider).
 */

const clone = <T>(v: T): T => structuredClone(v);
const nowIso = () => new Date().toISOString();

type WithId = { id: string; sortOrder?: number; createdAt?: string; updatedAt?: string };

export class MemoryTable<T extends WithId> implements TableRepository<T> {
  protected rows = new Map<string, T>();

  constructor(private readonly timestamps = false) {}

  async list(filter: Partial<T> = {}): Promise<T[]> {
    return this.listSync(filter);
  }

  listSync(filter: Partial<T> = {}): T[] {
    const entries = Object.entries(filter).filter(([, v]) => v !== undefined);
    const rows = [...this.rows.values()].filter((row) =>
      entries.every(([k, v]) => (row as Record<string, unknown>)[k] === v),
    );
    rows.sort((a, b) => {
      if (a.sortOrder != null && b.sortOrder != null && a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      if (a.createdAt && b.createdAt) return a.createdAt.localeCompare(b.createdAt);
      return 0;
    });
    return clone(rows);
  }

  async findById(id: string): Promise<T | null> {
    const row = this.rows.get(id);
    return row ? clone(row) : null;
  }

  async create(data: NewEntity<T>): Promise<T> {
    const id = data.id ?? randomUUID();
    const row = { ...data, id } as unknown as T;
    if (this.timestamps) {
      const ts = nowIso();
      Object.assign(row, { createdAt: ts, updatedAt: ts });
    }
    this.rows.set(id, clone(row));
    return clone(row);
  }

  async update(id: string, patch: EntityPatch<T>): Promise<T> {
    const current = this.rows.get(id);
    if (!current) throw new NotFoundError();
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const row = { ...current, ...defined, id } as T;
    if (this.timestamps) Object.assign(row, { updatedAt: nowIso() });
    this.rows.set(id, clone(row));
    return clone(row);
  }

  async delete(id: string): Promise<void> {
    if (!this.rows.delete(id)) throw new NotFoundError();
  }
}

class MemoryCustomers extends MemoryTable<Customer> {
  constructor() {
    super(true);
  }
  async findByWhatsapp(whatsapp: string): Promise<Customer | null> {
    return this.listSync({ whatsapp } as Partial<Customer>)[0] ?? null;
  }
}

class MemoryAppointments implements AppointmentRepository {
  private rows = new Map<string, Appointment>();

  async list(filter: AppointmentFilter = {}): Promise<Appointment[]> {
    const rows = [...this.rows.values()].filter(
      (a) =>
        (!filter.from || a.date >= filter.from) &&
        (!filter.to || a.date <= filter.to) &&
        (!filter.status || a.status === filter.status) &&
        (!filter.customerId || a.customerId === filter.customerId) &&
        (!filter.petId || a.petId === filter.petId) &&
        (!filter.professionalId || a.professionalId === filter.professionalId) &&
        (!filter.serviceId || a.services.some((s) => s.serviceId === filter.serviceId)),
    );
    rows.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return clone(rows);
  }

  async findById(id: string) {
    const row = this.rows.get(id);
    return row ? clone(row) : null;
  }

  async listOccupying(from: string, to: string) {
    return [...this.rows.values()]
      .filter((a) => a.date >= from && a.date <= to && isBlockingStatus(a.status))
      .map(({ id, date, time, durationMinutes, status, professionalId }) => ({ id, date, time, durationMinutes, status, professionalId }));
  }

  /** Verificação síncrona: em Node não há interrupção entre checagem e escrita (atômico). */
  private assertCapacity(date: string, time: string, duration: number, guard: CapacityGuard, excludeId?: string) {
    const start = timeToMinutes(time);
    const all = [...this.rows.values()];
    const concurrent = maxConcurrentInInterval(all, date, start, start + duration, excludeId);
    if (concurrent >= guard.capacity) throw new SlotConflictError();
    if (guard.professionalId) {
      const own = all.filter((a) => a.professionalId === guard.professionalId);
      if (maxConcurrentInInterval(own, date, start, start + duration, excludeId) > 0) throw new SlotConflictError();
    }
  }

  async create(data: NewAppointment, guard: CapacityGuard): Promise<Appointment> {
    if (isBlockingStatus(data.status)) this.assertCapacity(data.date, data.time, data.durationMinutes, guard);
    const ts = nowIso();
    const row: Appointment = { ...clone(data), id: randomUUID(), createdAt: ts, updatedAt: ts };
    this.rows.set(row.id, row);
    return clone(row);
  }

  async update(id: string, patch: AppointmentPatch, guard: CapacityGuard | null): Promise<Appointment> {
    const current = this.rows.get(id);
    if (!current) throw new NotFoundError('Agendamento não encontrado.');
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const next: Appointment = { ...current, ...clone(defined), id, updatedAt: nowIso() };
    if (guard && isBlockingStatus(next.status)) {
      this.assertCapacity(next.date, next.time, next.durationMinutes, { ...guard, professionalId: next.professionalId }, id);
    }
    this.rows.set(id, next);
    return clone(next);
  }

  async countByService(serviceId: string) {
    return [...this.rows.values()].filter((a) => a.services.some((s) => s.serviceId === serviceId)).length;
  }

  async countByAddon(addonId: string) {
    return [...this.rows.values()].filter((a) => a.addons.some((s) => s.addonId === addonId)).length;
  }

  async countByInspiration(inspirationId: string) {
    return [...this.rows.values()].filter((a) => a.inspiration?.id === inspirationId).length;
  }

  async countByProfessional(professionalId: string) {
    return [...this.rows.values()].filter((a) => a.professionalId === professionalId).length;
  }
}

class MemoryStories extends MemoryTable<Story> {
  constructor() {
    super(true);
  }
  async listActive(nowIso: string) {
    return this.listSync().filter((s) => s.expiresAt > nowIso).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async listExpired(nowIso: string) {
    return this.listSync().filter((s) => s.expiresAt <= nowIso);
  }
}

export class MemoryDatabase implements DatabaseService {
  readonly provider = 'memory' as const;
  species = new MemoryTable<import('@karolla/shared').Species>();
  breeds = new MemoryTable<import('@karolla/shared').Breed>();
  sizes = new MemoryTable<import('@karolla/shared').PetSize>();
  services = new MemoryTable<import('@karolla/shared').Service>();
  servicePrices = new MemoryTable<import('@karolla/shared').ServicePrice>();
  addons = new MemoryTable<import('@karolla/shared').Addon>();
  customers = new MemoryCustomers();
  pets = new MemoryTable<import('@karolla/shared').Pet>(true);
  appointments = new MemoryAppointments();
  businessHours = new MemoryTable<import('@karolla/shared').BusinessHours>();
  blockedDates = new MemoryTable<import('@karolla/shared').BlockedDate>();
  blockedTimes = new MemoryTable<import('@karolla/shared').BlockedTime>();
  integrationLogs = new MemoryTable<import('@karolla/shared').IntegrationLog>(true);
  professionals = new MemoryTable<import('@karolla/shared').Professional>();
  inspirations = new MemoryTable<import('@karolla/shared').Inspiration>(true);
  stories = new MemoryStories();

  private settingsRow: BusinessSettings;
  private formFieldRows = new Map<string, FormFieldConfig>();
  private adminRows = new Map<string, AdminRecord>();

  constructor(initialSettings: BusinessSettings) {
    this.settingsRow = clone(initialSettings);
  }

  settings = {
    get: async () => clone(this.settingsRow),
    update: async (patch: Partial<BusinessSettings>) => {
      this.settingsRow = { ...this.settingsRow, ...patch };
      return clone(this.settingsRow);
    },
  };

  formFields = {
    list: async () => clone([...this.formFieldRows.values()]),
    upsertMany: async (fields: FormFieldConfig[]) => {
      for (const f of fields) this.formFieldRows.set(f.key, clone(f));
      return clone([...this.formFieldRows.values()]);
    },
  };

  admins = {
    findByUserId: async (userId: string) => clone(this.adminRows.get(userId) ?? null),
  };

  addAdmin(record: AdminRecord) {
    this.adminRows.set(record.userId, record);
  }

  async healthCheck() {
    return true;
  }
}
