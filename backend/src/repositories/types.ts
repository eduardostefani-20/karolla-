import type {
  AdminRole,
  AuditLog,
  PermissionSet,
  Addon,
  Appointment,
  AppointmentAddonItem,
  AppointmentServiceItem,
  AppointmentStatus,
  Breed,
  BlockedDate,
  BlockedTime,
  BusinessHours,
  BusinessSettings,
  ContactLog,
  Customer,
  FormFieldConfig,
  IntegrationLog,
  Inspiration,
  OccupiedSlot,
  Professional,
  Story,
  Pet,
  PetReference,
  PetSize,
  Service,
  ServicePrice,
  Species,
} from '@karolla/shared';

/**
 * DatabaseService — contrato de persistência.
 *
 * Implementações:
 *  - MemoryDatabase   (modo DEMO; dados fictícios, reiniciam a cada execução)
 *  - SupabaseDatabase (PRODUÇÃO; PostgreSQL + RLS no Supabase)
 *
 * Serviços de negócio dependem apenas desta interface — trocar de banco não altera regras.
 */

export type NewEntity<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
export type EntityPatch<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

export interface TableRepository<T extends { id: string }> {
  /** Filtro por igualdade em campos simples. Ordenado por `sortOrder` (quando existir) ou criação. */
  list(filter?: Partial<T>): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  create(data: NewEntity<T>): Promise<T>;
  /** Lança NotFoundError se o registro não existir. */
  update(id: string, patch: EntityPatch<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

export interface AppointmentFilter {
  from?: string;
  to?: string;
  status?: AppointmentStatus;
  customerId?: string;
  petId?: string;
  serviceId?: string;
  professionalId?: string;
}

export interface NewAppointment {
  customerId: string;
  petId: string;
  sizeId: string;
  date: string;
  time: string;
  durationMinutes: number;
  totalCents: number;
  status: AppointmentStatus;
  notes: string;
  customerNotes: string;
  source: Appointment['source'];
  professionalId: string | null;
  inspiration: Appointment['inspiration'];
  attribution: Appointment['attribution'];
  services: AppointmentServiceItem[];
  addons: AppointmentAddonItem[];
}

export type AppointmentPatch = Partial<Omit<NewAppointment, 'customerId' | 'petId' | 'source' | 'inspiration' | 'attribution'>>;

/**
 * Garantia de não-sobreposição aplicada NO MOMENTO DA GRAVAÇÃO.
 * O repositório deve rejeitar (SlotConflictError) se o novo intervalo ultrapassar
 * `capacity` atendimentos simultâneos — de forma atômica (lock/transação).
 */
export interface CapacityGuard {
  /** Máximo de atendimentos simultâneos no pet shop (com profissionais: número de profissionais ativos). */
  capacity: number;
  /** Se definido, o profissional também não pode ter outro atendimento sobreposto. */
  professionalId?: string | null;
}

export interface AppointmentRepository {
  list(filter?: AppointmentFilter): Promise<Appointment[]>;
  findById(id: string): Promise<Appointment | null>;
  /** Agendamentos que ocupam agenda em um intervalo de datas (para cálculo de horários livres). */
  listOccupying(from: string, to: string): Promise<OccupiedSlot[]>;
  create(data: NewAppointment, guard: CapacityGuard): Promise<Appointment>;
  /** `guard` null = não revalidar agenda (ex.: mudança apenas de observações). */
  update(id: string, patch: AppointmentPatch, guard: CapacityGuard | null): Promise<Appointment>;
  countByService(serviceId: string): Promise<number>;
  countByAddon(addonId: string): Promise<number>;
  countByInspiration(inspirationId: string): Promise<number>;
  countByProfessional(professionalId: string): Promise<number>;
}

export interface StoryRepository extends TableRepository<Story> {
  /** Somente stories ainda válidos (expiresAt > agora), mais recentes por último. */
  listActive(nowIso: string): Promise<Story[]>;
  listExpired(nowIso: string): Promise<Story[]>;
}

export interface SettingsRepository {
  get(): Promise<BusinessSettings>;
  update(patch: Partial<BusinessSettings>): Promise<BusinessSettings>;
}

export interface FormFieldRepository {
  list(): Promise<FormFieldConfig[]>;
  upsertMany(fields: FormFieldConfig[]): Promise<FormFieldConfig[]>;
}

export interface CustomerRepository extends TableRepository<Customer> {
  findByWhatsapp(whatsapp: string): Promise<Customer | null>;
  findByUserId(userId: string): Promise<Customer | null>;
  /** Cadastros SEM conta vinculada com este e-mail (sem diferenciar maiúsculas). */
  findUnlinkedByEmail(email: string): Promise<Customer[]>;
}

export interface AdminRecord {
  userId: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  /** null = permissões do perfil. */
  customPermissions: PermissionSet | null;
  professionalId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export type AdminPatch = Partial<Pick<AdminRecord, 'name' | 'role' | 'active' | 'customPermissions' | 'professionalId'>>;

export interface AdminRepository {
  findByUserId(userId: string): Promise<AdminRecord | null>;
  list(): Promise<AdminRecord[]>;
  create(record: Omit<AdminRecord, 'createdAt' | 'lastLoginAt'>): Promise<AdminRecord>;
  update(userId: string, patch: AdminPatch): Promise<AdminRecord>;
  touchLogin(userId: string, at: string): Promise<void>;
}

export interface AuditRepository {
  create(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void>;
  list(filter: { limit: number; actorId?: string; entity?: string }): Promise<AuditLog[]>;
}

export interface DatabaseService {
  readonly provider: 'memory' | 'supabase';
  species: TableRepository<Species>;
  breeds: TableRepository<Breed>;
  sizes: TableRepository<PetSize>;
  services: TableRepository<Service>;
  servicePrices: TableRepository<ServicePrice>;
  addons: TableRepository<Addon>;
  customers: CustomerRepository;
  pets: TableRepository<Pet>;
  petReferences: TableRepository<PetReference>;
  contacts: TableRepository<ContactLog>;
  appointments: AppointmentRepository;
  businessHours: TableRepository<BusinessHours>;
  blockedDates: TableRepository<BlockedDate>;
  blockedTimes: TableRepository<BlockedTime>;
  settings: SettingsRepository;
  formFields: FormFieldRepository;
  integrationLogs: TableRepository<IntegrationLog>;
  professionals: TableRepository<Professional>;
  inspirations: TableRepository<Inspiration>;
  stories: StoryRepository;
  admins: AdminRepository;
  audit: AuditRepository;
  /** false = migração mais recente do banco ainda não aplicada (portal, CRM e fotos ficam desativados). */
  featuresReady(): Promise<boolean>;
  healthCheck(): Promise<boolean>;
}
