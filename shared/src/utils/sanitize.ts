/**
 * Sanitização de texto livre vindo de formulários.
 * Remove tags HTML, caracteres de controle e espaços excedentes.
 * (A renderização no React já escapa conteúdo; isto protege planilhas, mensagens e outros consumidores.)
 */
export function sanitizeText(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Evita "formula injection" ao exportar para planilhas (valores iniciados por = + - @).
 */
export function sanitizeSpreadsheetCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
