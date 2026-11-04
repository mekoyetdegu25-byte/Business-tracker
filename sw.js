const CACHE_NAME = 'hanitech-v1';
const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './manifest.json'
];

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate (Clear old caches)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// Fetch (Network First, fallback to Cache)
self.addEventListener('fetch', event => {
  // Firebase API calls እንዳይያዙ መጠበቅ
  if (event.request.url.includes('firebase') || event.request.url.includes('googleapis')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
