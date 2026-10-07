const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 12345 -> "R$ 123,45" */
export function formatCents(cents: number): string {
  // Intl usa espaço não separável; normalizamos para espaço comum (melhor para WhatsApp/planilhas).
  return brl.format(cents / 100).replace(/ /g, ' ');
}

/** 123.45 -> 12345 (arredondamento seguro) */
export function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

export function centsToReais(cents: number): number {
  return cents / 100;
}

/** Aceita "123,45", "123.45", "R$ 1.234,50" e retorna centavos, ou null se inválido. */
export function parseMoneyInput(value: string): number | null {
  const cleaned = value.replace(/[R$\s]/g, '');
  if (!cleaned) return null;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return reaisToCents(n);
}
