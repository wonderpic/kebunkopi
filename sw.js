const CACHE_NAME = 'kopiplanpro-v3';

// Only cache static assets - NOT index.html
// index.html must always be fresh to ensure correct auth state
const STATIC_ASSETS = [
  './css/style.css',
  './js/app.js',
  './assets/logo.png',
  './assets/bg.jpg',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip Firebase, Google APIs, Open-Meteo - always network
  if(url.hostname.includes('firebase') ||
     url.hostname.includes('googleapis') ||
     url.hostname.includes('gstatic') ||
     url.hostname.includes('open-meteo') ||
     event.request.method !== 'GET') return;

  // HTML files - Network First (always fresh)
  if(event.request.destination === 'document' ||
     url.pathname.endsWith('.html') ||
     url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Update cache with fresh version
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static assets - Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if(cached) return cached;
      return fetch(event.request).then(res => {
        if(!res || res.status !== 200) return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      });
    })
  );
});

self.addEventListener('message', event => {
  if(event.data === 'skipWaiting') self.skipWaiting();
});
