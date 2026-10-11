import type { Config } from 'tailwindcss';

/**
 * Identidade visual KarollaPet. Cores, fontes, raios e sombras vêm de variáveis CSS em
 * src/styles/theme.css (fonte única). Nenhuma cor fixa aqui.
 */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const palette = (name: string, shades: number[]) => Object.fromEntries(shades.map((shade) => [shade, v(`${name}-${shade}`)]));

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // tokens oficiais
        primary: { DEFAULT: v('color-primary'), dark: v('color-primary-dark'), light: v('color-primary-light') },
        secondary: { DEFAULT: v('color-secondary') },
        accent: { DEFAULT: v('color-accent') },
        whatsapp: { DEFAULT: v('color-whatsapp'), dark: v('color-whatsapp-dark') },
        'bg-soft': v('color-bg-soft'),
        // escalas derivadas
        brand: palette('brand', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        leaf: palette('leaf', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        sun: palette('sun', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        lilac: palette('lilac', [50, 100, 200]),
        ink: palette('ink', [400, 500, 600, 700, 800, 900]),
        danger: palette('danger', [50, 100, 200, 400, 500, 600, 700, 900]),
      },
      fontFamily: {
        // Pacifico: só títulos grandes (hero, títulos de seção). Nunca em menus, botões ou textos longos.
        display: ['var(--font-display)'],
        // Nunito: todo o resto (texto, menus, botões, formulários, títulos de cards e números)
        sans: ['var(--font-body)'],
        heading: ['var(--font-body)'],
      },
      fontSize: {
        'display-hero': ['var(--text-display-hero)', { lineHeight: '1.25' }],
        'display-section': ['var(--text-display-section)', { lineHeight: '1.3' }],
        'display-page': ['var(--text-display-page)', { lineHeight: '1.3' }],
      },
      borderRadius: { '4xl': '2rem', card: 'var(--radius-md)', 'brand-sm': 'var(--radius-sm)', 'brand-lg': 'var(--radius-lg)', pill: 'var(--radius-pill)' },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        card: 'var(--shadow-card)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        pop: { '0%': { transform: 'scale(.9)', opacity: '0' }, '100%': { transform: 'none', opacity: '1' } },
      },
      animation: {
        'fade-up': 'fade-up .5s ease-out both',
        'fade-in': 'fade-in .35s ease-out both',
        float: 'float 6s ease-in-out infinite',
        pop: 'pop .25s ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
