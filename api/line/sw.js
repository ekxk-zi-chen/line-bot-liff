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

messaging.onBackgroundMessage((payload) => {
    console.log('📥 收到推播載荷：', payload);
    if (payload.notification) {
        console.log('📢 偵測到系統通知內容，sw.js 略過手動彈窗以避免重複顯示。');
        return; 
    }
    const notificationTitle = '花搜戰情中心';
    const notificationOptions = {
        body: payload.data?.message || '您有一則新任務',
        icon: './rescue192.png',
        tag: 'sar-task-notification'
    };
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 🔥 升級重點 1：點擊通知後，開啟大廳接駁車並傳遞單號！
self.addEventListener('notificationclick', function(event) {
    console.log('👆 使用者點擊了通知');
    event.notification.close(); 
    
    // 試著從 Firebase 的預設結構中抓取推播單號
    const firebaseData = event.notification.data?.FCM_MSG?.data || event.notification.data;
    const notifId = firebaseData?.notifId || '';

    // 🌟 智慧導航：如果有單號，設定為「大廳接駁車」網址；沒有單號就純粹開大廳
    const targetUrl = notifId 
        ? `./lobby.html?redirect=${encodeURIComponent('app_mission.html?notifId=' + notifId)}`
        : './lobby.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // 情況 A：如果 App 已經在背景打開 (不管是在大廳還是裝備系統)
            for (let i = 0; i < windowClients.length; i++) {
                let client = windowClients[i];
                if ((client.url.includes('app_mission.html') || client.url.includes('lobby.html')) && 'focus' in client) {
                    client.focus();
                    // 呼叫前端網頁裡的 web_push.js：「他點了推播喔！趕快跳轉！」
                    return client.postMessage({
                        type: 'notification-clicked',
                        data: { notifId: notifId }
                    });
                }
            }
            // 情況 B：如果 App 被完全關閉了，直接從大廳發車！
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});


// ==========================================
// 2. PWA 離線快取設定 (戰備儲糧機制)
// ==========================================
// 🔥 升級重點 2：強制更新版本號！(v4 -> v5) 這樣手機才會重新下載新的快取
const CACHE_NAME = 'sar-cache-v5'; 

const urlsToCache = [
    './lobby.html', // 🔥 升級重點 3：把大廳加入快取名單！
    './app_mission.html',
    './manifest.json',
    './rescue192.png',
    './rescue512.png',
    './mission_folder/task.js',
    './mission_folder/return.js',
    './mission_folder/borrow.js',
    './mission_folder/web_push.js'
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
