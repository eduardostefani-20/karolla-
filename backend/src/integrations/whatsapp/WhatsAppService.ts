import type { IntegrationStatus } from '@karolla/shared';
import type { AppointmentMessageContext } from './messageBuilder';

export interface WhatsAppResult {
  status: IntegrationStatus;
  detail: string;
  /** Link "click to chat" para a Karolla Pet com a mensagem pronta (quando houver número configurado). */
  link: string | null;
}

/**
 * WhatsAppService — notificação de novo agendamento.
 *
 * Implementações:
 *  - WhatsAppLinkProvider     (padrão) gera link wa.me com a mensagem; NÃO envia nada sozinho.
 *  - WhatsAppCloudApiProvider envia de fato pela WhatsApp Cloud API (Meta).
 *  - DisabledWhatsAppProvider desativa a integração.
 *
 * O número da Karolla Pet vem SEMPRE de `business_settings.whatsapp_number` (configurável no painel).
 */
export interface WhatsAppService {
  readonly provider: 'link' | 'cloud_api' | 'disabled';
  readonly configured: boolean;
  notifyNewAppointment(ctx: AppointmentMessageContext, businessNumber: string): Promise<WhatsAppResult>;
}
