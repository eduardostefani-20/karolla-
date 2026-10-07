import type { customerUpdateSchema, petUpdateSchema, CustomerDetail, CustomerSummary, PetDetail, Pet } from '@karolla/shared';
import type { z } from 'zod';
import type { DatabaseService } from '../repositories/types';
import { ConflictError, NotFoundError } from '../utils/errors';

/** Clientes (tutores) e pets, com histórico de atendimentos. */
export class CustomerService {
  constructor(private readonly db: DatabaseService) {}

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
    const [pets, appointments] = await Promise.all([this.db.pets.list({ customerId: id }), this.db.appointments.list({ customerId: id })]);
    return { ...customer, pets, appointments: appointments.reverse() };
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
    return { ...pet, customer, appointments: appointments.reverse() };
  }

  async updatePet(id: string, input: z.output<typeof petUpdateSchema>) {
    if (input.breedId) {
      const breed = await this.db.breeds.findById(input.breedId);
      if (!breed) throw new NotFoundError('Raça não encontrada.');
      input = { ...input, breedName: breed.name };
    }
    await this.db.pets.update(id, input);
    return this.getPet(id);
  }
}
