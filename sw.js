const CACHE_NAME = 'cd-calc-cache-v1';

// Essential static files to cache right away
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// 1. Install Event: Cache all our static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Clean up old caches if we update CACHE_NAME
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// 3. Fetch Event: Serve from cache if available, otherwise fetch from internet and cache the result (e.g. for Google Fonts)
self.addEventListener('fetch', (event) => {
  // We only want to handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached file if found
      if (cachedResponse) {
        return cachedResponse;
      }
      // Otherwise fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Check for a valid response, allow "opaque" responses for 3rd party Google fonts
        if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
          return networkResponse;
        }
        
        // Clone the response because it can only be consumed once
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        
        return networkResponse;
      }).catch(err => {
        // Fallback if network fails completely and file isn't in cache
        console.log('Fetch failed; returning offline page instead.', err);
      });
    })
  );
});
