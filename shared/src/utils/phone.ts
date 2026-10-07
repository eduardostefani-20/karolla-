/** Remove tudo que não for dígito. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Normaliza um celular brasileiro para 11 dígitos (DDD + número).
 * Remove o DDI 55 se presente.
 */
export function normalizeBrazilianPhone(value: string): string {
  let digits = onlyDigits(value);
  if (digits.length === 13 && digits.startsWith('55')) digits = digits.slice(2);
  return digits;
}

/** Celular válido: DDD (11-99) + 9 + 8 dígitos. */
export function isValidBrazilianMobile(value: string): boolean {
  const digits = normalizeBrazilianPhone(value);
  if (!/^\d{11}$/.test(digits)) return false;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99 || digits[2] !== '9') return false;
  // rejeita sequências óbvias como 99999999999
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

/** Máscara progressiva: "11999999999" -> "(11) 99999-9999" */
export function formatPhone(value: string): string {
  const d = normalizeBrazilianPhone(value).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Converte para o formato internacional usado pelo WhatsApp (55 + DDD + número). */
export function toWhatsAppInternational(value: string): string {
  const digits = onlyDigits(value);
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits}`;
}

/** Link "click to chat" oficial do WhatsApp. */
export function buildWhatsAppLink(number: string, text?: string): string {
  const base = `https://wa.me/${toWhatsAppInternational(number)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
