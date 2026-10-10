/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Endereço oficial do site (domínio registrado no Registro.br). Usado em canonical, Open Graph,
 * sitemap.xml e robots.txt. Para outro domínio, defina VITE_SITE_URL no build.
 */
const SITE_URL = (process.env.VITE_SITE_URL || 'https://karollapet.com.br').replace(/\/+$/, '');
/** Páginas públicas que o Google deve indexar. */
const PUBLIC_PAGES = ['/', '/agendar', '/inspiracoes', '/privacidade'];

function seo(): Plugin {
  return {
    name: 'karolla-seo',
    // 'pre': troca antes de o Vite analisar os links do HTML
    transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('%SITE_URL%', SITE_URL) },
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      const urls = PUBLIC_PAGES.map((p) => `  <url><loc>${SITE_URL}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n');
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), seo()],
  define: { __SITE_URL__: JSON.stringify(SITE_URL) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Em desenvolvimento, /api é encaminhado para o back-end (evita CORS e não expõe nada extra).
    proxy: { '/api': { target: process.env.VITE_DEV_API_PROXY ?? 'http://localhost:3333', changeOrigin: true } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: process.env.VITE_DEV_API_PROXY ?? 'http://localhost:3333', changeOrigin: true } },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], forms: ['react-hook-form', '@hookform/resolvers', 'zod'] },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
