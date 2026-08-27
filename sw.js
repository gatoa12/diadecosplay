// DiaDeCosplay — Service Worker
// Guarda o "esqueleto" do site em cache pra ele abrir mesmo sem internet.
// Os dados (cosplayers, fotos, eventos) já ficam salvos no localStorage
// do navegador, então continuam aparecendo normalmente offline também.

const CACHE_NAME = 'diadecosplay-v1';
const ARQUIVOS_ESSENCIAIS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_ESSENCIAIS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Só intercepta pedidos do próprio site (não mexe nas chamadas pro Worker/API)
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((resposta) => {
        // Sempre que consegue buscar da rede, atualiza o cache
        const clone = resposta.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return resposta;
      })
      .catch(() => caches.match(event.request)) // sem internet: usa o cache
  );
});
