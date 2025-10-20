const CACHE_NAME = 'bcmwriter-v1.0.0';
const ASSETS_TO_CACHE = [
  '/BCMWriter/',
  '/BCMWriter/index.html',
  '/BCMWriter/manifest.json',
  // Remove these lines until you add the icons:
  // '/BCMWriter/icon-192.png',
  // '/BCMWriter/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap'
];

// Install: Cache app assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Add files one by one to handle 404s gracefully
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => 
          cache.add(url).catch(err => {
            console.warn(`Failed to cache ${url}:`, err);
          })
        )
      );
    })
  );
  // Force activate immediately
  self.skipWaiting();
});

// Fetch: Serve from cache when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request).catch(() => {
        // Return a basic offline page if needed
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control immediately
      return self.clients.claim();
    })
  );
});
