import { buildWhatsAppLink, toWhatsAppInternational } from '@karolla/shared';
import { withTimeout } from '../../utils/withTimeout';
import { buildNewAppointmentMessage, type AppointmentMessageContext } from './messageBuilder';
import type { WhatsAppResult, WhatsAppService } from './WhatsAppService';

function linkFor(ctx: AppointmentMessageContext, businessNumber: string): string | null {
  return businessNumber ? buildWhatsAppLink(businessNumber, buildNewAppointmentMessage(ctx)) : null;
}

/**
 * Gera o link wa.me com a mensagem completa do agendamento.
 * Status `link_generated`: a mensagem só chega à Karolla Pet quando o tutor toca em "Falar no WhatsApp".
 */
export class WhatsAppLinkProvider implements WhatsAppService {
  readonly provider = 'link' as const;
  readonly configured = true;

  async notifyNewAppointment(ctx: AppointmentMessageContext, businessNumber: string): Promise<WhatsAppResult> {
    const link = linkFor(ctx, businessNumber);
    if (!link) {
      return { status: 'skipped', detail: 'Número de WhatsApp da Karolla Pet não configurado (Configurações).', link: null };
    }
    return { status: 'link_generated', detail: 'Link com mensagem gerado para o tutor enviar.', link };
  }
}

export class DisabledWhatsAppProvider implements WhatsAppService {
  readonly provider = 'disabled' as const;
  readonly configured = false;

  async notifyNewAppointment(ctx: AppointmentMessageContext, businessNumber: string): Promise<WhatsAppResult> {
    return { status: 'skipped', detail: 'Integração com WhatsApp desativada.', link: linkFor(ctx, businessNumber) };
  }
}

/**
 * WhatsApp Cloud API (Meta) — envia a mensagem diretamente para o número da Karolla Pet.
 * Requer WHATSAPP_CLOUD_TOKEN e WHATSAPP_CLOUD_PHONE_NUMBER_ID.
 * Observação: mensagens de texto livre só são entregues dentro da janela de 24h de conversa;
 * para produção recomenda-se um template aprovado (veja docs/INTEGRACOES.md).
 */
export class WhatsAppCloudApiProvider implements WhatsAppService {
  readonly provider = 'cloud_api' as const;
  readonly configured = true;

  constructor(
    private readonly opts: { token: string; phoneNumberId: string; apiVersion: string; timeoutMs: number },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async notifyNewAppointment(ctx: AppointmentMessageContext, businessNumber: string): Promise<WhatsAppResult> {
    const link = linkFor(ctx, businessNumber);
    if (!businessNumber) return { status: 'skipped', detail: 'Número de destino não configurado.', link };
    const url = `https://graph.facebook.com/${this.opts.apiVersion}/${this.opts.phoneNumberId}/messages`;
    const response = await withTimeout(
      this.fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.opts.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toWhatsAppInternational(businessNumber),
          type: 'text',
          text: { body: buildNewAppointmentMessage(ctx), preview_url: false },
        }),
      }),
      this.opts.timeoutMs,
      'WhatsApp Cloud API',
    );
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`WhatsApp Cloud API respondeu ${response.status}: ${body.slice(0, 300)}`);
    }
    return { status: 'success', detail: 'Mensagem enviada pela WhatsApp Cloud API.', link };
  }
}
