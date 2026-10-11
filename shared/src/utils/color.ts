/**
 * Cores que a administradora escolhe para cada profissional (gravadas no banco em hex).
 * Todas da paleta KarollaPet — sem rosa forte nem azul forte.
 */
export const PROFESSIONAL_COLORS = [
  { hex: '#6A1FA0', name: 'Roxo' },
  { hex: '#9B5FD0', name: 'Lilás' },
  { hex: '#3D0E63', name: 'Roxo profundo' },
  { hex: '#8A9A1C', name: 'Verde-oliva' },
  { hex: '#566011', name: 'Verde musgo' },
  { hex: '#F9B21D', name: 'Amarelo-ouro' },
  { hex: '#B97C04', name: 'Dourado' },
  { hex: '#645275', name: 'Cinza-lavanda' },
] as const;

export const DEFAULT_PROFESSIONAL_COLOR = PROFESSIONAL_COLORS[0].hex;

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Texto legível sobre uma cor de fundo (WCAG): 'dark' (roxo profundo) para fundos claros como amarelo
 * e verde-oliva, 'light' (branco) para os demais. Valores que não são hex retornam 'light'.
 */
export function readableTextOn(hex: string): 'light' | 'dark' {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 'light';
  const bg = luminance(hex);
  const white = 1.05 / (bg + 0.05);
  const dark = (bg + 0.05) / (luminance('#3D0E63') + 0.05);
  return dark > white ? 'dark' : 'light';
}
