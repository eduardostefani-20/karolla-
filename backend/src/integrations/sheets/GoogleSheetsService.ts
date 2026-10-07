import type { IntegrationStatus } from '@karolla/shared';

/** Colunas da planilha, na ordem exata. */
export const SHEET_COLUMNS = [
  'ID',
  'Data do pedido',
  'Cliente',
  'WhatsApp',
  'E-mail',
  'Endereço',
  'Pet',
  'Espécie',
  'Raça',
  'Porte',
  'Peso',
  'Serviço',
  'Adicionais',
  'Data do agendamento',
  'Horário',
  'Valor',
  'Status',
  'Observações',
] as const;

export type SheetRow = Record<(typeof SHEET_COLUMNS)[number], string>;

export interface SheetsResult {
  status: IntegrationStatus;
  detail: string;
}

/**
 * GoogleSheetsService — espelha agendamentos em uma planilha (upsert pela coluna ID).
 *
 * Implementações:
 *  - WebhookGoogleSheetsService: POST para um Web App do Google Apps Script (docs/google-apps-script.gs)
 *  - DisabledGoogleSheetsService: quando GOOGLE_SHEETS_WEBHOOK não está definido
 *
 * A planilha é uma CÓPIA: o banco de dados continua sendo a fonte principal.
 */
export interface GoogleSheetsService {
  readonly provider: 'webhook' | 'disabled';
  readonly configured: boolean;
  upsertAppointment(row: SheetRow): Promise<SheetsResult>;
}
