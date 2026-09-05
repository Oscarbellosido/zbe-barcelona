// Service worker mínim: només desa en caché l'"app shell" (l'HTML, el
// manifest i les icones) perquè es pugui instal·lar i obrir sense connexió.
// Tot el que no sigui d'aquesta llista (Nominatim, OSRM, tiles de mapa,
// Leaflet/Turf per CDN) es deixa passar directament a la xarxa, sense
// interceptar-ho, perquè les rutes i adreces sempre siguin en directe.
//
// Estratègia "network-first": sempre intenta la xarxa abans que la caché,
// perquè les actualitzacions de ZBE_CRE.html es vegin de seguida; la caché
// només s'usa com a reserva quan no hi ha connexió. Puja CACHE_NAME (v2, v3...)
// si mai cal forçar que tothom refresqui la caché de cop.

const CACHE_NAME = 'zbe-cre-v8';
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

// La pàgina envia 'skipWaiting' quan l'usuari toca "Actualitza" al bàner de
// versió nova: fa que aquest worker prengui el relleu sense esperar que es
// tanquin totes les pestanyes.
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
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
  // GitHub Pages envia Cache-Control: max-age=600, així que un fetch normal
  // pot tornar una còpia de la memòria cau HTTP del navegador encara que
  // aquí forcem "xarxa primer". { cache: 'reload' } salta aquesta memòria
  // cau i sempre valida contra el servidor.
  event.respondWith(
    fetch(event.request, { cache: 'reload' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
