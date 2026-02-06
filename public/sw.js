// Generate version from timestamp or manually update when deploying
const VERSION = "1.1.1"; // UPDATED - Fixed auth callback issue
const CACHE_NAME = `everyday-v${VERSION}`;
const urlsToCache = ["/", "/styles/globals.css", "/manifest.json"];

// Install event - cache essential assets
self.addEventListener("install", (event) => {
  // Force this service worker to become active immediately
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch((error) => {
        console.error("Failed to cache during install:", error);
      });
    })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return self.Promise.all(
        cacheNames.map((cacheName) => {
          // Delete any cache that doesn't match current version
          if (cacheName !== CACHE_NAME) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all clients immediately
  return self.clients.claim();
});

// Fetch event - serve cached assets if available
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // CRITICAL: Never intercept auth routes - let them go directly to the network
  if (url.pathname.startsWith("/api/auth/")) {
    // Just pass through to network without any caching or interception
    return;
  }

  // Never cache API requests - always fetch fresh
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Only cache GET requests for non-API resources
  if (event.request.method !== "GET") {
    event.respondWith(fetch(event.request));
    return;
  }

  // Don't cache requests to external domains (like Google OAuth)
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first strategy for HTML pages
  if (event.request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache the response
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit - return the response from the cached version
      if (response) {
        return response;
      }

      // Clone the request
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest)
        .then((response) => {
          // Check if we received a valid response
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Cache the response
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Network request failed
          return caches.match("/"); // Fallback to home page
        });
    })
  );
});
