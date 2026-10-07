import type { AppointmentStatus, FormFieldConfig, FormFieldKey } from './types/domain';

export const BRAND_NAME = 'Karolla Pet';

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  in_progress: 'Em atendimento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};

export const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

/** Configuração padrão dos campos configuráveis (usada quando o banco ainda não tem registro). */
export const DEFAULT_FORM_FIELDS: Record<FormFieldKey, FormFieldConfig> = {
  'pet.weight': { key: 'pet.weight', label: 'Peso aproximado (kg)', helpText: 'Ajuda a confirmar o porte do pet.', enabled: true, required: false },
  'pet.age': { key: 'pet.age', label: 'Idade', helpText: '', enabled: true, required: false },
  'pet.notes': { key: 'pet.notes', label: 'Observações sobre o pet', helpText: 'Alergias, comportamento, sensibilidade ao secador...', enabled: true, required: false },
  'tutor.email': { key: 'tutor.email', label: 'E-mail', helpText: '', enabled: true, required: true },
  'tutor.address': { key: 'tutor.address', label: 'Endereço', helpText: 'Usado para cadastro e, futuramente, leva e traz.', enabled: true, required: true },
  'tutor.notes': { key: 'tutor.notes', label: 'Observações para a equipe', helpText: '', enabled: true, required: false },
};

/** Número total de etapas do fluxo de agendamento. */
export const BOOKING_STEPS = [
  { id: 'species', title: 'Pet' },
  { id: 'pet', title: 'Dados do pet' },
  { id: 'service', title: 'Serviço' },
  { id: 'addons', title: 'Adicionais' },
  { id: 'date', title: 'Data' },
  { id: 'time', title: 'Horário' },
  { id: 'tutor', title: 'Tutor' },
  { id: 'summary', title: 'Resumo' },
  { id: 'confirmation', title: 'Confirmação' },
] as const;
export type BookingStepId = (typeof BOOKING_STEPS)[number]['id'];
