import { withTimeout } from '../../utils/withTimeout';
import { SHEET_COLUMNS, type GoogleSheetsService, type SheetRow, type SheetsResult } from './GoogleSheetsService';

export class DisabledGoogleSheetsService implements GoogleSheetsService {
  readonly provider = 'disabled' as const;
  readonly configured = false;
  async upsertAppointment(): Promise<SheetsResult> {
    return { status: 'skipped', detail: 'Integração com Google Sheets não configurada (GOOGLE_SHEETS_WEBHOOK).' };
  }
}

export class WebhookGoogleSheetsService implements GoogleSheetsService {
  readonly provider = 'webhook' as const;
  readonly configured = true;

  constructor(
    private readonly opts: { url: string; secret?: string; timeoutMs: number },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async upsertAppointment(row: SheetRow): Promise<SheetsResult> {
    const response = await withTimeout(
      this.fetchImpl(this.opts.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert', secret: this.opts.secret ?? '', columns: SHEET_COLUMNS, row }),
        redirect: 'follow',
      }),
      this.opts.timeoutMs,
      'Google Sheets',
    );
    if (!response.ok) throw new Error(`Google Sheets webhook respondeu ${response.status}`);
    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (body.ok === false) throw new Error(`Google Sheets recusou: ${body.error ?? 'erro desconhecido'}`);
    return { status: 'success', detail: 'Linha enviada para a planilha.' };
  }
}
