// ==========================================
// 🚀 花搜戰情中心 - Web Push 與 FCM SDK 模組
// 說明：引入此檔案即可擁有 PWA/iOS/Android 推播與背景喚醒功能
// ==========================================

// --- 1. Firebase 基礎設定 (PWA / iOS 推播) ---
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

// --- 2. 模組全域變數 ---
// 用來存放從通知單號查回來的裝備 ID 陣列
let notifEqIdsArray = null;

// --- 3. 核心功能：推播權限與 Token 處理 ---
// 主動向 iOS Safari / Chrome 討要推播權限與 Token (無殼版)
async function requestWebPushPermission() {
    try {
        console.log('📱 正在請求 PWA 推播權限...');
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            console.log('✅ 使用者允許了通知權限！');
            const currentToken = await messaging.getToken({ 
                vapidKey: 'BNjLp2TiYRLb6NnU4otv18bfKXC1l_kQRCB7JU990ts4xgyNYP-EGqs6pkILT1ppnVB7gWH5CbEqLo_SO3okYVg',
                serviceWorkerRegistration: window.swRegistration 
            });
            
            if (currentToken) {
                console.log("🔥 成功取得 PWA (iOS/Web) 專屬 Token:", currentToken);
                performTokenUpdate(currentToken);
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

// 接收來自 Android 殼的 Token
window.setFCMToken = function (token) {
    console.log("從手機 App 取得 Token:", token);
    if (typeof userEmail !== 'undefined' && userEmail) {
        performTokenUpdate(token);
    } else {
        window.tempFCMToken = token;
    }
};

// 執行 Supabase 更新 (遵循 RLS)
async function performTokenUpdate(token) {
    if (typeof _supabase === 'undefined' || typeof userEmail === 'undefined') return;
    const { error } = await _supabase
        .from('users')
        .update({ fcm_token: token })
        .eq('電子信箱', userEmail);
    if (error) console.error("同步 Token 失敗:", error.message);
    else console.log("🎉 Token 已安全同步");
}

// --- 4. Deep Link 與緊急任務過濾 ---
// 處理推播點擊與 URL 參數跳轉
async function checkDeepLink(directNotifId = null) {
    let notifId = directNotifId;
    if (!notifId) {
        const urlParams = new URLSearchParams(window.location.search);
        notifId = urlParams.get('notifId');
    }
    if (!notifId) return;

    if (typeof toggleLoader === 'function') toggleLoader(true, "讀取最新狀態...");
    try {
        if (typeof _supabase === 'undefined') throw new Error("Supabase 未初始化");
        
        const { data, error } = await _supabase
            .from('notification_queue')
            .select('involved_eq_ids')
            .eq('id', notifId)
            .single();
            
        if (data && data.involved_eq_ids) {
            notifEqIdsArray = data.involved_eq_ids.split(',').filter(Boolean);
            
            // 嘗試更新主庫存 (如果有引入 GAS API 函數)
            if (typeof callGasApi === 'function' && typeof userId !== 'undefined') {
                const newData = await callGasApi({ action: 'get_equipment_list', userId: userId, category: 'All' });
                // 更新 HTML 的全域變數 equipmentCache
                if (typeof equipmentCache !== 'undefined') {
                    equipmentCache = (newData && newData.length > 0) ? newData : [];
                }
            }
            // 觸發外部渲染
            if (typeof renderEquipmentList === 'function') renderEquipmentList(); 
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    } catch (err) {
        console.error("無法讀取通知或權限不足", err);
    } finally {
        if (typeof toggleLoader === 'function') toggleLoader(false);
    }
}

// 清除通知過濾，返回完整名單
function clearNotifFilter() {
    notifEqIdsArray = null;
    const url = new URL(window.location);
    url.searchParams.delete('notifId');
    window.history.pushState({}, '', url);
    if (typeof renderEquipmentList === 'function') renderEquipmentList(); 
}

// --- 5. 系統設定 (通知偏好) ---
async function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    modal.classList.add('flex');
    modal.classList.remove('hidden');
    
    try {
        if (typeof _supabase === 'undefined' || typeof userId === 'undefined') return;
        const { data, error } = await _supabase
            .from('users')
            .select('notification_pref')
            .eq('user_id', userId)
            .single();
        
        if (data && data.notification_pref) {
            const radios = document.getElementsByName('notif_pref');
            for (let r of radios) {
                if (r.value === data.notification_pref) r.checked = true;
            }
        } else {
            const defaultRadio = document.querySelector('input[name="notif_pref"][value="All"]');
            if (defaultRadio) defaultRadio.checked = true;
        }
    } catch (err) {
        console.error("讀取設定失敗:", err);
    }
}

async function saveSettings() {
    const prefElement = document.querySelector('input[name="notif_pref"]:checked');
    if (!prefElement) return;
    const pref = prefElement.value;
    
    if (typeof toggleLoader === 'function') toggleLoader(true, "儲存設定中...");
    try {
        if (typeof _supabase === 'undefined' || typeof userId === 'undefined') throw new Error("環境變數未準備好");
        const { data, error } = await _supabase.rpc('update_notification_pref', {
            p_user_id: userId,
            p_pref: pref
        });
        if (error) throw new Error(error.message);
        if (data && data.success === false) throw new Error(data.message);
        
        alert("✅ 推播設定已成功更新！");
        if (typeof closeModal === 'function') closeModal('settings-modal');
    } catch (e) {
        alert("儲存失敗: " + e.message);
    } finally {
        if (typeof toggleLoader === 'function') toggleLoader(false);
    }
}

// --- 6. 介面與事件監聽 ---
// 產生 App 內紫色推播彈窗
function showInAppNotification(payload) {
    const title = payload.notification?.title || "新通知";
    const body = payload.notification?.body || "";
    const notifId = payload.data?.notifId;

    const toast = document.createElement('div');
    toast.className = "fixed top-4 left-4 right-4 bg-indigo-900/95 border border-indigo-500 text-white p-4 rounded-xl shadow-2xl z-[100] transform transition-transform duration-300 -translate-y-[150%] backdrop-blur-sm";
    toast.innerHTML = `
        <div class="flex justify-between items-start">
            <div>
                <h4 class="font-bold text-lg mb-1 text-yellow-400">🔔 ${title}</h4>
                <p class="text-sm text-indigo-100 whitespace-pre-line">${body}</p>
            </div>
            <button class="text-gray-400 hover:text-white p-1 text-xl" onclick="this.parentElement.parentElement.classList.add('-translate-y-[150%]'); setTimeout(() => this.parentElement.parentElement.remove(), 300)">✕</button>
        </div>
        ${notifId ? `<button class="mt-3 w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded-lg font-bold text-sm shadow border border-indigo-400 active:scale-95 transition-transform" onclick="checkDeepLink('${notifId}'); this.parentElement.classList.add('-translate-y-[150%]'); setTimeout(() => this.parentElement.remove(), 300)">立即查看</button>` : ''}
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('-translate-y-[150%]'));

    setTimeout(() => {
        if(document.body.contains(toast)) {
            toast.classList.add('-translate-y-[150%]');
            setTimeout(() => toast.remove(), 300);
        }
    }, 8000);
}

// 註冊 Service Worker 與全域監聽器
function initPushSDK() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => {
                    console.log('✅ FCM SDK: Service Worker 註冊成功', reg.scope);
                    window.swRegistration = reg;
                })
                .catch(err => console.error('❌ FCM SDK: Service Worker 註冊失敗', err));
        });

        // 監聽 Service Worker 傳來的背景/前景訊號
        navigator.serviceWorker.addEventListener('message', (event) => {
            console.log("📥 FCM SDK: 收到底層訊號:", event.data);
            const firebaseData = event.data?.firebaseMessaging || event.data;
            const payload = firebaseData?.payload || firebaseData;
            const msgType = firebaseData?.type; 
            const notifId = payload?.data?.notifId;
            
            if (!notifId) return;

            if (msgType === 'notification-clicked') {
                console.log("🚀 FCM SDK: 背景點擊，執行跳轉...");
                checkDeepLink(notifId);
                return;
            }
            console.log("✨ FCM SDK: 前景收到訊息，顯示彈窗...");
            showInAppNotification(payload);
        });
    }

    // 監聽 App 熱啟動 (從背景滑回來)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log("👀 FCM SDK: 偵測到畫面喚醒，檢查推播單號...");
            checkDeepLink(); 
        }
    });
}

// 🔥 自動啟動 SDK
initPushSDK();
