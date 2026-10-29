/* 離線快取：一律先走網路（確保拿到最新版），失敗才用快取。
   路徑相對於 sw.js 本身，才能在 /biz-english-4000/ 子路徑下運作。 */
const CACHE = 'biz4000-v4';
const CRITICAL = ['./', './index.html', './app.js', './style.css', './data.json', './manifest.webmanifest', './sync.js', './merge.js', './firebase-config.js'];
const OPTIONAL = ['./icon.svg', './icon-180.png', './icon-192.png', './icon-512.png'];

function abs(path) {
  return new URL(path, self.location).href;
}

async function put(cache, path) {
  const url = abs(path);
  const res = await fetch(url, { cache: 'reload' });
  if (!res.ok || (res.type && res.type !== 'basic' && res.type !== 'default')) {
    throw new Error(`${path} ${res.status}`);
  }
  await cache.put(url, res.clone());
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(CRITICAL.map(path => put(cache, path)));
    await Promise.all(OPTIONAL.map(path => put(cache, path).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  const scopePath = new URL('./', self.location).pathname;
  if (!url.pathname.startsWith(scopePath)) return;

  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic' && res.status !== 206) {
        const copy = res.clone();
        const cacheKey = url.origin + url.pathname + url.search;
        caches.open(CACHE).then(cache => cache.put(cacheKey, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true })
        || await caches.match(url.origin + url.pathname);
      if (hit) return hit;
      if (req.mode === 'navigate') {
        return (await caches.match(abs('./index.html')))
          || (await caches.match(abs('./')))
          || Response.error();
      }
      return Response.error();
    }
  })());
});
