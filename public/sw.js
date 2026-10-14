// ============================================================
// Mahayuddh Service Worker: Caching & Web Push Notifications
// Scope: same-origin GET navigations + static assets only.
// NEVER cache: /api/*, POST/PUT/DELETE, cross-origin, or
// authenticated sync routes (stale sync = dishonest proof).
// ============================================================

const CACHE_NAME = "mahayuddh-v2";
const STATIC_ASSETS = ["/", "/offline"];
const API_PREFIX = "/api/";

function isCacheable(request) {
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

// Fetch Event (Network-First with Cache Fallback, cacheable GET only)
self.addEventListener("fetch", (event) => {
  if (!isCacheable(event.request)) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Only cache clean same-origin responses.
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Navigation fallback: never strand the user on a blank page.
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
