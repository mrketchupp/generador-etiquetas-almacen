'use strict';

/**
 * Service worker: hace que la app funcione sin conexión una vez
 * instalada/cargada. Estrategia "stale-while-revalidate": se responde
 * al instante desde caché y en segundo plano se descarga la versión
 * nueva, que quedará lista para la siguiente visita — así las
 * actualizaciones llegan solas sin bloquear el uso offline.
 *
 * Al añadir un archivo nuevo a la app, inclúyelo en ASSETS.
 */
const CACHE_NAME = 'etiquetas-almacen-v1';

const ASSETS = [
    './',
    'index.html',
    'manifest.webmanifest',
    'css/styles.css',
    'css/print.css',
    'js/utils.js',
    'js/store.js',
    'js/layout.js',
    'js/labels.js',
    'js/csv.js',
    'js/xlsx.js',
    'js/gemini.js',
    'js/tables.js',
    'js/inventory.js',
    'js/transfer.js',
    'js/preview.js',
    'js/app.js',
    'icons/icon-192.png',
    'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    // Solo GET del mismo origen: las llamadas a la API de Gemini y los
    // logos por URL externa siguen yendo directo a la red.
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cacheKey = request.mode === 'navigate' ? './' : request;
        const cached = await cache.match(cacheKey);

        const network = fetch(request)
            .then((response) => {
                if (response.ok) cache.put(cacheKey, response.clone());
                return response;
            })
            .catch(() => cached);

        return cached || network;
    })());
});
