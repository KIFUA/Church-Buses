const CACHE_NAME = 'church-bus-v4';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', event => {
  // Skip cross-origin requests like Google Sheets/Apps Script - always network
  if (event.request.url.includes('docs.google.com') || event.request.url.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network First strategy: try network, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Only cache successful local responses or specific CDNs
        if (response && response.status === 200 && (
          event.request.url.startsWith(self.location.origin) || 
          event.request.url.includes('tailwind') || 
          event.request.url.includes('unpkg')
        )) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
