import { defineConfig } from 'tsup';

/** Build de produção: um único bundle ESM; o pacote @karolla/shared (TypeScript) é embutido. */
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@karolla/shared'],
});
