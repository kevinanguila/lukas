// Service worker: Lukas funciona sin internet.
// Sube VERSION cada vez que se publique un cambio para que el iPhone baje la nueva versión.
const VERSION = 'lukas-v1.0.1';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/nav.js',
  './js/store.js',
  './js/seed.js',
  './js/dates.js',
  './js/money.js',
  './js/parser.js',
  './js/lukas.js',
  './js/ui.js',
  './js/pin.js',
  './js/ics.js',
  './js/trm.js',
  './js/views/home.js',
  './js/views/movs.js',
  './js/views/chat.js',
  './js/views/plan.js',
  './js/views/settings.js',
  './js/views/txform.js',
  './js/views/checklist.js',
  './js/views/payday.js',
  './js/views/onboarding.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // TRM y demás: directo a la red
  // Red primero (para recibir actualizaciones), caché si no hay internet
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
