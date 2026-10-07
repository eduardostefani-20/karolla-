import { formatAge, formatCents, formatDateBR, formatPhone, type Appointment, type Customer, type Pet } from '@karolla/shared';

export interface AppointmentMessageContext {
  appointment: Appointment;
  customer: Customer;
  pet: Pet;
  sizeName: string;
  speciesName: string;
  businessName: string;
}

/** Mensagem padrão de novo agendamento (texto puro, compatível com WhatsApp). */
export function buildNewAppointmentMessage(ctx: AppointmentMessageContext): string {
  const { appointment: a, customer: c, pet: p } = ctx;
  const addons = a.addons.length ? a.addons.map((x) => `• ${x.name}`).join('\n') : 'Nenhum';
  const address = [c.address.street && `${c.address.street}, ${c.address.number}`, c.address.complement, c.address.neighborhood, c.address.city]
    .filter(Boolean)
    .join(' - ');
  const lines = [
    `🐾 NOVO AGENDAMENTO — ${ctx.businessName.toUpperCase()}`,
    '',
    '*PET*',
    `Nome: ${p.name}`,
    `Espécie: ${ctx.speciesName}`,
    `Raça: ${p.breedName}`,
    `Porte: ${ctx.sizeName}`,
    p.weightKg != null ? `Peso: ${p.weightKg} kg` : null,
    p.ageMonths != null ? `Idade: ${formatAge(p.ageMonths)}` : null,
    '',
    '*SERVIÇO*',
    a.services.map((s) => s.name).join(' + '),
    '',
    '*ADICIONAIS*',
    addons,
    '',
    '*DATA*',
    formatDateBR(a.date),
    '',
    '*HORÁRIO*',
    a.time,
    '',
    '*TUTOR*',
    c.name,
    '',
    '*WHATSAPP*',
    formatPhone(c.whatsapp),
    c.email ? '' : null,
    c.email ? '*E-MAIL*' : null,
    c.email || null,
    address ? '' : null,
    address ? '*ENDEREÇO*' : null,
    address || null,
    p.notes || a.customerNotes ? '' : null,
    p.notes || a.customerNotes ? '*OBSERVAÇÕES*' : null,
    p.notes ? `Pet: ${p.notes}` : null,
    a.customerNotes ? `Tutor: ${a.customerNotes}` : null,
    '',
    '*TOTAL*',
    formatCents(a.totalCents),
    '',
    `Código: ${a.id.slice(0, 8).toUpperCase()}`,
  ];
  return lines.filter((l): l is string => l !== null).join('\n');
}
