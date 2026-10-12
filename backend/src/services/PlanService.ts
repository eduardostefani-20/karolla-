import {
  addMonths,
  formatCents,
  nowInTimezone,
  PAYMENT_METHOD_LABELS,
  PLAN_PERIOD_MONTHS,
  SUBSCRIPTION_STATUS_LABELS,
  type AdminUser,
  type CustomerPlan,
  type CustomerPlanDetail,
  type EffectiveSubscriptionStatus,
  type paymentSchema,
  type Plan,
  type planSchema,
  type PlanEvent,
  type PortalCustomerPlan,
  type subscribeSchema,
  type subscriptionUpdateSchema,
} from '@karolla/shared';
import type { z } from 'zod';
import type { DatabaseService } from '../repositories/types';
import type { Clock } from '../utils/clock';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';

const actorName = (a: AdminUser) => a.name || a.email;

/**
 * Planos e mensalidades — SEM pagamento online.
 *  - Pagamento é sempre registrado por uma pessoa autorizada ("Planos → Confirmar"); nada é marcado
 *    como pago automaticamente.
 *  - "Vencido" é calculado: plano ativo cujo vencimento já chegou sem pagamento registrado.
 *  - Uso em atendimento: o serviço precisa estar incluído, ainda haver usos no período e o mesmo
 *    serviço do mesmo atendimento não pode ser descontado duas vezes.
 *  - Tudo fica no histórico do plano (contratação, pagamentos, usos, mudanças de status).
 */
export class PlanService {
  constructor(
    private readonly db: DatabaseService,
    private readonly clock: Clock,
  ) {}

  private async today() {
    return nowInTimezone(this.clock.now(), (await this.db.settings.get()).timezone).date;
  }

  private event(customerPlanId: string, kind: PlanEvent['kind'], detail: string, actor: string) {
    return this.db.planEvents.create({ customerPlanId, kind, detail, actorName: actor });
  }

  // ------------------------------------------------------------ catálogo de planos

  async listPlans(): Promise<Plan[]> {
    return this.db.plans.list();
  }

  private async assertServices(ids: string[]) {
    for (const sid of ids) if (!(await this.db.services.findById(sid))) throw new NotFoundError('Serviço não encontrado.');
  }

  async createPlan(input: z.output<typeof planSchema>): Promise<Plan> {
    await this.assertServices(input.serviceIds);
    return this.db.plans.create(input);
  }

  async updatePlan(id: string, input: Partial<z.output<typeof planSchema>>): Promise<Plan> {
    if (input.serviceIds) await this.assertServices(input.serviceIds);
    return this.db.plans.update(id, input);
  }

  /** Plano já contratado não é excluído (o histórico depende dele): desative. */
  async deletePlan(id: string): Promise<void> {
    if ((await this.db.customerPlans.list({ planId: id })).length) {
      throw new ConflictError('IN_USE', 'Este plano já foi contratado. Desative-o em vez de excluir.');
    }
    await this.db.plans.delete(id);
  }

  // ------------------------------------------------------------ planos dos clientes

  private async detail(cp: CustomerPlan, today: string): Promise<CustomerPlanDetail> {
    const [plan, customer, pet, payments, usages, events] = await Promise.all([
      this.db.plans.findById(cp.planId),
      this.db.customers.findById(cp.customerId),
      cp.petId ? this.db.pets.findById(cp.petId) : Promise.resolve(null),
      this.db.planPayments.list({ customerPlanId: cp.id }),
      this.db.planUsages.list({ customerPlanId: cp.id }),
      this.db.planEvents.list({ customerPlanId: cp.id }),
    ]);
    if (!plan) throw new NotFoundError('Plano não encontrado.');
    const months = PLAN_PERIOD_MONTHS[plan.periodicity];
    const effectiveStatus: EffectiveSubscriptionStatus = cp.status === 'active' && today >= cp.nextDueDate ? 'overdue' : cp.status;
    const periodStart = cp.status === 'pending' ? cp.startDate : addMonths(cp.nextDueDate, -months);
    const usesInPeriod = usages.filter((u) => u.periodStart === periodStart).length;
    return {
      ...cp,
      plan: { id: plan.id, name: plan.name, periodicity: plan.periodicity, serviceIds: plan.serviceIds, usesPerPeriod: plan.usesPerPeriod, rules: plan.rules },
      customerName: customer?.name ?? '',
      petName: pet?.name ?? null,
      effectiveStatus,
      periodStart,
      usesInPeriod,
      usesLeft: Math.max(0, plan.usesPerPeriod - usesInPeriod),
      payments: payments.sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
      usages: usages.sort((a, b) => b.usedAt.localeCompare(a.usedAt)),
      events: events.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }

  async listSubscriptions(filter: { customerId?: string; status?: EffectiveSubscriptionStatus } = {}): Promise<CustomerPlanDetail[]> {
    const today = await this.today();
    const rows = await this.db.customerPlans.list(filter.customerId ? { customerId: filter.customerId } : {});
    const details = await Promise.all(rows.map((r) => this.detail(r, today)));
    return details
      .filter((d) => !filter.status || d.effectiveStatus === filter.status)
      .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  }

  async getSubscription(id: string): Promise<CustomerPlanDetail> {
    const cp = await this.db.customerPlans.findById(id);
    if (!cp) throw new NotFoundError('Plano do cliente não encontrado.');
    return this.detail(cp, await this.today());
  }

  async subscribe(input: z.output<typeof subscribeSchema>, actor: AdminUser): Promise<CustomerPlanDetail> {
    const [plan, customer] = await Promise.all([this.db.plans.findById(input.planId), this.db.customers.findById(input.customerId)]);
    if (!plan || !plan.active) throw new ValidationError('Plano indisponível.', { planId: 'Escolha um plano ativo.' });
    if (!customer) throw new NotFoundError('Cliente não encontrado.');
    if (input.petId) {
      const pet = await this.db.pets.findById(input.petId);
      if (!pet || pet.customerId !== customer.id) throw new NotFoundError('Pet não encontrado para este cliente.');
    }
    const cp = await this.db.customerPlans.create({
      customerId: customer.id,
      planId: plan.id,
      petId: input.petId,
      startDate: input.startDate,
      nextDueDate: input.startDate,
      status: 'pending',
      priceCents: input.priceCents ?? plan.priceCents,
      notes: input.notes,
    });
    await this.event(cp.id, 'created', `Plano "${plan.name}" contratado (aguardando o primeiro pagamento).`, actorName(actor));
    return this.getSubscription(cp.id);
  }

  async updateSubscription(id: string, input: z.output<typeof subscriptionUpdateSchema>, actor: AdminUser): Promise<CustomerPlanDetail> {
    const cp = await this.db.customerPlans.findById(id);
    if (!cp) throw new NotFoundError('Plano do cliente não encontrado.');
    if (cp.status === 'cancelled' && input.status && input.status !== 'cancelled') {
      throw new ConflictError('CANCELLED', 'Plano cancelado não é reativado. Contrate novamente para manter o histórico separado.');
    }
    if (input.status === 'active' && cp.status === 'pending') {
      throw new ConflictError('NOT_PAID', 'O plano fica ativo quando o primeiro pagamento é registrado.');
    }
    await this.db.customerPlans.update(id, input);
    if (input.status && input.status !== cp.status) {
      await this.event(id, 'status', `Status: ${SUBSCRIPTION_STATUS_LABELS[cp.status]} → ${SUBSCRIPTION_STATUS_LABELS[input.status]}`, actorName(actor));
    }
    if (input.nextDueDate && input.nextDueDate !== cp.nextDueDate) {
      await this.event(id, 'edited', `Vencimento ajustado de ${cp.nextDueDate} para ${input.nextDueDate}`, actorName(actor));
    }
    return this.getSubscription(id);
  }

  /** Pagamento registrado por uma pessoa. Avança o vencimento em um período. */
  async recordPayment(id: string, input: z.output<typeof paymentSchema>, actor: AdminUser): Promise<CustomerPlanDetail> {
    const cp = await this.db.customerPlans.findById(id);
    if (!cp) throw new NotFoundError('Plano do cliente não encontrado.');
    if (cp.status === 'cancelled') throw new ConflictError('CANCELLED', 'Plano cancelado não recebe pagamentos.');
    const plan = await this.db.plans.findById(cp.planId);
    if (!plan) throw new NotFoundError('Plano não encontrado.');
    const periodFrom = cp.nextDueDate;
    const periodTo = addMonths(periodFrom, PLAN_PERIOD_MONTHS[plan.periodicity]);
    await this.db.planPayments.create({
      customerPlanId: id,
      amountCents: input.amountCents,
      paidAt: input.paidAt,
      method: input.method,
      periodFrom,
      periodTo,
      notes: input.notes,
      recordedByName: actorName(actor),
    });
    await this.db.customerPlans.update(id, { nextDueDate: periodTo, status: cp.status === 'pending' ? 'active' : cp.status });
    await this.event(
      id,
      'payment',
      `Pagamento de ${formatCents(input.amountCents)} (${PAYMENT_METHOD_LABELS[input.method]}) — período ${periodFrom} a ${periodTo}`,
      actorName(actor),
    );
    return this.getSubscription(id);
  }

  // ------------------------------------------------------------ uso em atendimentos

  /** Planos do tutor do atendimento que podem cobrir algum serviço dele, e os usos já aplicados. */
  async forAppointment(appointmentId: string) {
    const appointment = await this.db.appointments.findById(appointmentId);
    if (!appointment) throw new NotFoundError('Agendamento não encontrado.');
    const subs = await this.listSubscriptions({ customerId: appointment.customerId });
    const serviceIds = appointment.services.map((s) => s.serviceId);
    const usages = (await Promise.all(subs.map((s) => this.db.planUsages.list({ customerPlanId: s.id })))).flat().filter((u) => u.appointmentId === appointmentId);
    return {
      usages,
      plans: subs.filter(
        (s) => (s.petId == null || s.petId === appointment.petId) && s.plan.serviceIds.some((id) => serviceIds.includes(id)) && s.effectiveStatus !== 'cancelled',
      ),
    };
  }

  async useOnAppointment(appointmentId: string, input: { customerPlanId: string; serviceId: string }, actor: AdminUser) {
    const appointment = await this.db.appointments.findById(appointmentId);
    if (!appointment) throw new NotFoundError('Agendamento não encontrado.');
    if (appointment.status === 'cancelled' || appointment.status === 'no_show') {
      throw new ConflictError('INVALID_STATUS', 'Atendimento cancelado ou sem comparecimento não usa plano.');
    }
    const sub = await this.getSubscription(input.customerPlanId);
    if (sub.customerId !== appointment.customerId) throw new NotFoundError('Plano do cliente não encontrado.');
    if (sub.petId && sub.petId !== appointment.petId) throw new ValidationError('Este plano é de outro pet.');
    if (sub.effectiveStatus !== 'active') {
      throw new ConflictError('PLAN_NOT_ACTIVE', `Plano ${SUBSCRIPTION_STATUS_LABELS[sub.effectiveStatus].toLowerCase()}: registre o pagamento ou reative antes de usar.`);
    }
    if (!sub.plan.serviceIds.includes(input.serviceId)) throw new ValidationError('Este serviço não está incluído no plano.');
    if (!appointment.services.some((s) => s.serviceId === input.serviceId)) throw new ValidationError('Este serviço não faz parte do atendimento.');
    if (sub.usesLeft <= 0) throw new ConflictError('NO_USES_LEFT', 'Os usos deste período já acabaram.');
    const existing = (await this.db.planUsages.list({ appointmentId })).find((u) => u.serviceId === input.serviceId);
    if (existing) throw new ConflictError('DUPLICATED', 'Este serviço deste atendimento já foi descontado de um plano.');
    await this.db.planUsages.create({
      customerPlanId: sub.id,
      appointmentId,
      serviceId: input.serviceId,
      periodStart: sub.periodStart,
      usedAt: appointment.date,
      recordedByName: actorName(actor),
    });
    const serviceName = appointment.services.find((s) => s.serviceId === input.serviceId)?.name ?? input.serviceId;
    await this.event(sub.id, 'usage', `Uso: ${serviceName} em ${appointment.date} ${appointment.time}`, actorName(actor));
    return this.forAppointment(appointmentId);
  }

  async revertUsage(usageId: string, actor: AdminUser) {
    const usage = await this.db.planUsages.findById(usageId);
    if (!usage) throw new NotFoundError('Uso não encontrado.');
    await this.db.planUsages.delete(usageId);
    await this.event(usage.customerPlanId, 'usage_reverted', `Uso desfeito (atendimento de ${usage.usedAt})`, actorName(actor));
    return this.forAppointment(usage.appointmentId);
  }

  // ------------------------------------------------------------ portal do cliente

  async forCustomer(customerId: string): Promise<PortalCustomerPlan[]> {
    const subs = await this.listSubscriptions({ customerId });
    return subs.map(({ events: _events, notes: _notes, customerName: _name, ...rest }) => rest);
  }
}
