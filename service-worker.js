const CACHE_NAME = 'bcmwriter-v1.0.1'; // Changed version to force update
const ASSETS_TO_CACHE = [
  '/BCMWriter/',
  '/BCMWriter/index.html',
  '/BCMWriter/manifest.json',
  '/BCMWriter/icon-192.png',
  '/BCMWriter/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap'
];

// Domains that should NEVER be cached
const NEVER_CACHE_DOMAINS = [
  'bcmwriter.goldenjanitors.workers.dev',
  'accounts.google.com',
  'googleapis.com',
  'gstatic.com',
  'google.com',
  'oauth2.googleapis.com'
];

// Install: Cache app assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // Force the waiting service worker to become active
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
    })
  );
  self.clients.claim(); // Take control of all pages immediately
});

// Fetch: Serve from cache when offline, but NEVER cache auth/API requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // CRITICAL: Never intercept auth/API requests - let them pass through
  if (NEVER_CACHE_DOMAINS.some(domain => url.hostname.includes(domain))) {
    return; // Don't call event.respondWith() - let the request go through normally
  }
  
  // CRITICAL: Never cache POST requests (they're usually API calls)
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Cache strategy for static assets only
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request);
    })
  );
});