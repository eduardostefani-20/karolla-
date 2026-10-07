/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
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
