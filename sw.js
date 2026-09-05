// DiaDeCosplay — Service Worker
// Guarda o "esqueleto" do site em cache pra ele abrir mesmo sem internet.
// Os dados (cosplayers, fotos, eventos) já ficam salvos no localStorage
// do navegador, então continuam aparecendo normalmente offline também.
//
// ✅ CORREÇÃO (05/09/2026): o fetch() da rede não tinha {cache:'no-store'},
// então o próprio navegador podia responder com uma cópia antiga guardada
// por ELE (sem nem chegar na internet de verdade) — o Service Worker
// achava que era fresco e guardava aquilo, prolongando a versão velha
// indefinidamente. Isso explicava aparelhos diferentes travados em
// números diferentes (68, 79, 81, 82...). Também subimos a versão do
// cache pra forçar a limpeza da versão anterior em todo mundo, uma vez.

const CACHE_NAME = 'diadecosplay-v2'; // mudou de v1 pra v2 — força renovar em todo mundo, uma vez
const ARQUIVOS_ESSENCIAIS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(ARQUIVOS_ESSENCIAIS.map((url) =>
        fetch(url, { cache: 'no-store' }).then((resp) => cache.put(url, resp)).catch(() => {})
      ))
    )
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
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((resposta) => {
        const clone = resposta.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return resposta;
      })
      .catch(() => caches.match(event.request))
  );
});
