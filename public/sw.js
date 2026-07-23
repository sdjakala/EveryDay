// Version is informational only — the cache name is fixed so version bumps
// never wipe cached assets and break offline for users.
const VERSION    = "2.1.0";
const SHELL_CACHE = "everyday-shell";
const TRIPS_CACHE = `everyday-trips-v1`;   // versioned separately — survives shell updates
const SYNC_TAG    = "trips-mutations";
const IDB_NAME    = "everyday-offline";
const IDB_STORE   = "mutation-queue";

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore(IDB_STORE, { autoIncrement: true, keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

async function queueMutation(entry) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).add(entry);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

async function getMutations() {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function clearMutations() {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

async function getPendingCount() {
  const mutations = await getMutations();
  return mutations.length;
}

// ── Trips cache helpers ───────────────────────────────────────────────────────

async function cacheTrips(response) {
  const cache = await caches.open(TRIPS_CACHE);
  await cache.put("/api/trips", response.clone());
}

async function getCachedTrips() {
  const cache = await caches.open(TRIPS_CACHE);
  return cache.match("/api/trips");
}

// Optimistically apply a mutation to the cached trip list so the UI stays
// consistent immediately without a round-trip to the server.
async function patchTripsCache(tripData) {
  const cached = await getCachedTrips();
  if (!cached) return;
  try {
    const trips   = await cached.json();
    const updated = trips.map((t) => (t.id === tripData.id ? tripData : t));
    const cache   = await caches.open(TRIPS_CACHE);
    await cache.put("/api/trips", new Response(JSON.stringify(updated), {
      headers: { "Content-Type": "application/json" },
    }));
  } catch (e) {
    console.warn("SW: could not patch trips cache", e);
  }
}

async function deleteFromTripsCache(tripId) {
  const cached = await getCachedTrips();
  if (!cached) return;
  try {
    const trips   = await cached.json();
    const updated = trips.filter((t) => t.id !== tripId);
    const cache   = await caches.open(TRIPS_CACHE);
    await cache.put("/api/trips", new Response(JSON.stringify(updated), {
      headers: { "Content-Type": "application/json" },
    }));
  } catch (e) {
    console.warn("SW: could not remove from trips cache", e);
  }
}

// ── Install / Activate ────────────────────────────────────────────────────────

// Fetch the root HTML, parse out every Next.js chunk URL, and cache them all.
// Called both during install and on demand (REFRESH_CACHE message).
async function populateShellCache() {
  const cache = await caches.open(SHELL_CACHE);
  const shellRes = await fetch("/");
  if (!shellRes.ok) return;
  await cache.put("/", shellRes.clone());

  const html = await shellRes.text();
  const scripts = [...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]);
  const styles  = [...html.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]);

  await Promise.allSettled(
    ["/manifest.json", ...scripts, ...styles].map((url) =>
      fetch(url)
        .then((res) => { if (res.ok) return cache.put(url, res); })
        .catch(() => {})
    )
  );
  console.log(`SW: shell cached — ${scripts.length} scripts, ${styles.length} styles`);
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    populateShellCache().catch((e) => console.warn("SW: install cache failed (offline?)", e))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Enable navigation preload so Chrome for Android can start a network
      // fetch in parallel with SW startup, reducing navigation latency.
      self.registration.navigationPreload?.enable(),
      (async () => {
        const allNames = await caches.keys();
        const newCache = await caches.open(SHELL_CACHE);

        // Migrate entries from old versioned caches into everyday-shell before
        // deleting them — preserves offline coverage for existing users.
        for (const oldName of allNames.filter((n) => n !== SHELL_CACHE && n !== TRIPS_CACHE && n.startsWith("everyday-"))) {
          const old = await caches.open(oldName);
          for (const req of await old.keys()) {
            if (!(await newCache.match(req))) {
              const res = await old.match(req);
              if (res) await newCache.put(req, res);
            }
          }
          console.log("SW: migrated and removed old cache", oldName);
          await caches.delete(oldName);
        }

        // Remove any unexpected cache names
        for (const name of allNames.filter((n) => n !== SHELL_CACHE && n !== TRIPS_CACHE && !n.startsWith("everyday-"))) {
          await caches.delete(name);
        }
      })(),
    ])
  );
  self.clients.claim();
});

// ── Background Sync ───────────────────────────────────────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(replayMutations());
});

// Message handler — clients can ask for pending count or trigger sync
self.addEventListener("message", (event) => {
  if (event.data?.type === "ONLINE")            replayMutations();
  if (event.data?.type === "GET_PENDING_COUNT") respondWithPendingCount(event);
  if (event.data?.type === "CACHE_URLS")        warmCache(event.data.urls);
  if (event.data?.type === "REFRESH_CACHE")     populateShellCache().catch(() => {});
});

// Pre-populate the cache with URLs the page reports having loaded.
// This is how dynamic chunks (e.g. the trips module) get cached after the user
// first visits that part of the app online.
async function warmCache(urls) {
  if (!urls?.length) return;
  const cache = await caches.open(SHELL_CACHE);
  await Promise.allSettled(
    urls.map(async (url) => {
      if (await cache.match(url, { ignoreVary: true })) return;
      return fetch(url)
        .then((res) => { if (res.ok) cache.put(url, res); })
        .catch(() => {});
    })
  );
}

async function respondWithPendingCount(event) {
  const count   = await getPendingCount();
  const clients = await self.clients.matchAll({ type: "window" });
  clients.forEach((c) => c.postMessage({ type: "PENDING_COUNT", count }));
}

async function notifyClients(msg) {
  const clients = await self.clients.matchAll({ type: "window" });
  clients.forEach((c) => c.postMessage(msg));
}

async function replayMutations() {
  const all = await getMutations();
  if (!all.length) return;

  console.log(`SW: replaying ${all.length} offline mutation(s)`);

  // For PATCH on the same URL, keep only the most recent
  const seen    = new Set();
  const toSend  = [];
  for (let i = all.length - 1; i >= 0; i--) {
    const m = all[i];
    if (m.method === "PATCH") {
      if (!seen.has(m.url)) { seen.add(m.url); toSend.unshift(m); }
    } else {
      toSend.unshift(m);
    }
  }

  let allOk = true;
  for (const m of toSend) {
    try {
      const res = await fetch(m.url, {
        method:  m.method,
        headers: m.headers || {},
        body:    m.body ?? undefined,
      });
      if (!res.ok) {
        console.warn(`SW: mutation replay returned ${res.status}`, m.url);
        allOk = false;
      }
    } catch (e) {
      console.warn("SW: still offline during replay", e);
      allOk = false;
      break;
    }
  }

  if (allOk) {
    await clearMutations();
    // Refresh cache with authoritative server data
    try {
      const fresh = await fetch("/api/trips");
      if (fresh.ok) await cacheTrips(fresh);
    } catch (_) {}
    await notifyClients({ type: "TRIPS_SYNCED" });
  }
}

// ── Fetch handler ─────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Auth routes — never intercept, EXCEPT /me which we cache for offline support
  if (url.pathname.startsWith("/api/auth/") && url.pathname !== "/api/auth/me") return;

  // /api/auth/me — network-first, cache fallback so the dashboard keeps the
  // user authenticated offline after at least one successful online session.
  if (url.pathname === "/api/auth/me") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.ok) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        } catch (_) {
          const cached = await caches.match(request, { ignoreVary: true });
          if (cached) return cached;
          return new Response(JSON.stringify({ error: "No session" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
      })()
    );
    return;
  }

  // /api/modules — stale-while-revalidate so the dashboard renders offline.
  if (url.pathname === "/api/modules" && request.method === "GET") {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request, { ignoreVary: true });
        const freshen = fetch(request).then((res) => {
          if (res.ok) { const clone = res.clone(); caches.open(SHELL_CACHE).then((c) => c.put(request, clone)); }
          return res;
        }).catch(() => null);
        // Serve stale immediately and refresh in background; if no cache, wait for network.
        if (cached) { freshen; return cached; }
        return (await freshen) || new Response(JSON.stringify([]), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      })()
    );
    return;
  }

  // Trips API (but not /api/trips/geocode)
  const isTrips = (
    url.pathname === "/api/trips" ||
    (/^\/api\/trips\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/geocode"))
  );
  if (isTrips) {
    event.respondWith(handleTrips(request, url));
    return;
  }

  // All other API routes — network only
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Non-GET requests — pass through
  if (request.method !== "GET") {
    event.respondWith(fetch(request));
    return;
  }

  // External origins — pass through
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  // Page navigations — network-first with shell cache fallback.
  // Use request.mode === "navigate" rather than the Accept header: Chrome in
  // WebAPK / standalone PWA mode sends a different Accept header on launch,
  // which caused the handler to be skipped and the dino page to appear offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          // Use the navigation-preload response when available (Chrome for Android
          // starts this fetch in parallel with SW startup; free latency win).
          const preloaded = await event.preloadResponse;
          const res = preloaded || await fetch(request);
          const clone = res.clone();
          // Store by pathname string, not by Request object, so Vary headers on the
          // response (e.g. Vary: Cookie) don't prevent cache hits on future lookups.
          caches.open(SHELL_CACHE).then((c) => c.put(url.pathname, clone));
          return res;
        } catch (_) {
          // ignoreVary so a changed session cookie doesn't block the cache hit.
          const cached = await caches.match(url.pathname, { ignoreVary: true })
                      || await caches.match("/",           { ignoreVary: true });
          if (cached) return cached;
          return new Response(
            "<!DOCTYPE html><html><head><meta charset=utf-8><title>Offline</title></head>" +
            "<body style='font-family:sans-serif;padding:2rem'>" +
            "<h2>You're offline</h2><p>Reload when you're back online.</p></body></html>",
            { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        }
      })()
    );
    return;
  }

  // Static assets — cache-first
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(request, clone));
        }
        return res;
      }).catch(() =>
        // Return a real error — never fall back to shell HTML here since the
        // browser would try to parse HTML as JavaScript and crash the app.
        new Response("", { status: 503, statusText: "Offline" })
      );
    })
  );
});

// ── Trips fetch logic ─────────────────────────────────────────────────────────

async function handleTrips(request, url) {
  // GET — network-first, cache fallback
  if (request.method === "GET") {
    try {
      const res = await fetch(request.clone());
      if (res.ok && url.pathname === "/api/trips") await cacheTrips(res.clone());
      return res;
    } catch (_) {
      const cached = await getCachedTrips();
      if (cached) return cached;
      // No cache yet — return empty list so the UI doesn't crash
      return new Response(JSON.stringify([]), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
  }

  // PATCH — network, queue on failure
  if (request.method === "PATCH") {
    const body = await request.clone().text();
    try {
      const res = await fetch(request.url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      });
      // Refresh list cache after a successful patch
      if (res.ok) {
        fetch("/api/trips").then((r) => { if (r.ok) cacheTrips(r); }).catch(() => {});
      }
      return res;
    } catch (_) {
      const tripData = JSON.parse(body);
      await queueMutation({
        url: request.url, method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body, timestamp: Date.now(),
      });
      await patchTripsCache(tripData);
      tryRegisterSync();
      const pending = await getPendingCount();
      await notifyClients({ type: "PENDING_COUNT", count: pending });
      return new Response(JSON.stringify(tripData), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
  }

  // DELETE — network, queue on failure
  if (request.method === "DELETE") {
    const tripId = url.pathname.split("/").pop();
    try {
      return await fetch(request.clone());
    } catch (_) {
      await queueMutation({
        url: request.url, method: "DELETE",
        headers: {}, body: null, timestamp: Date.now(),
      });
      await deleteFromTripsCache(tripId);
      tryRegisterSync();
      const pending = await getPendingCount();
      await notifyClients({ type: "PENDING_COUNT", count: pending });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
  }

  // POST (create trip) — requires connectivity; return 503 if offline
  if (request.method === "POST") {
    try {
      return await fetch(request.clone());
    } catch (_) {
      return new Response(
        JSON.stringify({ error: "Cannot create trips while offline" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return fetch(request);
}

function tryRegisterSync() {
  if ("sync" in self.registration) {
    self.registration.sync.register(SYNC_TAG).catch(() => {});
  }
}
