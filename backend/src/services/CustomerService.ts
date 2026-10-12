import {
  ageInMonths,
  nowInTimezone,
  type customerUpdateSchema,
  type petReferenceSchema,
  type petUpdateSchema,
  type privateUploadSchema,
  type CustomerDetail,
  type CustomerSummary,
  type PetDetail,
  type Pet,
  type UploadTicket,
} from '@karolla/shared';
import type { z } from 'zod';
import type { AuthService } from '../integrations/auth/AuthService';
import type { PrivateStorage } from '../integrations/storage/PrivateStorage';
import type { DatabaseService } from '../repositories/types';
import type { Clock } from '../utils/clock';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { newPrivatePath, petFolder, signPetFiles } from './CustomerAccountService';

/** Clientes (tutores) e pets, com histórico de atendimentos. */
export class CustomerService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthService,
    private readonly storage: PrivateStorage,
    private readonly clock: Clock,
  ) {}

  async listCustomers(search?: string): Promise<CustomerSummary[]> {
    const [customers, pets, appointments] = await Promise.all([this.db.customers.list(), this.db.pets.list(), this.db.appointments.list()]);
    const term = search?.trim().toLowerCase();
    return customers
      .filter((c) => !term || c.name.toLowerCase().includes(term) || c.whatsapp.includes(term.replace(/\D/g, '') || '§') || c.email.includes(term))
      .map((c) => {
        const own = appointments.filter((a) => a.customerId === c.id);
        return {
          ...c,
          petCount: pets.filter((p) => p.customerId === c.id).length,
          lastAppointmentDate: own.length ? own[own.length - 1]!.date : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async getCustomer(id: string): Promise<CustomerDetail> {
    const customer = await this.db.customers.findById(id);
    if (!customer) throw new NotFoundError('Cliente não encontrado.');
    const [pets, appointments, contacts, account] = await Promise.all([
      this.db.pets.list({ customerId: id }),
      this.db.appointments.list({ customerId: id }),
      this.db.contacts.list({ customerId: id }),
      customer.userId ? this.auth.findUserById(customer.userId) : Promise.resolve(null),
    ]);
    return {
      ...customer,
      pets,
      appointments: appointments.reverse(),
      contacts: contacts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      accountEmail: account?.email ?? null,
    };
  }

  async updateCustomer(id: string, input: z.output<typeof customerUpdateSchema>) {
    if (input.whatsapp) {
      const other = await this.db.customers.findByWhatsapp(input.whatsapp);
      if (other && other.id !== id) throw new ConflictError('DUPLICATED', 'Já existe outro cliente com este WhatsApp.');
    }
    await this.db.customers.update(id, input);
    return this.getCustomer(id);
  }

  async listPets(search?: string): Promise<(Pet & { customerName: string })[]> {
    const [pets, customers] = await Promise.all([this.db.pets.list(), this.db.customers.list()]);
    const names = new Map(customers.map((c) => [c.id, c.name]));
    const term = search?.trim().toLowerCase();
    return pets
      .map((p) => ({ ...p, customerName: names.get(p.customerId) ?? '' }))
      .filter((p) => !term || p.name.toLowerCase().includes(term) || p.customerName.toLowerCase().includes(term) || p.breedName.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async getPet(id: string): Promise<PetDetail> {
    const pet = await this.db.pets.findById(id);
    if (!pet) throw new NotFoundError('Pet não encontrado.');
    const [customer, appointments] = await Promise.all([this.db.customers.findById(pet.customerId), this.db.appointments.list({ petId: id })]);
    if (!customer) throw new NotFoundError('Tutor do pet não encontrado.');
    const refs = await this.db.petReferences.list({ petId: id });
    const { photoUrl, references } = await signPetFiles(this.storage, pet, refs);
    return { ...pet, customer, appointments: appointments.reverse(), photoUrl, references };
  }

  async updatePet(id: string, input: z.output<typeof petUpdateSchema>) {
    if (input.breedId) {
      const breed = await this.db.breeds.findById(input.breedId);
      if (!breed) throw new NotFoundError('Raça não encontrada.');
      input = { ...input, breedName: breed.name };
    }
    if (input.birthDate) {
      const today = nowInTimezone(this.clock.now(), (await this.db.settings.get()).timezone).date;
      input = { ...input, ageMonths: ageInMonths(input.birthDate, today) };
    }
    await this.db.pets.update(id, input);
    return this.getPet(id);
  }

  // ------------------------------------------------------------ conta do portal

  /** Liga manualmente a conta do portal (pelo e-mail do login) a este cadastro. */
  async linkAccount(customerId: string, email: string): Promise<CustomerDetail> {
    const customer = await this.db.customers.findById(customerId);
    if (!customer) throw new NotFoundError('Cliente não encontrado.');
    const identity = await this.auth.findUserByEmail(email);
    if (!identity) throw new NotFoundError('Nenhuma conta do portal com este e-mail. Peça para a pessoa criar a conta em "Minha conta".');
    const other = await this.db.customers.findByUserId(identity.userId);
    if (other && other.id !== customerId) throw new ConflictError('DUPLICATED', `Esta conta já está ligada ao cadastro de ${other.name}.`);
    await this.db.customers.update(customerId, { userId: identity.userId });
    return this.getCustomer(customerId);
  }

  /** Desfaz o vínculo (a conta continua existindo; o cadastro e o histórico não mudam). */
  async unlinkAccount(customerId: string): Promise<CustomerDetail> {
    const customer = await this.db.customers.findById(customerId);
    if (!customer) throw new NotFoundError('Cliente não encontrado.');
    await this.db.customers.update(customerId, { userId: null });
    return this.getCustomer(customerId);
  }

  // ------------------------------------------------------------ fotos do pet (equipe)

  async petUploadTicket(petId: string, input: z.output<typeof privateUploadSchema>): Promise<UploadTicket> {
    const pet = await this.db.pets.findById(petId);
    if (!pet) throw new NotFoundError('Pet não encontrado.');
    return this.storage.createUploadTicket(newPrivatePath(pet.customerId, pet.id, input.kind, input.contentType), input.contentType, input.size);
  }

  private async assertUploaded(pet: Pet, path: string, kind: 'foto' | 'referencias') {
    if (!path.startsWith(`${petFolder(pet.customerId, pet.id)}${kind}/`) || path.includes('..')) throw new ForbiddenError('Arquivo inválido.');
    if (!(await this.storage.exists(path))) throw new ValidationError('A foto não chegou. Tente enviar de novo.');
  }

  async setPetPhoto(petId: string, path: string): Promise<PetDetail> {
    const pet = await this.db.pets.findById(petId);
    if (!pet) throw new NotFoundError('Pet não encontrado.');
    await this.assertUploaded(pet, path, 'foto');
    await this.db.pets.update(petId, { photoPath: path });
    if (pet.photoPath && pet.photoPath !== path) await this.storage.remove(pet.photoPath);
    return this.getPet(petId);
  }

  async addPetReference(petId: string, input: z.output<typeof petReferenceSchema>): Promise<PetDetail> {
    const pet = await this.db.pets.findById(petId);
    if (!pet) throw new NotFoundError('Pet não encontrado.');
    await this.assertUploaded(pet, input.path, 'referencias');
    if (input.appointmentId) {
      const appointment = await this.db.appointments.findById(input.appointmentId);
      if (!appointment || appointment.petId !== petId) throw new NotFoundError('Agendamento não encontrado.');
    }
    await this.db.petReferences.create({ petId, customerId: pet.customerId, path: input.path, description: input.description, appointmentId: input.appointmentId, uploadedBy: 'staff' });
    return this.getPet(petId);
  }

  async removePetReference(petId: string, referenceId: string): Promise<PetDetail> {
    const ref = await this.db.petReferences.findById(referenceId);
    if (!ref || ref.petId !== petId) throw new NotFoundError('Foto não encontrada.');
    await this.db.petReferences.delete(ref.id);
    await this.storage.remove(ref.path);
    return this.getPet(petId);
  }
}
