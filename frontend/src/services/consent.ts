/**
 * Consentimento de cookies de anúncios (LGPD).
 * Nenhum pixel (Meta, Google Ads, TikTok) é carregado antes de o visitante tocar em "Aceitar".
 * A escolha fica só neste navegador e pode ser mudada em "Preferências de cookies" no rodapé.
 */
export type ConsentChoice = 'granted' | 'denied';

const KEY = 'karolla:consentimento';
const VERSION = 1;
export const CONSENT_CHANGED = 'karolla:consent-changed';
export const CONSENT_OPEN = 'karolla:consent-open';

export function readConsent(): ConsentChoice | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { v: number; choice: ConsentChoice } | null;
    return raw?.v === VERSION && (raw.choice === 'granted' || raw.choice === 'denied') ? raw.choice : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: ConsentChoice) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, choice, at: new Date().toISOString() }));
  } catch {
    /* navegador sem armazenamento: a escolha vale só nesta página */
  }
  window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_CHANGED, { detail: choice }));
}

/** Reabre o aviso de cookies (link "Preferências de cookies"). */
export function openConsentPreferences() {
  window.dispatchEvent(new Event(CONSENT_OPEN));
}
