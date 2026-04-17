self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', () => {
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Просто пропускаємо запити до мережі
    event.respondWith(fetch(event.request));
});