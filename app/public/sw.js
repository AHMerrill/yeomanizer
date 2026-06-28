// Minimal offline service worker for the yeomanizer.
//
// It caches ONLY the app's own static assets, so the tool keeps working offline / air-gapped after the
// first load. It never caches your content: your draft lives in memory, exports are downloaded as blobs
// (no network request), enclosures are read with FileReader (no network request), and this worker only
// ever sees same-origin GET requests for app files. POSTs — including the content-free page/download
// counter — and any cross-origin request are passed straight through and never stored. No document
// content ever reaches the cache.

const CACHE = 'yeomanizer-shell-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Same-origin GETs for app assets only. POSTs and cross-origin are left untouched.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Never cache the API (the content-free page/download counter) — always straight to the network.
  if (url.pathname.startsWith('/api/')) return;

  // Navigation / HTML: network-first so a new deploy lands immediately; fall back to cache when offline.
  const isNav = req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html');
  if (isNav) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('/'))),
    );
    return;
  }

  // Hashed build assets are immutable: serve from cache first, populating it on the first fetch.
  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
