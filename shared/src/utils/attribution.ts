import type { AppointmentAttribution } from '../types/domain';

export interface AttributionChannel {
  /** Chave estável para agrupar (ex.: meta_ads, google, direct). */
  key: string;
  /** Nome para exibir no painel. */
  label: string;
  /** true = veio de anúncio pago. */
  paid: boolean;
}

const PAID_MEDIUMS = new Set(['cpc', 'ppc', 'paid', 'paid_social', 'paidsocial', 'paid-social', 'ads', 'ad', 'cpm', 'cpv', 'display', 'anuncio', 'anúncio', 'pago', 'trafego_pago']);

const SOURCE_NAMES: { test: RegExp; key: string; label: string; adsKey: string; adsLabel: string }[] = [
  { test: /^(ig|fb|an|msg|meta)$|^(instagram|facebook|messenger)/, key: 'meta', label: 'Instagram/Facebook', adsKey: 'meta_ads', adsLabel: 'Meta Ads (Instagram/Facebook)' },
  { test: /^gads$|^(google|adwords|youtube)/, key: 'google', label: 'Google', adsKey: 'google_ads', adsLabel: 'Google Ads' },
  { test: /^tt$|^tiktok/, key: 'tiktok', label: 'TikTok', adsKey: 'tiktok_ads', adsLabel: 'TikTok Ads' },
  { test: /^(wa|zap)$|^whatsapp/, key: 'whatsapp', label: 'WhatsApp', adsKey: 'whatsapp_ads', adsLabel: 'Anúncio no WhatsApp' },
];

const REFERRERS: { test: RegExp; key: string; label: string }[] = [
  { test: /(^|\.)instagram\.com$/, key: 'meta', label: 'Instagram/Facebook' },
  { test: /(^|\.)facebook\.com$|(^|\.)fb\.com$/, key: 'meta', label: 'Instagram/Facebook' },
  { test: /(^|\.)google\.[a-z.]+$/, key: 'google', label: 'Google' },
  { test: /(^|\.)tiktok\.com$/, key: 'tiktok', label: 'TikTok' },
  { test: /(^|\.)whatsapp\.com$|^wa\.me$/, key: 'whatsapp', label: 'WhatsApp' },
  { test: /(^|\.)bing\.com$/, key: 'bing', label: 'Bing' },
];

const titleCase = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

/**
 * Classifica a origem de um agendamento. Ordem de confiança:
 * identificador de clique pago (gclid/ttclid) → UTM → fbclid → site de origem → direto.
 */
export function attributionChannel(a: AppointmentAttribution | null | undefined): AttributionChannel {
  if (!a) return { key: 'unknown', label: 'Sem informação', paid: false };
  if (a.gclid) return { key: 'google_ads', label: 'Google Ads', paid: true };
  if (a.ttclid) return { key: 'tiktok_ads', label: 'TikTok Ads', paid: true };

  const source = (a.utmSource ?? '').trim().toLowerCase();
  const medium = (a.utmMedium ?? '').trim().toLowerCase();
  if (source || medium) {
    const paid = PAID_MEDIUMS.has(medium);
    const known = SOURCE_NAMES.find((s) => s.test.test(source));
    if (known) return paid ? { key: known.adsKey, label: known.adsLabel, paid } : { key: known.key, label: known.label, paid };
    if (paid) return { key: `ads_${source || 'outros'}`, label: source ? `Anúncio (${titleCase(source)})` : 'Anúncio', paid };
    if (source) return { key: `src_${source}`, label: titleCase(source), paid: false };
  }
  // fbclid aparece em qualquer link aberto no Instagram/Facebook (pago ou não).
  if (a.fbclid) return { key: 'meta', label: 'Instagram/Facebook', paid: false };

  const ref = (a.referrer ?? '').trim().toLowerCase();
  if (ref) {
    const known = REFERRERS.find((r) => r.test.test(ref));
    return known ? { ...known, paid: false } : { key: `ref_${ref}`, label: ref, paid: false };
  }
  return { key: 'direct', label: 'Acesso direto', paid: false };
}

const ATTRIBUTION_KEYS = ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'gclid', 'fbclid', 'ttclid', 'referrer', 'landingPage', 'capturedAt'] as const;
const MAX_LEN = 200;

/**
 * Limpa a origem enviada pelo navegador: só campos conhecidos, texto curto, sem caracteres de controle,
 * referrer reduzido ao domínio e página de entrada sem parâmetros. Dados inválidos viram null —
 * a origem nunca impede um agendamento.
 */
export function sanitizeAttribution(input: unknown): AppointmentAttribution | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const out: AppointmentAttribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = raw[key];
    if (typeof value !== 'string') continue;
    // eslint-disable-next-line no-control-regex
    let clean = value.replace(/[\u0000-\u001f\u007f<>]/g, '').trim();
    if (!clean) continue;
    if (key === 'referrer') clean = clean.replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0]!.toLowerCase();
    if (key === 'landingPage') clean = clean.split(/[?#]/)[0]!;
    if (key === 'capturedAt' && Number.isNaN(Date.parse(clean))) continue;
    if (clean) out[key] = clean.slice(0, MAX_LEN);
  }
  return Object.keys(out).length ? out : null;
}
