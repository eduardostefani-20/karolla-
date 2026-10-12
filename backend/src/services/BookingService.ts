import {
  calculateAppointmentPrice,
  checkSlot,
  effectiveCapacity,
  qualifiedProfessionals,
  getDayAvailability,
  PricingError,
  resolveFormConfig,
  SLOT_REASON_MESSAGES,
  stripDisabledFields,
  validateConfigurableFields,
  type AvailabilityResponse,
  type BookingRequest,
  type BookingResult,
  type AppointmentInspiration,
  type Customer,
  type Pet,
  type TaxiQuote,
  type UploadTicket,
  quoteTaxi,
  CUSTOMER_DEFAULTS,
  PET_DEFAULTS,
} from '@karolla/shared';
import type { DatabaseService } from '../repositories/types';
import { AppError, ConflictError, SlotConflictError, ValidationError } from '../utils/errors';
import type { CatalogService } from './CatalogService';
import type { ScheduleService } from './ScheduleService';
import type { NotificationService } from './NotificationService';
import type { TaxiService } from './TaxiService';
import type { PrivateStorage } from '../integrations/storage/PrivateStorage';
import { EXTENSIONS } from '../integrations/storage/MediaStorage';
import { assertSchemaFor } from './schemaGuard';
import { randomUUID } from 'node:crypto';

/** Pasta das fotos de referência enviadas no agendamento (antes de existir o cadastro do pet). */
export const GROOMING_UPLOAD_FOLDER = 'agendamentos/referencias/';

export function pricingErrorToAppError(err: unknown): never {
  if (err instanceof PricingError) {
    const fieldByCode: Record<string, string> = {
      SIZE_NOT_FOUND: 'pet.sizeId',
      SIZE_INACTIVE: 'pet.sizeId',
      ADDON_NOT_FOUND: 'addonIds',
      ADDON_INACTIVE: 'addonIds',
    };
    throw new AppError(409, err.code, err.message, { [fieldByCode[err.code] ?? 'serviceIds']: err.message });
  }
  throw err;
}

const normalizeName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Fluxo público de agendamento: disponibilidade → validação → preço → gravação → integrações. */
export class BookingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly catalog: CatalogService,
    private readonly schedule: ScheduleService,
    private readonly notifications: NotificationService,
    private readonly taxi: TaxiService,
    private readonly privateStorage: PrivateStorage,
  ) {}

  /** Foto de referência enviada no agendamento (pasta temporária, só imagens, até 8 MB). */
  async groomingUploadTicket(input: { contentType: string; size: number }): Promise<UploadTicket> {
    const path = `${GROOMING_UPLOAD_FOLDER}${randomUUID()}.${EXTENSIONS[input.contentType] ?? 'jpg'}`;
    return this.privateStorage.createUploadTicket(path, input.contentType, input.size);
  }

  async getAvailability(input: {
    date: string;
    serviceIds: string[];
    addonIds: string[];
    sizeId: string;
    speciesId?: string;
    professionalId?: string;
  }): Promise<AvailabilityResponse> {
    let duration: number;
    try {
      duration = calculateAppointmentPrice(input, await this.catalog.getPricingCatalog()).totalDurationMinutes;
    } catch (err) {
      pricingErrorToAppError(err);
    }
    const ctx = await this.schedule.getAvailabilityContext(input.date, input.date);
    const day = getDayAvailability(ctx, input.date, duration, { serviceIds: input.serviceIds, professionalId: input.professionalId });
    const allPros = await this.db.professionals.list({ active: true });
    const qualifiedIds = new Set(qualifiedProfessionals(allPros, input.serviceIds).map((p) => p.id));
    return {
      date: day.date,
      durationMinutes: duration,
      professionals: allPros.filter((p) => qualifiedIds.has(p.id)).map(({ id, name }) => ({ id, name })),
      closedReason: day.closedReason,
      closedMessage: day.closedReason ? SLOT_REASON_MESSAGES[day.closedReason] : null,
      slots: day.slots,
    };
  }

  async createBooking(raw: BookingRequest): Promise<BookingResult> {
    // 1. Regras configuráveis do formulário (campos ativos/obrigatórios definidos pela administradora)
    const formConfig = resolveFormConfig(await this.db.formFields.list());
    const request = stripDisabledFields(raw, formConfig);
    const fieldErrors = validateConfigurableFields(request, formConfig);
    if (Object.keys(fieldErrors).length) throw new ValidationError('Preencha os campos obrigatórios.', fieldErrors);

    // 2. Espécie, porte e raça válidos e ativos
    const [species, size] = await Promise.all([
      this.db.species.findById(request.pet.speciesId),
      this.db.sizes.findById(request.pet.sizeId),
    ]);
    if (!species?.active) throw new ValidationError('Espécie indisponível.', { 'pet.speciesId': 'Escolha uma espécie válida.' });
    if (!size?.active) throw new ValidationError('Porte indisponível.', { 'pet.sizeId': 'Escolha um porte válido.' });
    let breedName = request.pet.breedName;
    if (request.pet.breedId) {
      const breed = await this.db.breeds.findById(request.pet.breedId);
      if (!breed || !breed.active || breed.speciesId !== species.id) {
        throw new ValidationError('Raça inválida.', { 'pet.breedId': 'Escolha uma raça da lista ou digite outra raça.' });
      }
      breedName = breed.name;
    }

    // 3. Preço recalculado no servidor (nunca confiar no valor do navegador)
    let price;
    try {
      price = calculateAppointmentPrice(
        { serviceIds: request.serviceIds, sizeId: size.id, addonIds: request.addonIds, speciesId: species.id },
        await this.catalog.getPricingCatalog(),
      );
    } catch (err) {
      pricingErrorToAppError(err);
    }
    if (request.expectedTotalCents != null && request.expectedTotalCents !== price.totalCents) {
      throw new ConflictError('PRICE_CHANGED', 'Os valores foram atualizados enquanto você agendava. Confira o novo total antes de confirmar.');
    }

    // 4. Pré-checagem de disponibilidade (mensagem detalhada). A garantia final é atômica no repositório.
    const serviceIds = request.serviceIds;
    let ctx = await this.schedule.getAvailabilityContext(request.date, request.date);
    const slotOptions = { serviceIds, professionalId: request.professionalId ?? undefined };
    let slot = checkSlot(ctx, request.date, request.time, price.totalDurationMinutes, slotOptions);
    if (!slot.ok) throw new ConflictError('SLOT_UNAVAILABLE', SLOT_REASON_MESSAGES[slot.reason]);

    // 5. Inspiração escolhida no catálogo: grava só a referência (título, foto, raça) do momento
    const inspiration = request.inspirationId ? await this.inspirationSnapshot(request.inspirationId) : null;

    // 5b. Foto de referência própria (enviada antes, em pasta temporária privada)
    const reference = request.groomingReference ?? null;
    if (reference) {
      await assertSchemaFor(this.db, 9, true, 'O envio de foto de referência');
      if (!reference.path.startsWith(GROOMING_UPLOAD_FOLDER) || reference.path.includes('..') || !(await this.privateStorage.exists(reference.path))) {
        throw new ValidationError('A foto de referência não chegou. Envie de novo.', { groomingReference: 'Envie a foto de novo.' });
      }
    }

    // 5c. Taxi Dog: só se estiver disponível para o bairro e os horários (nunca promete sem motorista)
    let taxiQuote: TaxiQuote | null = null;
    if (request.taxi) {
      await assertSchemaFor(this.db, 11, true, 'O Taxi Dog');
      if (!request.tutor.address.street || !request.tutor.address.neighborhood) {
        throw new ValidationError('Para o Taxi Dog, informe o endereço com bairro.', { 'tutor.address.street': 'Informe o endereço.' });
      }
      taxiQuote = quoteTaxi(await this.taxi.context(request.date), {
        date: request.date,
        time: request.time,
        durationMinutes: price.totalDurationMinutes,
        neighborhood: request.tutor.address.neighborhood,
        direction: request.taxi.direction,
      });
      if (!taxiQuote.available) throw new ConflictError('TAXI_UNAVAILABLE', taxiQuote.message ?? 'Taxi Dog indisponível.');
    }
    const customerNotes = [
      request.tutor.notes,
      request.groomingNotes && `Tosa: ${request.groomingNotes}`,
      reference && 'Tosa: foto de referência enviada (veja no agendamento).',
    ]
      .filter(Boolean)
      .join('\n');

    // 6. Cliente e pet (reaproveita cadastro existente pelo WhatsApp)
    const customer = await this.upsertCustomer(request.tutor);
    const pet = await this.upsertPet(customer.id, { ...request.pet, breedName });

    // 7. Grava o agendamento (fonte principal de verdade). Se o profissional sorteado for ocupado
    //    no mesmo instante por outro cliente, tenta o próximo profissional livre.
    const newAppointment = (professionalId: string | null) => ({
      customerId: customer.id,
      petId: pet.id,
      sizeId: size.id,
      date: request.date,
      time: request.time,
      durationMinutes: price.totalDurationMinutes,
      totalCents: price.totalCents,
      status: 'pending' as const,
      notes: '',
      customerNotes,
      source: 'online' as const,
      professionalId,
      inspiration,
      attribution: request.attribution,
      origin: 'site' as const,
      createdByName: '',
      services: price.lines
        .filter((l) => l.kind === 'service')
        .map((l) => ({ serviceId: l.refId, name: l.name, priceCents: l.priceCents, durationMinutes: l.durationMinutes })),
      addons: price.lines
        .filter((l) => l.kind === 'addon')
        .map((l) => ({ addonId: l.refId, name: l.name, priceCents: l.priceCents, durationMinutes: l.durationMinutes })),
    });
    let appointment;
    for (let attempt = 0; ; attempt++) {
      const professionalId = slot.professionalId ?? null;
      try {
        appointment = await this.db.appointments.create(newAppointment(professionalId), {
          capacity: effectiveCapacity(ctx, { date: request.date, time: request.time, durationMinutes: price.totalDurationMinutes }),
          professionalId,
          professionalCapacity: ctx.professionals?.find((p) => p.id === professionalId)?.capacity,
        });
        break;
      } catch (err) {
        if (!(err instanceof SlotConflictError) || !professionalId || request.professionalId || attempt >= 5) throw err;
        ctx = await this.schedule.getAvailabilityContext(request.date, request.date);
        slot = checkSlot(ctx, request.date, request.time, price.totalDurationMinutes, slotOptions);
        if (!slot.ok) throw err;
      }
    }

    // 8. Taxi Dog e foto de referência ligados ao agendamento e ao pet
    const transport = taxiQuote && request.taxi ? await this.taxi.createForAppointment(appointment, customer, pet, taxiQuote, request.taxi.direction, request.taxi.notes) : null;
    if (reference) {
      await this.db.petReferences.create({
        petId: pet.id,
        customerId: customer.id,
        path: reference.path,
        description: reference.description || request.groomingNotes,
        appointmentId: appointment.id,
        uploadedBy: 'customer',
      });
    }

    // 9. Integrações (falhas não afetam o agendamento salvo)
    const { whatsappLink } = await this.notifications.onAppointmentCreated(appointment, customer, pet);

    return {
      appointment,
      pet,
      customer: { name: customer.name },
      whatsappLink: whatsappLink ?? '',
      taxi: transport ? { direction: transport.direction, pickupTime: transport.pickupTime, dropoffTime: transport.dropoffTime, feeCents: transport.feeCents, status: transport.status } : null,
    };
  }

  private async inspirationSnapshot(id: string): Promise<AppointmentInspiration> {
    const item = await this.db.inspirations.findById(id);
    if (!item || !item.active) {
      throw new ValidationError('A inspiração escolhida não está mais disponível.', { inspirationId: 'Escolha outra inspiração ou remova a foto.' });
    }
    return { id: item.id, title: item.title, imageUrl: item.imageUrl, breedName: item.breedName };
  }

  private async upsertCustomer(tutor: BookingRequest['tutor']): Promise<Customer> {
    const existing = await this.db.customers.findByWhatsapp(tutor.whatsapp);
    if (!existing) {
      return this.db.customers.create({ ...CUSTOMER_DEFAULTS, name: tutor.name, whatsapp: tutor.whatsapp, email: tutor.email, address: tutor.address, notes: '' });
    }
    // Cliente recorrente: completa apenas dados que estavam vazios (o formulário público não sobrescreve cadastro).
    const hasAddress = Boolean(existing.address.street);
    return this.db.customers.update(existing.id, {
      email: existing.email || tutor.email,
      address: hasAddress ? existing.address : tutor.address,
    });
  }

  private async upsertPet(customerId: string, data: BookingRequest['pet']): Promise<Pet> {
    const pets = await this.db.pets.list({ customerId });
    const existing = pets.find((p) => p.speciesId === data.speciesId && normalizeName(p.name) === normalizeName(data.name));
    const fields = {
      name: data.name,
      speciesId: data.speciesId,
      breedId: data.breedId,
      breedName: data.breedName,
      sizeId: data.sizeId,
      weightKg: data.weightKg,
      ageMonths: data.ageMonths,
      notes: data.notes,
    };
    if (!existing) return this.db.pets.create({ ...PET_DEFAULTS, customerId, ...fields });
    return this.db.pets.update(existing.id, {
      ...fields,
      weightKg: data.weightKg ?? existing.weightKg,
      ageMonths: data.ageMonths ?? existing.ageMonths,
      notes: data.notes || existing.notes,
    });
  }
}
