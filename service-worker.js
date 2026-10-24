const CACHE_NAME = 'prompt-library-v4';
const CORE_FILES = [
  './index.html',
  './src/styles.css',
  './src/main.js',
  './src/style-gallery.js',
  './src/catalog.js',
  './src/data/catalog.json',
  './src/data/ip-series.json',
  './src/data/style-gallery.json',
  './src/data/layout-gallery.json',
  './src/data/color-gallery.json',
  './manifest.webmanifest',
  './public/app-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.endsWith('/admin.html') || url.pathname.endsWith('/src/config.js')) return;
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
      }
      return response;
    }).catch(async () => (await caches.match(event.request)) || Response.error())
  );
});
