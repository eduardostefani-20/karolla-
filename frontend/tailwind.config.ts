import type { Config } from 'tailwindcss';

/** Cores vêm de variáveis CSS em src/styles/theme.css (fonte única da paleta da marca). */
const palette = (name: string, shades: number[]) =>
  Object.fromEntries(shades.map((shade) => [shade, `rgb(var(--${name}-${shade}) / <alpha-value>)`]));

/** Identidade visual Karolla Pet. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: palette('brand', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        coral: palette('coral', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        sun: palette('sun', [100, 200, 300, 400, 500]),
        cream: palette('cream', [50, 100, 200]),
        ink: palette('ink', [400, 500, 600, 700, 800, 900]),
      },
      fontFamily: {
        display: ['Fredoka', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: { '4xl': '2rem' },
      boxShadow: {
        soft: '0 10px 30px -12px rgb(var(--brand-900) / 0.25)',
        card: '0 2px 10px -2px rgb(var(--brand-900) / 0.08), 0 1px 2px rgb(var(--brand-900) / 0.06)',
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
