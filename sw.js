// ============================================================
// CAMPUSNEXUS - SERVICE WORKER (FIXED)
// ============================================================

const CACHE_NAME = 'campusnexus-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/admin-login.html',
  '/css/style.css',
  '/js/script.js',
  '/images/logo-icon.png',
  '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Only cache what we know exists
        return cache.addAll(urlsToCache).catch(err => {
          console.log('Cache addAll error:', err);
          // Try to cache individually
          urlsToCache.forEach(url => {
            cache.add(url).catch(e => console.log('Failed to cache:', url, e));
          });
        });
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const request = event.request;
  
  // Skip non-HTTP/HTTPS requests (chrome-extension, etc.)
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // Skip requests for chrome-extension
  if (request.url.includes('chrome-extension')) {
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = request.clone();
        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              // Only cache if it's a valid URL
              if (request.url.startsWith('http') && !request.url.includes('chrome-extension')) {
                cache.put(request, responseToCache).catch(() => {});
              }
            });
          return response;
        });
      })
      .catch(() => {
        // Offline fallback
        return new Response('Offline - Please check your internet connection', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
  );
});

// Skip waiting on install
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
