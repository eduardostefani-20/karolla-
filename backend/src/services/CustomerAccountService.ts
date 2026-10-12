import { randomUUID } from 'node:crypto';
import {
  ageInMonths,
  CUSTOMER_DEFAULTS,
  nowInTimezone,
  PET_DEFAULTS,
  type accountPetSchema,
  type accountPetUpdateSchema,
  type accountProfileSchema,
  type accountSignupSchema,
  type Customer,
  type CustomerAccount,
  type CustomerSession,
  type Pet,
  type PetReference,
  type PortalAppointment,
  type PortalCustomer,
  type PortalPet,
  type PortalReference,
  type privateUploadSchema,
  type SignUpResponse,
  type UploadTicket,
} from '@karolla/shared';
import type { z } from 'zod';
import type { AuthIdentity, AuthService, AuthTokens } from '../integrations/auth/AuthService';
import { EXTENSIONS } from '../integrations/storage/MediaStorage';
import type { PrivateStorage } from '../integrations/storage/PrivateStorage';
import type { DatabaseService } from '../repositories/types';
import type { Clock } from '../utils/clock';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { errorMeta, logger } from '../utils/logger';

/** Cadastro sem vínculo automático: a equipe precisa confirmar (ver painel → ficha do cliente). */
export const PENDING_MESSAGE =
  'Sua conta foi criada, mas não conseguimos ligá-la automaticamente ao seu cadastro na Karolla Pet. Fale com a gente pelo WhatsApp para liberarmos o acesso.';

/** Caminho dos arquivos privados de um pet. */
export const petFolder = (customerId: string, petId: string) => `clientes/${customerId}/pets/${petId}/`;

export function newPrivatePath(customerId: string, petId: string, kind: 'pet-photo' | 'pet-reference', contentType: string) {
  return `${petFolder(customerId, petId)}${kind === 'pet-photo' ? 'foto' : 'referencias'}/${randomUUID()}.${EXTENSIONS[contentType] ?? 'jpg'}`;
}

/** Link temporário de cada referência + foto do pet. */
export async function signPetFiles(storage: PrivateStorage, pet: Pet, refs: PetReference[]) {
  const urls = await storage.signedUrls([pet.photoPath, ...refs.map((r) => r.path)]);
  const references: PortalReference[] = refs
    .filter((r) => urls.has(r.path))
    .map((r) => ({ id: r.id, description: r.description, url: urls.get(r.path)!, appointmentId: r.appointmentId, createdAt: r.createdAt }));
  return { photoUrl: pet.photoPath ? (urls.get(pet.photoPath) ?? null) : null, references };
}

/**
 * Portal do cliente. Regras de privacidade:
 *  - todo acesso parte do token → identidade → cadastro VINCULADO; ids vindos da URL só são aceitos
 *    se pertencerem a esse cadastro (senão "não encontrado");
 *  - a conta só é ligada automaticamente a um cadastro existente por E-MAIL CONFIRMADO;
 *  - observações internas da equipe nunca saem para o cliente.
 */
export class CustomerAccountService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthService,
    private readonly storage: PrivateStorage,
    private readonly clock: Clock,
  ) {}

  // ------------------------------------------------------------ conta

  async signUp(input: z.output<typeof accountSignupSchema>, redirectTo: string): Promise<SignUpResponse> {
    const result = await this.auth.signUp({
      email: input.email,
      password: input.password,
      name: input.name,
      metadata: { whatsapp: input.whatsapp },
      redirectTo,
    });
    if (result.needsConfirmation || !result.tokens) return { needsConfirmation: true, session: null };
    return { needsConfirmation: false, session: await this.session(result.identity, result.tokens) };
  }

  async login(email: string, password: string): Promise<CustomerSession> {
    const { identity, tokens } = await this.auth.signIn(email, password);
    return this.session(identity, tokens);
  }

  async refresh(refreshToken: string): Promise<CustomerSession> {
    const { identity, tokens } = await this.auth.refresh(refreshToken);
    return this.session(identity, tokens);
  }

  private async session(identity: AuthIdentity, tokens: AuthTokens): Promise<CustomerSession> {
    return { token: tokens.token, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt, account: await this.account(identity) };
  }

  /**
   * Cadastro do cliente ligado à conta. Primeiro acesso: liga a um cadastro existente com o MESMO e-mail
   * confirmado; sem cadastro, cria um novo com o WhatsApp informado (se ainda não estiver em uso).
   * Qualquer outro caso fica pendente para a equipe confirmar — nunca liga por WhatsApp (não verificado).
   */
  async resolve(identity: AuthIdentity): Promise<Customer | null> {
    const linked = await this.db.customers.findByUserId(identity.userId);
    if (linked) {
      if (identity.emailConfirmed && identity.email && linked.email.toLowerCase() !== identity.email.toLowerCase()) {
        return this.db.customers.update(linked.id, { email: identity.email });
      }
      return linked;
    }
    if (!identity.emailConfirmed) return null;
    const candidates = await this.db.customers.findUnlinkedByEmail(identity.email);
    try {
      if (candidates.length === 1) return await this.db.customers.update(candidates[0]!.id, { userId: identity.userId });
      if (candidates.length > 1 || !identity.whatsapp) return null;
      if (await this.db.customers.findByWhatsapp(identity.whatsapp)) return null;
      return await this.db.customers.create({
        ...CUSTOMER_DEFAULTS,
        userId: identity.userId,
        name: identity.name || identity.email,
        whatsapp: identity.whatsapp,
        email: identity.email,
        address: { street: '', number: '', complement: '', neighborhood: '', city: '' },
        notes: '',
      });
    } catch (err) {
      // corrida (dois acessos ao mesmo tempo): o índice único garante um cadastro só
      if (err instanceof ConflictError) return this.db.customers.findByUserId(identity.userId);
      throw err;
    }
  }

  async account(identity: AuthIdentity): Promise<CustomerAccount> {
    const customer = await this.resolve(identity);
    return {
      email: identity.email,
      name: customer?.name ?? identity.name,
      status: customer ? 'linked' : 'pending',
      customer: customer ? toPortalCustomer(customer) : null,
    };
  }

  async updateProfile(customer: Customer, input: z.output<typeof accountProfileSchema>): Promise<PortalCustomer> {
    if (input.whatsapp && input.whatsapp !== customer.whatsapp) {
      const other = await this.db.customers.findByWhatsapp(input.whatsapp);
      if (other && other.id !== customer.id) {
        throw new ConflictError('DUPLICATED', 'Este WhatsApp já está em outro cadastro. Fale com a Karolla Pet para unificar.');
      }
    }
    const updated = await this.db.customers.update(customer.id, {
      name: input.name,
      whatsapp: input.whatsapp,
      address: input.address,
      marketingOptOut: input.marketingOptOut,
    });
    if (input.name && updated.userId) await this.auth.updateProfile(updated.userId, { name: input.name }).catch((e) => logger.warn('Nome não sincronizado', errorMeta(e)));
    return toPortalCustomer(updated);
  }

  async requestEmailChange(token: string, email: string, redirectTo: string): Promise<void> {
    await this.auth.requestEmailChange(token, email, redirectTo);
  }

  // ------------------------------------------------------------ pets

  private async ownedPet(customer: Customer, petId: string): Promise<Pet> {
    const pet = await this.db.pets.findById(petId);
    if (!pet || pet.customerId !== customer.id) throw new NotFoundError('Pet não encontrado.');
    return pet;
  }

  private async toPortalPet(pet: Pet): Promise<PortalPet> {
    const refs = await this.db.petReferences.list({ petId: pet.id });
    const { photoUrl, references } = await signPetFiles(this.storage, pet, refs);
    const { internalNotes: _internal, photoPath: _photo, ...visible } = pet;
    return { ...visible, photoUrl, references };
  }

  async listPets(customer: Customer): Promise<PortalPet[]> {
    const pets = await this.db.pets.list({ customerId: customer.id });
    return Promise.all(pets.map((p) => this.toPortalPet(p)));
  }

  async getPet(customer: Customer, petId: string): Promise<PortalPet> {
    return this.toPortalPet(await this.ownedPet(customer, petId));
  }

  private async petFields(input: Partial<z.output<typeof accountPetSchema>>, current?: Pet) {
    const speciesId = input.speciesId ?? current?.speciesId;
    if (input.speciesId) {
      const species = await this.db.species.findById(input.speciesId);
      if (!species?.active) throw new ValidationError('Espécie indisponível.', { speciesId: 'Escolha uma espécie válida.' });
    }
    if (input.sizeId) {
      const size = await this.db.sizes.findById(input.sizeId);
      if (!size?.active) throw new ValidationError('Porte indisponível.', { sizeId: 'Escolha um porte válido.' });
    }
    let breedName = input.breedName;
    if (input.breedId) {
      const breed = await this.db.breeds.findById(input.breedId);
      if (!breed || !breed.active || breed.speciesId !== speciesId) throw new ValidationError('Raça inválida.', { breedId: 'Escolha uma raça da lista ou digite outra.' });
      breedName = breed.name;
    }
    const today = nowInTimezone(this.clock.now(), (await this.db.settings.get()).timezone).date;
    const ageMonths = input.birthDate ? ageInMonths(input.birthDate, today) : input.birthDate === null ? (current?.ageMonths ?? null) : undefined;
    return { ...input, breedName, ...(ageMonths !== undefined ? { ageMonths } : {}) };
  }

  async createPet(customer: Customer, input: z.output<typeof accountPetSchema>): Promise<PortalPet> {
    const count = (await this.db.pets.list({ customerId: customer.id })).length;
    if (count >= 30) throw new ValidationError('Limite de pets por cadastro atingido. Fale com a Karolla Pet.');
    const fields = await this.petFields(input);
    const pet = await this.db.pets.create({
      ...PET_DEFAULTS,
      customerId: customer.id,
      name: input.name,
      speciesId: input.speciesId,
      breedId: input.breedId,
      breedName: fields.breedName ?? input.breedName,
      sizeId: input.sizeId,
      weightKg: input.weightKg,
      ageMonths: fields.ageMonths ?? null,
      birthDate: input.birthDate,
      notes: input.notes,
      characteristics: input.characteristics,
      groomingPreferences: input.groomingPreferences,
    });
    return this.toPortalPet(pet);
  }

  async updatePet(customer: Customer, petId: string, input: z.output<typeof accountPetUpdateSchema>): Promise<PortalPet> {
    const current = await this.ownedPet(customer, petId);
    const fields = await this.petFields(input, current);
    return this.toPortalPet(await this.db.pets.update(petId, fields));
  }

  // ------------------------------------------------------------ fotos privadas

  async uploadTicket(customer: Customer, petId: string, input: z.output<typeof privateUploadSchema>): Promise<UploadTicket> {
    await this.ownedPet(customer, petId);
    if (input.kind === 'pet-reference') {
      const refs = await this.db.petReferences.list({ petId });
      if (refs.length >= 20) throw new ValidationError('Este pet já tem 20 fotos de referência. Apague alguma antes de enviar outra.');
    }
    return this.storage.createUploadTicket(newPrivatePath(customer.id, petId, input.kind, input.contentType), input.contentType, input.size);
  }

  /** O arquivo precisa estar na pasta do próprio pet E ter sido enviado de fato. */
  private async assertUploaded(customerId: string, petId: string, path: string, kind: 'foto' | 'referencias') {
    if (!path.startsWith(`${petFolder(customerId, petId)}${kind}/`) || path.includes('..')) throw new ForbiddenError('Arquivo inválido.');
    if (!(await this.storage.exists(path))) throw new ValidationError('A foto não chegou. Tente enviar de novo.');
  }

  async setPetPhoto(customer: Customer, petId: string, path: string): Promise<PortalPet> {
    const pet = await this.ownedPet(customer, petId);
    await this.assertUploaded(customer.id, petId, path, 'foto');
    const updated = await this.db.pets.update(petId, { photoPath: path });
    if (pet.photoPath && pet.photoPath !== path) await this.storage.remove(pet.photoPath);
    return this.toPortalPet(updated);
  }

  async addReference(customer: Customer, petId: string, input: { path: string; description: string; appointmentId: string | null }): Promise<PortalPet> {
    await this.ownedPet(customer, petId);
    await this.assertUploaded(customer.id, petId, input.path, 'referencias');
    if (input.appointmentId) {
      const appointment = await this.db.appointments.findById(input.appointmentId);
      if (!appointment || appointment.customerId !== customer.id || appointment.petId !== petId) throw new NotFoundError('Agendamento não encontrado.');
    }
    await this.db.petReferences.create({ petId, customerId: customer.id, path: input.path, description: input.description, appointmentId: input.appointmentId, uploadedBy: 'customer' });
    return this.getPet(customer, petId);
  }

  async removeReference(customer: Customer, referenceId: string): Promise<void> {
    const ref = await this.db.petReferences.findById(referenceId);
    if (!ref || ref.customerId !== customer.id) throw new NotFoundError('Foto não encontrada.');
    await this.db.petReferences.delete(ref.id);
    await this.storage.remove(ref.path);
  }

  // ------------------------------------------------------------ histórico

  async appointments(customer: Customer): Promise<PortalAppointment[]> {
    const [rows, pets, professionals] = await Promise.all([
      this.db.appointments.list({ customerId: customer.id }),
      this.db.pets.list({ customerId: customer.id }),
      this.db.professionals.list(),
    ]);
    const petNames = new Map(pets.map((p) => [p.id, p.name]));
    const proNames = new Map(professionals.map((p) => [p.id, p.name]));
    return rows
      .map(({ notes: _notes, attribution: _attribution, ...a }) => ({
        ...a,
        petName: petNames.get(a.petId) ?? '',
        professionalName: a.professionalId ? (proNames.get(a.professionalId) ?? null) : null,
      }))
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  }
}

export function toPortalCustomer(c: Customer): PortalCustomer {
  const { notes: _notes, userId: _userId, ...visible } = c;
  return visible;
}
