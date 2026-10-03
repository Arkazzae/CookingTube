/* Public, same-origin application shell only. Never cache API responses, votes,
   generation requests, YouTube video, or third-party content. */
const CACHE = "cooking-tube-pwa-v2";
const PAGES = ["/", "/przepisy", "/ulubione", "/zakupy"];
const CORE = [...PAGES, "/offline.html", "/offline.js", "/manifest.webmanifest", "/icons/app-192.png", "/icons/app-512.png", "/icons/app-maskable-512.png"];
const isAsset = path => /^\/(?:_next\/static\/|assets\/|icons\/|fonts\/|images\/)/.test(path) || ["/offline.js", "/favicon.svg", "/manifest.webmanifest"].includes(path);
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    // First-visit JS/CSS loads before this worker controls the page. Precache the
    // shell's referenced assets explicitly so the next offline launch can hydrate.
    const assets = new Set();
    for (const path of PAGES) {
      const html = await (await cache.match(path)).text();
      for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
        const url = new URL(match[1].replaceAll("&amp;", "&"), self.location.origin);
        if (url.origin === self.location.origin && isAsset(url.pathname)) assets.add(url.href);
      }
    }
    await cache.addAll([...assets]);
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("cooking-tube-pwa-") && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
async function remember(request, response) {
  if (!response.ok || response.type === "opaque") return;
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
  // Keep immutable application code and fonts; bound optional images and recipe
  // page shells. Recipe data itself lives in the app's validated local library.
  const optional = (await cache.keys()).filter(key => /^\/(?:images\/|przepis\/)/.test(new URL(key.url).pathname));
  for (const key of optional.slice(0, Math.max(0, optional.length - 80))) await cache.delete(key);
}
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  const appPage = PAGES.includes(url.pathname) || /^\/przepis\/[\w-]+(?:\/gotuj)?$/.test(url.pathname);
  if (request.mode === "navigate" && appPage) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error("Page unavailable");
        if (response.headers.get("content-type")?.includes("text/html")) event.waitUntil(remember(url.pathname, response.clone()));
        return response;
      } catch { return await caches.match(url.pathname) || await caches.match("/offline.html") || Response.error(); }
    })());
    return;
  }
  // Cache successful RSC navigations separately from HTML (query string and
  // request headers included). This lets already-visited Next routes work offline.
  if (appPage && request.headers.get("rsc") === "1") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { signal: AbortSignal.timeout(5000) });
        if (response.ok) event.waitUntil(remember(request, response.clone()));
        return response;
      } catch { return await caches.match(request) || Response.error(); }
    })());
    return;
  }
  if (isAsset(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      event.waitUntil(remember(request, response.clone()));
      return response;
    })());
  }
});
