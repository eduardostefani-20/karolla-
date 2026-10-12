import {
  calculateAppointmentPrice,
  driverCanTake,
  quoteTaxi,
  TAXI_STATUS_LABELS,
  type AdminUser,
  type Appointment,
  type Customer,
  type Pet,
  type TaxiContext,
  type TaxiDirection,
  type TaxiOverview,
  type TaxiQuote,
  type TaxiTransport,
  type TaxiTransportDetail,
  type taxiBlockSchema,
  type taxiDriverSchema,
  type taxiRegionSchema,
  type taxiTransportUpdateSchema,
} from '@karolla/shared';
import type { z } from 'zod';
import type { DatabaseService } from '../repositories/types';
import { ConflictError, NotFoundError } from '../utils/errors';
import type { CatalogService } from './CatalogService';
import { pricingErrorToAppError } from './BookingService';

const formatAddress = (a: Customer['address']) =>
  [a.street && `${a.street}, ${a.number}`, a.complement, a.neighborhood, a.city].filter(Boolean).join(' — ');

/**
 * Taxi Dog: configuração (janelas, regiões e taxas, motoristas, bloqueios), cotação para o site e
 * gestão dos transportes. O status do transporte é independente do status do atendimento.
 * Um transporte só é CONFIRMADO com motorista disponível e com capacidade naquele horário.
 */
export class TaxiService {
  constructor(
    private readonly db: DatabaseService,
    private readonly catalog: CatalogService,
  ) {}

  async context(date?: string): Promise<TaxiContext> {
    const [settings, regions, drivers, blocks, transports] = await Promise.all([
      this.db.settings.get(),
      this.db.taxiRegions.list(),
      this.db.taxiDrivers.list(),
      this.db.taxiBlocks.list(),
      date ? this.db.taxiTransports.list({ date }) : this.db.taxiTransports.list(),
    ]);
    return { settings, regions, drivers, blocks, transports };
  }

  async overview(): Promise<TaxiOverview> {
    const ctx = await this.context();
    const { taxiEnabled, taxiWindows, taxiPickupLeadMinutes, taxiSlotMinutes } = ctx.settings;
    return { settings: { taxiEnabled, taxiWindows, taxiPickupLeadMinutes, taxiSlotMinutes }, regions: ctx.regions, drivers: ctx.drivers, blocks: ctx.blocks };
  }

  /** Cotação usada no site: duração calculada no servidor pelos serviços escolhidos. */
  async quote(input: {
    date: string;
    time: string;
    serviceIds: string[];
    addonIds: string[];
    sizeId: string;
    speciesId?: string;
    neighborhood: string;
    direction: TaxiDirection;
  }): Promise<TaxiQuote> {
    let duration: number;
    try {
      duration = calculateAppointmentPrice(input, await this.catalog.getPricingCatalog()).totalDurationMinutes;
    } catch (err) {
      pricingErrorToAppError(err);
    }
    return quoteTaxi(await this.context(input.date), { ...input, durationMinutes: duration });
  }

  /** Cria o transporte do agendamento (status "Solicitado"); a equipe confirma ao escolher o motorista. */
  async createForAppointment(appointment: Appointment, customer: Customer, pet: Pet, quote: TaxiQuote, direction: TaxiDirection, notes: string): Promise<TaxiTransport> {
    return this.db.taxiTransports.create({
      appointmentId: appointment.id,
      customerId: customer.id,
      petId: pet.id,
      regionId: quote.regionId,
      direction,
      date: appointment.date,
      pickupTime: quote.pickupTime,
      dropoffTime: quote.dropoffTime,
      address: formatAddress(customer.address),
      notes,
      feeCents: quote.feeCents,
      driverId: null,
      status: 'requested',
    });
  }

  // ------------------------------------------------------------ configuração

  async updateSettings(input: { taxiEnabled?: boolean; taxiWindows?: TaxiOverview['settings']['taxiWindows']; taxiPickupLeadMinutes?: number; taxiSlotMinutes?: number }) {
    await this.db.settings.update(input);
    return this.overview();
  }

  createRegion(input: z.output<typeof taxiRegionSchema>) {
    return this.db.taxiRegions.create(input);
  }
  updateRegion(id: string, input: Partial<z.output<typeof taxiRegionSchema>>) {
    return this.db.taxiRegions.update(id, input);
  }
  createDriver(input: z.output<typeof taxiDriverSchema>) {
    return this.db.taxiDrivers.create(input);
  }
  updateDriver(id: string, input: Partial<z.output<typeof taxiDriverSchema>>) {
    return this.db.taxiDrivers.update(id, input);
  }
  async addBlock(input: z.output<typeof taxiBlockSchema>) {
    if (input.driverId && !(await this.db.taxiDrivers.findById(input.driverId))) throw new NotFoundError('Motorista não encontrado.');
    return this.db.taxiBlocks.create(input);
  }
  removeBlock(id: string) {
    return this.db.taxiBlocks.delete(id);
  }

  // ------------------------------------------------------------ transportes

  private async details(rows: TaxiTransport[]): Promise<TaxiTransportDetail[]> {
    if (!rows.length) return [];
    const [customers, pets, drivers, regions] = await Promise.all([this.db.customers.list(), this.db.pets.list(), this.db.taxiDrivers.list(), this.db.taxiRegions.list()]);
    const appointments = await Promise.all(rows.map((r) => this.db.appointments.findById(r.appointmentId)));
    return rows.map((t, i) => {
      const c = customers.find((x) => x.id === t.customerId);
      return {
        ...t,
        customerName: c?.name ?? '',
        customerWhatsapp: c?.whatsapp ?? '',
        petName: pets.find((p) => p.id === t.petId)?.name ?? '',
        appointmentTime: appointments[i]?.time ?? '',
        appointmentStatus: appointments[i]?.status ?? 'pending',
        driverName: drivers.find((d) => d.id === t.driverId)?.name ?? null,
        regionName: regions.find((r) => r.id === t.regionId)?.name ?? null,
      };
    });
  }

  async listTransports(filter: { date?: string; appointmentId?: string }): Promise<TaxiTransportDetail[]> {
    const rows = await this.db.taxiTransports.list(filter.appointmentId ? { appointmentId: filter.appointmentId } : filter.date ? { date: filter.date } : {});
    const sorted = rows.sort((a, b) => `${a.date} ${a.pickupTime ?? a.dropoffTime}`.localeCompare(`${b.date} ${b.pickupTime ?? b.dropoffTime}`));
    return this.details(sorted);
  }

  async updateTransport(id: string, input: z.output<typeof taxiTransportUpdateSchema>, _actor: AdminUser): Promise<TaxiTransportDetail> {
    const current = await this.db.taxiTransports.findById(id);
    if (!current) throw new NotFoundError('Transporte não encontrado.');
    const next = {
      ...current,
      driverId: input.driverId !== undefined ? input.driverId : current.driverId,
      status: input.status ?? current.status,
      pickupTime: input.pickupTime !== undefined ? input.pickupTime : current.pickupTime,
      dropoffTime: input.dropoffTime !== undefined ? input.dropoffTime : current.dropoffTime,
    };
    const active = next.status !== 'cancelled' && next.status !== 'requested';
    if (active && !next.driverId) throw new ConflictError('NO_DRIVER', `Escolha um motorista disponível antes de marcar como "${TAXI_STATUS_LABELS[next.status]}".`);
    const changedSlot = next.driverId !== current.driverId || next.pickupTime !== current.pickupTime || next.dropoffTime !== current.dropoffTime;
    if (next.driverId && next.status !== 'cancelled' && (changedSlot || current.status === 'requested')) {
      const ctx = await this.context(current.date);
      if (!driverCanTake(ctx, next.driverId, next)) {
        throw new ConflictError('DRIVER_UNAVAILABLE', 'Este motorista não está disponível ou já está com a capacidade cheia nesse horário.');
      }
    }
    await this.db.taxiTransports.update(id, {
      driverId: next.driverId,
      status: next.status,
      pickupTime: next.pickupTime,
      dropoffTime: next.dropoffTime,
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    });
    const [detail] = await this.details([(await this.db.taxiTransports.findById(id))!]);
    return detail!;
  }
}
