/* Tarot service worker: caches the static app shell (plus, since v10, the last good copy of read-only /api GETs for link drops) so the app opens instantly.
   Never caches /api writes, uploads, journal PDF/images, meditate audio, login/logout or anything private.
   Bump VERSION whenever index.html / app.css / app.js / practice*.js change so phones pick up the update. */
const VERSION = "tarot-shell-v19";
const NG = {};
const SHELL = [
  "/", "/app.css?v=19", "/app.js?v=19", "/practice-data.js?v=19", "/practice.js?v=19", "/config.js", "/vendor/supabase.js?v=19", "/vendor/astronomy.browser.min.js?v=19", "/places.js?v=19", "/astro.js?v=19", "/backend.js?v=19", "/appearance.js?v=19", "/settings.js?v=19", "/compat.js?v=19", "/compat-kb.js?v=19", "/compat-story.js?v=19", "/compat-ui.js?v=19", "/data/cards.json", "/login", "/manifest.webmanifest",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png", "/icons/favicon-32.png",
];
// v10: last good copy of a few read-only /api GETs, served only while the public link is down
const API_CACHE = "tarot-api-v1";
const API_RE = /^$/;   // v17: data comes from Supabase (backend.js keeps its own offline copy)
const CACHE_OK = (res) => res && res.ok && !res.redirected && res.type === "basic";
const STATIC_RE = /^\/(app\.css|app\.js|practice\.js|practice-data\.js|backend\.js|appearance\.js|settings\.js|compat(-kb|-story|-ui)?\.js|astro\.js|places\.js|vendor\/[\w.-]+\.js|data\/cards\.json|manifest\.webmanifest|icons\/[\w.-]+\.png|(deck-img|deck-thumb)\/[a-z0-9]{4}\.jpg)$/;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(SHELL.map(async (url) => {
      try { const res = await fetch(url, { cache: "no-store", credentials: "same-origin", headers: NG }); if (CACHE_OK(res)) await cache.put(url, res); } catch (_) { /* offline: skip */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== API_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;

  // App shell page: serve cached copy instantly, refresh it in the background.
  if (req.mode === "navigate" && (p === "/" || p === "/index.html")) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match("/");
      const fresh = fetch("/", { cache: "no-store", credentials: "same-origin", headers: NG }).then((res) => {
        if (CACHE_OK(res)) cache.put("/", res.clone());
        return res;
      }).catch(() => null);
      if (cached) { e.waitUntil(fresh); return cached; }
      return (await fresh) || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
    })());
    return;
  }

  // Versioned static assets + public-domain card art (full size and /deck-thumb/ thumbnails): cache-first.
  if (STATIC_RE.test(p)) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req, { ignoreSearch: /^\/deck-/.test(p) });
      if (hit) return hit;
      try {
        const res = await fetch(req.url, { credentials: "same-origin", headers: NG });
        if (CACHE_OK(res) && (res.headers.get("content-type") || "").match(/image|css|javascript|json|manifest/)) { cache.put(p.startsWith("/deck-") ? p : req, res.clone()); return res; }
        if (CACHE_OK(res)) return res;
        throw new Error("bad response " + res.status);
      } catch (err) {   // link drop: any cached copy of the same picture (full or thumbnail) beats a blank card
        const alt = p.startsWith("/deck-img/") ? await cache.match(p.replace("/deck-img/", "/deck-thumb/")) : null;
        if (alt) return alt;
        return Response.error();
      }
    })());
  }
  // Read-only API data: network first; on a drop / ngrok error page, serve the last good copy marked offline.
  if (API_RE.test(p)) {
    e.respondWith((async () => {
      const cache = await caches.open(API_CACHE);
      let res = null;
      try { res = await fetch(req.url, { cache: "no-store", credentials: "same-origin", headers: NG }); } catch (_) {}
      const ct = (res && res.headers.get("content-type")) || "";
      if (res && res.ok && ct.includes("json")) { cache.put(p, res.clone()); return res; }
      if (res && res.status === 401) return res;
      const hit = await cache.match(p);
      if (hit) {
        const h = new Headers(hit.headers); h.set("X-Tarot-Offline", "1");
        return new Response(await hit.blob(), { status: 200, headers: h });
      }
      return res || new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "Content-Type": "application/json", "X-Tarot-Offline": "1" } });
    })());
    return;
  }
  // Everything else (/api, /uploads, /journal*, /meditate, /login, ...) goes straight to the network.
});
