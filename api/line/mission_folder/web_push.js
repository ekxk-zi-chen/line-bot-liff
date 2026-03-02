// ==========================================
// 🚀 Firebase Web Push 專用邏輯 (PWA / iOS 支援)
// ==========================================

// 1. 填寫你的 Firebase 專案設定檔 (去 Firebase 後台拿)
const firebaseConfig = {
    apiKey: "AIzaSyB3dGho1bmt0PsUv5DlG_ZCWmlVPCmFS88",
    authDomain: "hnfa-rescue.firebaseapp.com",
    projectId: "hnfa-rescue",
    storageBucket: "hnfa-rescue.firebasestorage.app",
    messagingSenderId: "958260270342",
    appId: "1:958260270342:web:d18e0c35653a3ab45c3a87"
};

// 確保 Firebase 只被初始化一次
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const messaging = firebase.messaging();

// 2. 主動向 iOS Safari / Chrome 討要推播權限與 Token
async function requestWebPushPermission() {
    try {
        console.log('📱 正在請求 PWA 推播權限...');
        // 詢問使用者是否允許通知
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            console.log('✅ 使用者允許了通知權限！');
            
            // 向 Google 索取專屬的 Web FCM Token
            // ⚠️ 這裡要放入你的 VAPID Key (網頁推播憑證)
            const currentToken = await messaging.getToken({ 
                vapidKey: 'BNjLp2TiYRLb6NnU4otv18bfKXC1l_kQRCB7JU990ts4xgyNYP-EGqs6pkILT1ppnVB7gWH5CbEqLo_SO3okYVg',
                // 告訴 Firebase 使用我們自己寫的 sw.js
                serviceWorkerRegistration: window.swRegistration 
            });
            
            if (currentToken) {
                console.log("🔥 成功取得 PWA (iOS/Web) 專屬 Token:", currentToken);
                
                // 呼叫 app_mission.html 裡的函數，存回 Supabase
                if (typeof performTokenUpdate === 'function') {
                    performTokenUpdate(currentToken);
                }
            } else {
                console.log('⚠️ 拿不到 Token，請確認 VAPID Key 設定。');
            }
        } else {
            console.log('❌ 使用者拒絕了通知');
        }
    } catch (error) {
        console.error('取得 Web Push Token 失敗:', error);
    }
}

// 3. (選擇性) 當 App 打開在畫面上時，收到推播的處理
messaging.onMessage((payload) => {
    console.log('收到前景推播:', payload);
    // 你可以在這裡跳出一個客製化的 alert 或 toast 提醒隊員
});
