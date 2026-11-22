// ============================================================
// Mahayuddh Service Worker: public/static caching & Web Push
// Scope: same-origin GETs only. Never cache API, auth, or app-page
// responses: those can vary by signed-in user and must not cross sessions.
// ============================================================

const CACHE_NAME = "mahayuddh-v3";
const STATIC_ASSETS = ["/", "/offline"];
const STATIC_ASSET_PATHS = new Set([
  ...STATIC_ASSETS,
  "/apple-icon.png",
  "/badge.png",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/icon.svg",
]);
const API_PREFIX = "/api/";

function sameOriginGet(request) {
  if (request.method !== "GET") return false;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith(API_PREFIX)) return false;
  if (url.pathname.startsWith("/auth/")) return false;
  return true;
}

function isCacheable(request) {
  if (!sameOriginGet(request)) return false;
  const url = new URL(request.url);
  return STATIC_ASSET_PATHS.has(url.pathname) || url.pathname.startsWith("/_next/static/");
}

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate Event — drop old versioned caches.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Network-first for same-origin reads; only public/static responses are cached.
// Uncached app navigations still fall back to the offline hub when disconnected.
self.addEventListener("fetch", (event) => {
  if (!sameOriginGet(event.request)) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          isCacheable(event.request) &&
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === "basic"
        ) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(async () => {
        if (isCacheable(event.request)) {
          const cached = await caches.match(event.request);
          if (cached) return cached;
        }
        if (event.request.mode === "navigate") {
          const offline = await caches.match("/offline");
          if (offline) return offline;
        }
        throw new Error("offline");
      })
  );
});

// Web Push Notification Event
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || "⚔️ Mahayuddh Alert";
    const options = {
      body: payload.body || "New update in your DSA Arena.",
      icon: payload.icon || "/icon-192.png",
      badge: "/badge.png",
      data: payload.data || { url: "/" },
      vibrate: [200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error("Error processing push notification:", error);
  }
});

// Notification Click Event
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
