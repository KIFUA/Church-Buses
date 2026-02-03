const CACHE_NAME = 'church-bus-v3';
const urlsToCache = ['./', './index.html', './manifest.json'];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force this service worker to become active immediately
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim()); // Take control of all clients immediately
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); // Delete old caches
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // Якщо запит йде до Google Sheets або Google Apps Script — ЗАВЖДИ йти в мережу (ігнорувати кеш)
  if (event.request.url.includes('docs.google.com') || event.request.url.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});