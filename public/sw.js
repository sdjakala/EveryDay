const VERSION    = "2.0.0";
const SHELL_CACHE = `everyday-v${VERSION}`;
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

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Fetch each resource independently so one 404 can't abort the whole install
      Promise.allSettled(
        ["/", "/manifest.json"].map((url) =>
          fetch(url).then((res) => {
            if (res.ok) return cache.put(url, res);
            console.warn("SW: skipping non-ok resource during install", url, res.status);
          }).catch((e) => console.warn("SW: failed to fetch during install", url, e))
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== SHELL_CACHE && n !== TRIPS_CACHE)
          .map((n) => {
            console.log("SW: removing old cache", n);
            return caches.delete(n);
          })
      )
    )
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
});

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

  // Auth routes — never intercept
  if (url.pathname.startsWith("/api/auth/")) return;

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

  // HTML pages — network-first, fall back to cached page then app shell
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(SHELL_CACHE).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const shell = await caches.match("/");
          if (shell) return shell;
          return new Response(
            "<!DOCTYPE html><html><head><meta charset=utf-8><title>Offline</title></head>" +
            "<body style='font-family:sans-serif;padding:2rem'>" +
            "<h2>You're offline</h2><p>Reload when you're back online.</p></body></html>",
            { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        })
    );
    return;
  }

  // Static assets — cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok && res.type === "basic")
          caches.open(SHELL_CACHE).then((c) => c.put(request, res.clone()));
        return res;
      }).catch(() => caches.match("/"));
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
