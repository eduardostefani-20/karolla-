import {
  APPOINTMENT_STATUS_LABELS,
  formatCents,
  formatDateBR,
  formatPhone,
  sanitizeSpreadsheetCell,
} from '@karolla/shared';
import type { AppointmentMessageContext } from '../whatsapp/messageBuilder';
import type { SheetRow } from './GoogleSheetsService';

export function buildSheetRow(ctx: AppointmentMessageContext, timezone: string): SheetRow {
  const { appointment: a, customer: c, pet: p } = ctx;
  const address = [c.address.street && `${c.address.street}, ${c.address.number}`, c.address.complement, c.address.neighborhood, c.address.city]
    .filter(Boolean)
    .join(' - ');
  const created = new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(a.createdAt));
  const row: SheetRow = {
    ID: a.id,
    'Data do pedido': created,
    Cliente: c.name,
    WhatsApp: formatPhone(c.whatsapp),
    'E-mail': c.email,
    Endereço: address,
    Pet: p.name,
    Espécie: ctx.speciesName,
    Raça: p.breedName,
    Porte: ctx.sizeName,
    Peso: p.weightKg != null ? `${p.weightKg} kg` : '',
    Serviço: a.services.map((s) => s.name).join(' + '),
    Adicionais: a.addons.map((x) => x.name).join(', '),
    'Data do agendamento': formatDateBR(a.date),
    Horário: a.time,
    Valor: formatCents(a.totalCents),
    Status: APPOINTMENT_STATUS_LABELS[a.status],
    Observações: [p.notes && `Pet: ${p.notes}`, a.customerNotes && `Tutor: ${a.customerNotes}`, a.notes && `Interno: ${a.notes}`].filter(Boolean).join(' | '),
  };
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, sanitizeSpreadsheetCell(v)])) as SheetRow;
}
