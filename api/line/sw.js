// ==========================================
// 1. Firebase 推播背景接收設定 (Web Push)
// ==========================================
// 引入 Firebase SDK (Service Worker 專用版)
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 👇 這裡填入你剛剛在 Firebase 後台拿到的 firebaseConfig
firebase.initializeApp({
    apiKey: "AIzaSyB3dGho1bmt0PsUv5DlG_ZCWmlVPCmFS88",
    authDomain: "hnfa-rescue.firebaseapp.com",
    projectId: "hnfa-rescue",
    storageBucket: "hnfa-rescue.firebasestorage.app",
    messagingSenderId: "958260270342",
    appId: "1:958260270342:web:d18e0c35653a3ab45c3a87",
});

const messaging = firebase.messaging();

// 攔截並顯示背景收到的推播
messaging.onBackgroundMessage((payload) => {
    console.log('📥 在背景收到推播：', payload);

    // 解析推播內容 (相容 Supabase 發送的格式)
    const notificationTitle = payload.notification?.title || '花搜戰情中心';
    const notificationOptions = {
        body: payload.notification?.body || '您有一則新通知',
        icon: './rescue192.png',   // 通知上顯示的小圖示
        badge: './rescue192.png',  // iOS 頂部狀態列的單色圖示
        vibrate: [200, 100, 200, 100, 200] // 震動模式：SOS 節奏
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// 處理使用者點擊通知的動作
self.addEventListener('notificationclick', function(event) {
    console.log('👆 使用者點擊了通知');
    event.notification.close(); // 點擊後關閉通知卡片
    
    // 點擊後自動跳回戰情 App 畫面
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // 如果 App 已經在背景打開，就把畫面叫回最上層
            for (let i = 0; i < windowClients.length; i++) {
                let client = windowClients[i];
                if (client.url.indexOf('app_mission.html') !== -1 && 'focus' in client) {
                    return client.focus();
                }
            }
            // 如果 App 被完全關閉了，就重新打開它
            if (clients.openWindow) {
                return clients.openWindow('./app_mission.html');
            }
        })
    );
});


// ==========================================
// 2. PWA 離線快取設定 (戰備儲糧機制)
// ==========================================
const CACHE_NAME = 'sar-cache-v4'; // 版本號更新，強制刷新快取

// 設定要快取的檔案名單 (包含新寫的 web_push.js)
const urlsToCache = [
    './app_mission.html',
    './manifest.json',
    './rescue192.jpg',
    './rescue512.jpg',
    './mission_folder/task.js',
    './mission_folder/return.js',
    './mission_folder/borrow.js',
    './mission_folder/web_push.js' // 🔥 把推播邏輯檔也冰進冰箱
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('✅ 正在寫入靜態檔案快取');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting(); // 強制立即接管
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
    // 忽略非 GET 請求 (例如 Supabase 的 API 寫入操作)
    if (event.request.method !== 'GET') return;
    
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
