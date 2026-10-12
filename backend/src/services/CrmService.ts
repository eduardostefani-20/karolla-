import {
  buildWhatsAppLink,
  crmSegment,
  daysBetween,
  fillMessageTemplate,
  nowInTimezone,
  type AdminUser,
  type ContactKind,
  type ContactLog,
  type ContactResult,
  type ContactStatus,
  type CrmCustomer,
  type CrmResponse,
} from '@karolla/shared';
import type { DatabaseService } from '../repositories/types';
import type { Clock } from '../utils/clock';
import { ConflictError, NotFoundError } from '../utils/errors';

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * CRM: clientes novos, recorrentes e inativos (contados a partir do último atendimento CONCLUÍDO) e
 * contatos pelo WhatsApp. Nada é enviado automaticamente: o sistema abre a conversa com a mensagem
 * pronta e registra a tentativa; a pessoa confirma se enviou. Quem pediu para não receber mensagens
 * não recebe convite de reativação.
 */
export class CrmService {
  constructor(
    private readonly db: DatabaseService,
    private readonly clock: Clock,
  ) {}

  async list(query: { segment: 'all' | 'new' | 'recurring' | 'inactive'; search?: string }): Promise<CrmResponse> {
    const settings = await this.db.settings.get();
    const today = nowInTimezone(this.clock.now(), settings.timezone).date;
    const [customers, pets, appointments, contacts] = await Promise.all([
      this.db.customers.list(),
      this.db.pets.list(),
      this.db.appointments.list(),
      this.db.contacts.list(),
    ]);

    const rows: CrmCustomer[] = customers.map((c) => {
      const own = appointments.filter((a) => a.customerId === c.id);
      const done = own.filter((a) => a.status === 'completed').map((a) => a.date).sort();
      const upcoming = own
        .filter((a) => a.date >= today && (a.status === 'pending' || a.status === 'confirmed' || a.status === 'in_progress'))
        .map((a) => a.date)
        .sort();
      const lastVisit = done.at(-1) ?? null;
      const nextAppointment = upcoming[0] ?? null;
      const mine = contacts.filter((k) => k.customerId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return {
        id: c.id,
        name: c.name,
        whatsapp: c.whatsapp,
        email: c.email,
        marketingOptOut: c.marketingOptOut,
        hasAccount: Boolean(c.userId),
        pets: pets.filter((p) => p.customerId === c.id).map((p) => ({ id: p.id, name: p.name })),
        segment: crmSegment({ visits: done.length, lastVisit, nextAppointment, today, inactiveDays: settings.crmInactiveDays }),
        visits: done.length,
        lastVisit,
        daysSinceLastVisit: lastVisit ? daysBetween(lastVisit, today) : null,
        nextAppointment,
        lastContact: mine[0] ?? null,
        createdAt: c.createdAt,
      };
    });

    const counts = { new: 0, recurring: 0, inactive: 0 };
    for (const r of rows) counts[r.segment] += 1;

    const term = query.search?.trim().toLowerCase();
    const digits = term?.replace(/\D/g, '');
    const filtered = rows
      .filter((r) => query.segment === 'all' || r.segment === query.segment)
      .filter(
        (r) =>
          !term ||
          r.name.toLowerCase().includes(term) ||
          r.email.toLowerCase().includes(term) ||
          (digits ? r.whatsapp.includes(digits) : false) ||
          r.pets.some((p) => p.name.toLowerCase().includes(term)),
      )
      .sort((a, b) =>
        a.segment === 'inactive' && b.segment === 'inactive'
          ? (b.daysSinceLastVisit ?? 0) - (a.daysSinceLastVisit ?? 0)
          : a.name.localeCompare(b.name, 'pt-BR'),
      );

    return { inactiveDays: settings.crmInactiveDays, today, counts, customers: filtered };
  }

  /** Abre a conversa do WhatsApp com a mensagem pronta e registra a tentativa (status "aberto"). */
  async startContact(customerId: string, input: { kind: ContactKind; appointmentId: string | null }, actor: AdminUser): Promise<ContactResult> {
    const customer = await this.db.customers.findById(customerId);
    if (!customer) throw new NotFoundError('Cliente não encontrado.');
    if (input.kind === 'reactivation' && customer.marketingOptOut) {
      throw new ConflictError('OPT_OUT', 'Este cliente pediu para não receber mensagens de lembrete ou promoção.');
    }
    if (input.appointmentId) {
      const appointment = await this.db.appointments.findById(input.appointmentId);
      if (!appointment || appointment.customerId !== customer.id) throw new NotFoundError('Agendamento não encontrado.');
    }
    const settings = await this.db.settings.get();
    const today = nowInTimezone(this.clock.now(), settings.timezone).date;
    const [pets, appointments] = await Promise.all([this.db.pets.list({ customerId }), this.db.appointments.list({ customerId })]);
    const done = appointments.filter((a) => a.status === 'completed').sort((a, b) => a.date.localeCompare(b.date));
    const last = done.at(-1);
    const petName = (last && pets.find((p) => p.id === last.petId)?.name) || pets[0]?.name || 'seu pet';
    const message =
      input.kind === 'reactivation'
        ? fillMessageTemplate(settings.crmReactivationMessage, {
            tutor: firstName(customer.name),
            pet: petName,
            dias: last ? daysBetween(last.date, today) : settings.crmInactiveDays,
          })
        : `Oi, ${firstName(customer.name)}! Aqui é da Karolla Pet 🐾`;
    const contact = await this.db.contacts.create({
      customerId,
      appointmentId: input.appointmentId,
      kind: input.kind,
      status: 'opened',
      message,
      actorId: actor.id,
      actorName: actor.name || actor.email,
    });
    return { contact, whatsappLink: buildWhatsAppLink(customer.whatsapp, message) };
  }

  /** A pessoa confirma se enviou (ou não) a mensagem. */
  async updateContact(id: string, status: ContactStatus): Promise<ContactLog> {
    const contact = await this.db.contacts.findById(id);
    if (!contact) throw new NotFoundError('Registro de contato não encontrado.');
    return this.db.contacts.update(id, { status });
  }

  async customerContacts(customerId: string): Promise<ContactLog[]> {
    return (await this.db.contacts.list({ customerId })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
