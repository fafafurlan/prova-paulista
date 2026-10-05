/* Service worker do Dá pra passar? (simulador do Provão Paulista 2026).
 * Rede primeiro (o site sempre mostra a versão mais nova quando há internet);
 * sem internet, usa a última cópia guardada. O ranking (/api) e as estatísticas
 * (/_vercel) nunca são guardados. */
const CACHE = "pp26-v1";
const PRECACHE = ["./", "privacidade", "cursos.json", "escolas.json", "manifest.webmanifest", "icons/icon-192.png", "og.png"];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
    if (hit) return hit;
    if (req.mode === "navigate") return (await cache.match("./")) || Response.error();
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_vercel/")) return;
    e.respondWith(networkFirst(req));
  } else if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(cacheFirst(req));
  }
});
