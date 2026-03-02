const CACHE_NAME = 'sar-cache-v3';

// 設定要快取的檔案名單 (全部在同層)
const urlsToCache = [
  './app_mission.html',
  './manifest.json',
  './rescue192.png',
  './rescue512.png',
  './mission_folder/borrow.js',
  './mission_folder/return.js',
  './mission_folder/task.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ 正在寫入靜態檔案快取');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
