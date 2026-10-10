/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL pública da API (vazio = mesma origem, via proxy /api). Nunca coloque segredos em variáveis VITE_. */
  readonly VITE_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Endereço oficial do site (ex.: https://karollapet.com.br) — definido no vite.config.ts. */
declare const __SITE_URL__: string;
