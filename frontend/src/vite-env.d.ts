/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL pública da API (vazio = mesma origem, via proxy /api). Nunca coloque segredos em variáveis VITE_. */
  readonly VITE_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
