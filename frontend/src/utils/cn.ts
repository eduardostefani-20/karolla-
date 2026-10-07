/** Junta classes condicionais (equivalente leve do clsx). */
export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}
