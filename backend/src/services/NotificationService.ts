import { buildWhatsAppLink, type Appointment, type Customer, type IntegrationName, type IntegrationStatus, type Pet } from '@karolla/shared';
import type { DatabaseService } from '../repositories/types';
import type { WhatsAppService } from '../integrations/whatsapp/WhatsAppService';
import type { GoogleSheetsService } from '../integrations/sheets/GoogleSheetsService';
import { buildSheetRow } from '../integrations/sheets/rowBuilder';
import type { AppointmentMessageContext } from '../integrations/whatsapp/messageBuilder';
import { errorMeta, logger } from '../utils/logger';

/**
 * Orquestra as integrações DEPOIS que o agendamento já está salvo no banco.
 *
 *   BANCO (fonte principal) → WHATSAPP → GOOGLE SHEETS
 *
 * Regra de ouro: nenhuma falha de integração desfaz ou esconde o agendamento.
 * Cada tentativa é registrada em `integration_logs` e visível no painel.
 */
export class NotificationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly whatsapp: WhatsAppService,
    private readonly sheets: GoogleSheetsService,
  ) {}

  private async buildContext(appointment: Appointment, customer?: Customer, pet?: Pet): Promise<AppointmentMessageContext> {
    const [c, p, settings] = await Promise.all([
      customer ?? this.db.customers.findById(appointment.customerId),
      pet ?? this.db.pets.findById(appointment.petId),
      this.db.settings.get(),
    ]);
    if (!c || !p) throw new Error('Cliente ou pet do agendamento não encontrado.');
    const [size, species, professional] = await Promise.all([
      this.db.sizes.findById(appointment.sizeId),
      this.db.species.findById(p.speciesId),
      appointment.professionalId ? this.db.professionals.findById(appointment.professionalId) : Promise.resolve(null),
    ]);
    return {
      appointment,
      customer: c,
      pet: p,
      sizeName: size?.name ?? '',
      speciesName: species?.name ?? '',
      businessName: settings.businessName,
      professionalName: professional?.name ?? '',
    };
  }

  private async log(appointmentId: string, integration: IntegrationName, status: IntegrationStatus, detail: string) {
    try {
      await this.db.integrationLogs.create({ appointmentId, integration, status, detail: detail.slice(0, 500) });
    } catch (err) {
      logger.error('Falha ao registrar log de integração', { appointmentId, integration, ...errorMeta(err) });
    }
  }

  private async sendToSheets(ctx: AppointmentMessageContext, timezone: string) {
    try {
      const result = await this.sheets.upsertAppointment(buildSheetRow(ctx, timezone));
      await this.log(ctx.appointment.id, 'google_sheets', result.status, result.detail);
    } catch (err) {
      logger.error('Google Sheets falhou (agendamento preservado)', { appointmentId: ctx.appointment.id, ...errorMeta(err) });
      await this.log(ctx.appointment.id, 'google_sheets', 'failed', err instanceof Error ? err.message : String(err));
    }
  }

  /** Nunca lança exceção. Retorna o link de WhatsApp para a tela de confirmação. */
  async onAppointmentCreated(appointment: Appointment, customer: Customer, pet: Pet): Promise<{ whatsappLink: string | null }> {
    let whatsappLink: string | null = null;
    try {
      const settings = await this.db.settings.get();
      const ctx = await this.buildContext(appointment, customer, pet);
      try {
        const result = await this.whatsapp.notifyNewAppointment(ctx, settings.whatsappNumber);
        whatsappLink = result.link;
        await this.log(appointment.id, 'whatsapp', result.status, result.detail);
      } catch (err) {
        logger.error('WhatsApp falhou (agendamento preservado)', { appointmentId: appointment.id, ...errorMeta(err) });
        await this.log(appointment.id, 'whatsapp', 'failed', err instanceof Error ? err.message : String(err));
        whatsappLink = settings.whatsappNumber ? buildWhatsAppLink(settings.whatsappNumber) : null;
      }
      await this.sendToSheets(ctx, settings.timezone);
    } catch (err) {
      logger.error('Falha ao preparar notificações', { appointmentId: appointment.id, ...errorMeta(err) });
    }
    return { whatsappLink };
  }

  /** Atualiza a linha da planilha após edição no painel. Nunca lança exceção. */
  async onAppointmentUpdated(appointment: Appointment): Promise<void> {
    try {
      const settings = await this.db.settings.get();
      await this.sendToSheets(await this.buildContext(appointment), settings.timezone);
    } catch (err) {
      logger.error('Falha ao sincronizar atualização', { appointmentId: appointment.id, ...errorMeta(err) });
    }
  }

  /** Reenvio manual pelo painel (ex.: depois de configurar a planilha). */
  async resend(appointment: Appointment): Promise<void> {
    const ctx = await this.buildContext(appointment);
    const settings = await this.db.settings.get();
    try {
      const result = await this.whatsapp.notifyNewAppointment(ctx, settings.whatsappNumber);
      await this.log(appointment.id, 'whatsapp', result.status, result.detail);
    } catch (err) {
      await this.log(appointment.id, 'whatsapp', 'failed', err instanceof Error ? err.message : String(err));
    }
    await this.sendToSheets(ctx, settings.timezone);
  }

  status() {
    return {
      whatsapp: { provider: this.whatsapp.provider, configured: this.whatsapp.configured },
      googleSheets: { provider: this.sheets.provider, configured: this.sheets.configured },
    };
  }
}
