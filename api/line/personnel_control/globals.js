// globals.js
// ==========================================
// 🧠 系統共用記憶體 (全域狀態管理)
// ==========================================

// 👤 使用者狀態
let currentUser = null;
let userRole = '一般用戶';

// 📦 系統資料狀態
let currentData = { employees: [], equipment: [] };
let currentView = 'personnel';
let selectedItem = null;

// 🖼️ 圖片與快取狀態
let driveImages = { equipment: {}, personnel: {}, vehicles: {} };
let badImageCache = {}; // 記憶「破圖/無圖」的黑名單

// ⚙️ 系統運行設定
let currentReasons = [];
let syncStatus = { isOnline: true, isSyncing: false, lastSyncTime: null };
let autoRefreshInterval = null;
let autoRefreshEnabled = true;

// 🔍 搜尋防抖狀態
let quickSearchDebounce = null;
let isComposingQuickSearch = false;
let isQuickSearchBound = false; 

// 🚨 撤離系統輪詢狀態
let evacInterval = null;