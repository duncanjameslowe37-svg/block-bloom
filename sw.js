/* Blokaholic service worker: full offline play.
   Bump VERSION on every deploy; the new worker installs, takes over, and the next reload serves the new build. */
const VERSION = 'blokaholic-v5';
const CORE = ['/', '/index.html', '/privacy.html', '/terms.html', '/manifest.webmanifest',
  '/icon-192.png', '/icon-512.png', '/icon-maskable-192.png', '/icon-maskable-512.png',
  '/apple-touch-icon.png', '/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const PAGES = ['privacy.html', 'terms.html'];
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Pages (including challenge links like /?c=...): network first so a reload gets the latest build,
  // falling back to the cached game (query ignored) when offline or slow.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await Promise.race([fetch(req), timeout(3500)]);
        if (res && res.ok) {
          const page = PAGES.find(p => url.pathname.endsWith(p));
          const key = page ? '/' + page : '/index.html';
          cache.put(key, res.clone());
        }
        return res;
      } catch (_) {
        const page = PAGES.find(p => url.pathname.endsWith(p));
        if (page) return (await cache.match('/' + page)) || Response.error();
        return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();
      }
    })());
    return;
  }

  // Static assets: stale-while-revalidate.
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || Response.error();
  })());
});
