import type { AppointmentAttribution } from '@karolla/shared';

/**
 * Origem do visitante para saber quais campanhas trazem agendamentos.
 * Guarda no navegador (por 30 dias) os parâmetros do link do anúncio — UTM e identificadores de clique —
 * e o site de onde a pessoa veio. Vai junto com o agendamento e aparece no painel. Nada é enviado a terceiros.
 */
const KEY = 'karolla:origem';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

const PARAMS: [string, keyof AppointmentAttribution][] = [
  ['utm_source', 'utmSource'],
  ['utm_medium', 'utmMedium'],
  ['utm_campaign', 'utmCampaign'],
  ['utm_content', 'utmContent'],
  ['utm_term', 'utmTerm'],
  ['gclid', 'gclid'],
  ['gbraid', 'gclid'],
  ['wbraid', 'gclid'],
  ['fbclid', 'fbclid'],
  ['ttclid', 'ttclid'],
];

function read(): AppointmentAttribution | null {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as AppointmentAttribution | null;
    if (!stored?.capturedAt || Date.now() - Date.parse(stored.capturedAt) > TTL_MS) return null;
    return stored;
  } catch {
    return null;
  }
}

function externalReferrer(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const host = new URL(document.referrer).hostname.toLowerCase();
    return host && host !== window.location.hostname ? host : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Chamado ao abrir o site. Uma nova campanha (ou um novo site de origem) substitui a anterior;
 * acesso direto mantém a última origem conhecida (o cliente que viu o anúncio ontem e voltou hoje).
 */
export function captureAttribution(url: URL = new URL(window.location.href)) {
  if (url.pathname.startsWith('/admin')) return;
  const found: AppointmentAttribution = {};
  for (const [param, key] of PARAMS) {
    const value = url.searchParams.get(param)?.trim();
    if (value && !found[key]) found[key] = value.slice(0, 200);
  }
  const referrer = externalReferrer();
  if (referrer) found.referrer = referrer;
  const current = read();
  if (!Object.keys(found).length && current) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...found, landingPage: url.pathname, capturedAt: new Date().toISOString() }));
  } catch {
    /* sem armazenamento: o agendamento segue sem origem */
  }
}

export function getAttribution(): AppointmentAttribution | null {
  return read();
}
