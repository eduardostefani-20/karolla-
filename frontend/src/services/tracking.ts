import type { PublicSettings } from '@karolla/shared';

/**
 * Pixels de anúncio (tráfego pago): Meta (Instagram/Facebook), Google Ads e TikTok.
 *
 * - Os IDs vêm de Painel → Configurações → Anúncios (são públicos; nenhum segredo no navegador).
 * - Nada é carregado sem o consentimento do visitante (veja consent.ts) nem nas páginas do painel.
 * - Eventos enviados:
 *     PageView ............. cada página do site
 *     ViewContent .......... abriu uma inspiração de tosa
 *     InitiateCheckout ..... começou um agendamento
 *     Schedule ............. agendamento concluído (com valor em R$) — conversão principal
 *     Contact .............. tocou em um link do WhatsApp
 */
export type TrackingConfig = Pick<PublicSettings, 'metaPixelId' | 'googleAdsId' | 'googleAdsBookingLabel' | 'googleAdsWhatsappLabel' | 'tiktokPixelId'>;

export type TrackingEvent = 'ViewContent' | 'InitiateCheckout' | 'Schedule' | 'Contact';

export interface TrackingData {
  /** Valor em reais (ex.: 89.9). */
  value?: number;
  contentId?: string;
  contentName?: string;
  /** Identificador único (ex.: id do agendamento) — evita contar a mesma conversão duas vezes. */
  eventId?: string;
}

type Fn = ((...args: unknown[]) => void) & Record<string, unknown>;
declare global {
  interface Window {
    fbq?: Fn;
    _fbq?: Fn;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    ttq?: Fn & unknown[];
    TiktokAnalyticsObject?: string;
  }
}

let active: TrackingConfig | null = null;

export function configuredPlatforms(c: Partial<TrackingConfig> | null | undefined): string[] {
  if (!c) return [];
  return [c.metaPixelId && 'Meta (Instagram/Facebook)', c.googleAdsId && 'Google Ads', c.tiktokPixelId && 'TikTok'].filter(Boolean) as string[];
}

/** "A, B e C" */
export function joinPlatforms(names: string[]) {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : (names[0] ?? '');
}

export function trackingEnabled() {
  return active !== null;
}

function addScript(src: string) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function loadMeta(id: string) {
  if (window.fbq) return;
  // Código base oficial do Pixel da Meta, reescrito sem eval.
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) (fbq.callMethod as (...a: unknown[]) => void)(...args);
    else (fbq.queue as unknown[]).push(args);
  } as Fn;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
  addScript('https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', id);
  fbq('track', 'PageView');
}

function loadGoogleAds(id: string) {
  if (window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  // gtag.js exige o objeto `arguments` (não um array).
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
  window.gtag('js', new Date());
  window.gtag('config', id);
}

function loadTikTok(id: string) {
  if (window.ttq) return;
  // Código base oficial do Pixel do TikTok, reescrito sem eval.
  const methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
  const ttq = [] as unknown as Fn & unknown[] & { _i: Record<string, unknown[] & Record<string, unknown>>; _t: Record<string, number>; _o: Record<string, unknown> };
  const defer = (target: unknown[] & Record<string, unknown>, method: string) => {
    target[method] = (...args: unknown[]) => target.push([method, ...args]);
  };
  methods.forEach((m) => defer(ttq, m));
  ttq.methods = methods;
  ttq.setAndDefer = defer;
  ttq.instance = (name: string) => {
    const inst = ttq._i[name] ?? ([] as unknown as unknown[] & Record<string, unknown>);
    methods.forEach((m) => defer(inst, m));
    return inst;
  };
  ttq.load = (sdkId: string, options?: Record<string, unknown>) => {
    const url = 'https://analytics.tiktok.com/i18n/pixel/events.js';
    ttq._i = ttq._i || {};
    ttq._i[sdkId] = [] as unknown as unknown[] & Record<string, unknown>;
    ttq._i[sdkId]._u = url;
    ttq._t = ttq._t || {};
    ttq._t[sdkId] = Date.now();
    ttq._o = ttq._o || {};
    ttq._o[sdkId] = options || {};
    addScript(`${url}?sdkid=${encodeURIComponent(sdkId)}&lib=ttq`);
  };
  window.TiktokAnalyticsObject = 'ttq';
  window.ttq = ttq;
  (ttq.load as (id: string) => void)(id);
  (ttq.page as () => void)();
}

/** Carrega os pixels configurados (uma vez). Só chame depois do consentimento. */
export function loadTrackers(config: TrackingConfig) {
  if (active) return;
  active = config;
  if (config.metaPixelId) loadMeta(config.metaPixelId);
  if (config.googleAdsId) loadGoogleAds(config.googleAdsId);
  if (config.tiktokPixelId) loadTikTok(config.tiktokPixelId);
}

/** Navegação dentro do site (a primeira página já é contada ao carregar os pixels). */
export function trackPageView() {
  if (!active) return;
  window.fbq?.('track', 'PageView');
  if (window.ttq) (window.ttq.page as () => void)();
  window.gtag?.('event', 'page_view', { page_location: window.location.href, page_path: window.location.pathname });
}

export function trackEvent(event: TrackingEvent, data: TrackingData = {}) {
  if (!active) return;
  const money = data.value !== undefined ? { value: Math.round(data.value * 100) / 100, currency: 'BRL' } : {};
  const content = data.contentId || data.contentName ? { content_ids: data.contentId ? [data.contentId] : undefined, content_name: data.contentName } : {};

  window.fbq?.('track', event, { ...money, ...content }, data.eventId ? { eventID: data.eventId } : undefined);

  if (window.ttq) {
    const contents = data.contentId || data.contentName ? { contents: [{ content_id: data.contentId, content_name: data.contentName }] } : {};
    (window.ttq.track as (...a: unknown[]) => void)(event, { ...money, ...contents }, data.eventId ? { event_id: data.eventId } : undefined);
  }

  if (window.gtag && active.googleAdsId) {
    const label = event === 'Schedule' ? active.googleAdsBookingLabel : event === 'Contact' ? active.googleAdsWhatsappLabel : '';
    if (label) {
      window.gtag('event', 'conversion', {
        send_to: `${active.googleAdsId}/${label}`,
        ...money,
        ...(data.eventId ? { transaction_id: data.eventId } : {}),
      });
    } else if (event === 'InitiateCheckout') {
      window.gtag('event', 'begin_checkout', money);
    }
  }
}
