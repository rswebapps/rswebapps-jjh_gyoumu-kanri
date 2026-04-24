// ── 授業改革推進業務実施記録 Service Worker ──────────────────
// キャッシュ名（バージョンアップ時は変更する）
const CACHE_NAME = 'gyomu-kiroku-v1';

// キャッシュ対象ファイル
const CACHE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // 外部CDN（オフライン時も使えるようにキャッシュ）
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/ical.js/1.5.0/ical.min.js',
];

// ── インストール：ファイルをキャッシュ ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 外部CDNは失敗してもインストールを止めない
      const local  = CACHE_FILES.filter(f => !f.startsWith('http'));
      const remote = CACHE_FILES.filter(f =>  f.startsWith('http'));
      return cache.addAll(local).then(() =>
        Promise.allSettled(remote.map(url => cache.add(url)))
      );
    })
  );
  self.skipWaiting();
});

// ── アクティベート：古いキャッシュを削除 ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── フェッチ：キャッシュ優先・フォールバックはネットワーク ──
self.addEventListener('fetch', event => {
  // POST など GET 以外はスキップ
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // 成功したレスポンスのみキャッシュに追加
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // オフラインかつキャッシュなし → index.htmlを返す（SPAフォールバック）
      return caches.match('./index.html');
    })
  );
});
