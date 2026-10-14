/* Karolla Pet — service worker do app instalável.
 * Regras de privacidade: NUNCA guarda respostas da API (/api/*), dados de login ou páginas de outros sites.
 * Guarda só os arquivos do próprio site (código, estilos, ícones), para abrir rápido e com sinal fraco. */
const VERSION = 'v1';
const SHELL = `karolla-shell-${VERSION}`;
const ASSETS = `karolla-assets-${VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(['/', OFFLINE_URL, '/icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('karolla-') && k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fotos do Supabase, pixels etc.: direto da rede
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return; // dados sempre da rede

  // Páginas: sempre tenta a versão mais nova; sem internet, usa a última versão do site ou a página offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((cache) => cache.put('/', copy));
          }
          return res;
        })
        .catch(async () => (await caches.match('/')) || (await caches.match(OFFLINE_URL))),
    );
    return;
  }

  // Arquivos com nome versionado (/assets/*): nunca mudam, podem vir do cache.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((cache) => cache.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Ícones e imagens do site: usa o cache e atualiza em segundo plano.
  if (/\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(req);
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || fresh;
      }),
    );
  }
});
