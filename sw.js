// Service worker mínim: només desa en caché l'"app shell" (l'HTML, el
// manifest i les icones) perquè es pugui instal·lar i obrir sense connexió.
// Tot el que no sigui d'aquesta llista (Nominatim, OSRM, tiles de mapa,
// Leaflet/Turf per CDN) es deixa passar directament a la xarxa, sense
// interceptar-ho, perquè les rutes i adreces sempre siguin en directe.

const CACHE_NAME = 'zbe-cre-v1';
const APP_SHELL = [
  './ZBE_CRE.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isAppShell = url.origin === self.location.origin &&
    APP_SHELL.some((p) => url.pathname.endsWith(p.replace('./', '/')));
  if (!isAppShell) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
