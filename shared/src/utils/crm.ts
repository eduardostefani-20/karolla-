import type { CrmSegment } from '../types/api';
import { addDays } from './date';

export const DEFAULT_CRM_INACTIVE_DAYS = 40;
export const DEFAULT_PICKUP_MESSAGE = 'Oi, {tutor}! O(a) {pet} já está pronto(a) e cheiroso(a) esperando por você na Karolla Pet 🐾';
export const DEFAULT_CRM_REACTIVATION_MESSAGE =
  'Oi, {tutor}! Aqui é da Karolla Pet 🐾 Faz {dias} dias desde o último banho do(a) {pet}. Que tal agendar um horário? É só responder esta mensagem ou agendar pelo site.';

/** Diferença em dias entre duas datas aaaa-mm-dd. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/**
 * Classificação do cliente no CRM (contada a partir do último atendimento CONCLUÍDO):
 *  - inativo: já foi atendido, o último atendimento concluído tem mais de N dias e não há horário marcado;
 *  - recorrente: 2+ atendimentos concluídos e ativo;
 *  - novo: nenhum ou 1 atendimento concluído (e não inativo).
 */
export function crmSegment(input: { visits: number; lastVisit: string | null; nextAppointment: string | null; today: string; inactiveDays: number }): CrmSegment {
  const { visits, lastVisit, nextAppointment, today, inactiveDays } = input;
  if (lastVisit && !nextAppointment && lastVisit < addDays(today, -inactiveDays)) return 'inactive';
  return visits >= 2 ? 'recurring' : 'new';
}

/** Preenche {tutor}, {pet} e {dias} na mensagem (variáveis desconhecidas ficam como estão). */
export function fillMessageTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/** Idade em meses a partir da data de nascimento. */
export function ageInMonths(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  let months = (ty - by) * 12 + (tm - bm);
  if (td < bd) months -= 1;
  return Math.max(0, months);
}
