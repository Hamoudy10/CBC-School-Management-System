/**
 * Service worker for offline-first capabilities
 * Handles network request interception, caching, and background sync
 */
// This file would be served as a static asset and registered in the frontend
// For now, we'll create the code that would go in a service worker

const CACHE_NAME = 'cbc-school-offline-v1';
const OFFLINE_PAGE = '/offline.html';
const API_CACHE_NAME = 'api-cache-v1';

// Resources to precache
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  // Add other static assets as needed
];

// API endpoints to cache (with network-first strategy)
const API_ENDPOINTS_TO_CACHE = [
  '/api/students',
  '/api/classes',
  '/api/subjects',
  '/api/terms',
  // Add other reference data endpoints
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME && 
                 cacheName !== API_CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // Handle API requests
  if (request.method === 'GET' && url.pathname.startsWith('/api/')) {
    event.respondWith(
      handleApiRequest(request)
    );
    return;
  }
  
  // Handle navigation requests for offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      handleNavigationRequest(request)
    );
    return;
  }
  
  // For everything else, use cache-first strategy
  event.respondWith(
    handleStaticAssetRequest(request)
  );
});

/**
 * Handle API requests with network-first strategy
 * Falls back to cache if network fails
 */
async function handleApiRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // If successful, put a copy in cache
    if (networkResponse && networkResponse.status === 200) {
      const responseClone = networkResponse.clone();
      caches.open(API_CACHE_NAME)
        .then(cache => cache.put(request, responseClone));
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request, { cacheName: API_CACHE_NAME });
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If neither network nor cache works, return error
    return new Response(JSON.stringify({
      error: 'Network error and no cached response available',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle navigation requests with offline fallback
 */
async function handleNavigationRequest(request) {
  try {
    // Try to fetch the network response
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // If network fails, return offline page
    return caches.match(OFFLINE_PAGE, { cacheName: CACHE_NAME });
  }
}

/**
 * Handle static asset requests with cache-first strategy
 */
async function handleStaticAssetRequest(request) {
  const cachedResponse = await caches.match(request, { cacheName: CACHE_NAME });
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // If both cache and network fail, return a basic error response
    return new Response('Offline fallback content not available', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

/**
 * Background sync handler
 * Processes queued operations when network is available
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(processSyncQueue());
  }
});

/**
 * Process the offline sync queue
 * This would communicate with the main application via postMessage
 * or use a more sophisticated backend sync mechanism
 */
async function processSyncQueue() {
  // In a real implementation, this would:
  // 1. Open IndexedDB and get pending operations
  // 2. Send them to the server via fetch/ajax
  // 3. Update local storage based on server response
  // 4. Handle conflicts and errors appropriately
  
  // For now, we'll post a message to the main thread
  // The main application would handle the actual sync logic
  
  self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'TRIGGER_SYNC',
        payload: { timestamp: Date.now() }
      });
    });
  });
}

/**
 * Handle messages from the main thread
 */
self.addEventListener('message', (event) => {
  const { data } = event;
  
  if (data.type === 'UPDATE_CACHE') {
    // Update specific cached resources
    caches.open(CACHE_NAME).then(cache => {
      cache.addAll(data.urls || []);
    });
  }
});
