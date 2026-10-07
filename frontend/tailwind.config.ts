import type { Config } from 'tailwindcss';

/** Identidade visual Karolla Pet: teal acolhedor + coral afetivo sobre creme. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effaf9',
          100: '#d6f2ef',
          200: '#ade4df',
          300: '#79cfc8',
          400: '#45b2ab',
          500: '#279790',
          600: '#1b7a75',
          700: '#19625f',
          800: '#184f4d',
          900: '#163f3e',
          950: '#082626',
        },
        coral: {
          50: '#fff4ef',
          100: '#ffe5da',
          200: '#ffc8b3',
          300: '#ffa384',
          400: '#ff7d57',
          500: '#f65d34',
          600: '#e2441d',
          700: '#bc3415',
          800: '#952c17',
          900: '#792816',
        },
        sun: { 100: '#fff3cc', 200: '#ffe699', 300: '#ffd666', 400: '#ffc533', 500: '#f5ae00' },
        cream: { 50: '#fffcf8', 100: '#fff7ee', 200: '#fdebd8' },
        ink: { 400: '#6b7280', 500: '#4b5563', 600: '#374151', 700: '#273142', 800: '#1c2433', 900: '#111827' },
      },
      fontFamily: {
        display: ['Fredoka', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: { '4xl': '2rem' },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(22, 63, 62, 0.25)',
        card: '0 2px 10px -2px rgba(22, 63, 62, 0.08), 0 1px 2px rgba(22, 63, 62, 0.06)',
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
