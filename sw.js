const CACHE_NAME = 'kopiplanpro-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
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
      .then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(url.hostname.includes('firebase')||url.hostname.includes('googleapis')||
     url.hostname.includes('gstatic')||url.hostname.includes('open-meteo')||
     event.request.method!=='GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if(cached) return cached;
      return fetch(event.request).then(res => {
        if(!res||res.status!==200) return res;
        const clone=res.clone();
        caches.open(CACHE_NAME).then(c=>c.put(event.request,clone));
        return res;
      }).catch(()=>{ if(event.request.destination==='document') return caches.match('./index.html'); });
    })
  );
});
