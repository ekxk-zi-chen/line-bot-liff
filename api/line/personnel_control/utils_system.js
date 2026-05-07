// utils_system.js
// ==========================================
// 🛠️ 系統工具模組 (圖片、原因管理、自動刷新、統計)
// ==========================================

// 🖼️ 1. 圖片處理工具 (已升級三向判斷)
function getPhotoPath(photoName) {
    if (!photoName || photoName.trim() === '' || photoName === '無') return getDefaultDrivePhoto();
    let cleanName = photoName.trim();
    if (!cleanName.includes('.')) cleanName = cleanName + '.jpg';
    if (badImageCache[cleanName]) return getDefaultDrivePhoto();

    // 🎯 修正：精準對應 driveImages 的三個分類
    let category = 'personnel';
    if (currentView === 'equipment') category = 'equipment';
    if (currentView === 'vehicle') category = 'vehicles';

    if (driveImages[category] && driveImages[category][cleanName]) {
        return `https://drive.google.com/thumbnail?id=${driveImages[category][cleanName]}&sz=w400`;
    }
    return getDefaultDrivePhoto();
}

function getDefaultDrivePhoto() {
    // 🎯 修正：精準對應預設圖路徑
    let category = 'personnel';
    if (currentView === 'equipment') category = 'equipment';
    if (currentView === 'vehicle') category = 'vehicles';

    if (driveImages[category] && driveImages[category]['default.jpg']) {
        return `https://drive.google.com/thumbnail?id=${driveImages[category]['default.jpg']}&sz=w400`;
    }
    
    // 備援：本地路徑
    const folder = category === 'personnel' ? 'people' : category;
    return `assets/${folder}/default.jpg`;
}

// 📝 2. 原因管理與本地存儲 (localStorage)
function initReasons() {
    currentReasons = ["任務場地", "購物", "開會", "訓練", "裝備保養", "行政事務", "醫療就診", "裝備測試", "支援其他單位", "裝備領用", "裝備歸還", "其他"];
    try {
        const saved = localStorage.getItem('customReasons');
        if (saved) {
            const custom = JSON.parse(saved);
            currentReasons = [...currentReasons.filter(r => r !== "其他"), ...custom, "其他"];
        }
    } catch (e) { console.warn('載入自訂原因失敗:', e); }
    initGroupSortWeights();
}

// 🗂️ 2.5 群組排序權重狀態初始化 (已補上車輛)
function initGroupSortWeights() {
    try {
        const savedWeights = localStorage.getItem('groupSortWeights');
        if (savedWeights) {
            groupSortWeights = JSON.parse(savedWeights);
            
            // 🎯 防呆：確保三種物件都存在，避免新舊版格式衝突
            if (!groupSortWeights.personnel) groupSortWeights.personnel = {};
            if (!groupSortWeights.equipment) groupSortWeights.equipment = {};
            if (!groupSortWeights.vehicle) groupSortWeights.vehicle = {}; 
        }
    } catch (e) {
        console.warn('載入群組排序設定失敗:', e);
    }
}

function saveGroupSortWeights() {
    try {
        localStorage.setItem('groupSortWeights', JSON.stringify(groupSortWeights));
    } catch (e) {
        console.error('保存群組排序設定失敗:', e);
    }
}

// 🚀 終極群組排序引擎 (已升級三向判斷)
function customGroupSort(a, b) {
    // 🎯 修正：精準抓取三種權重表
    let weights = groupSortWeights.personnel;
    if (currentView === 'equipment') weights = groupSortWeights.equipment;
    if (currentView === 'vehicle') weights = groupSortWeights.vehicle;
    
    const weightA = weights[a] !== undefined ? weights[a] : 999;
    const weightB = weights[b] !== undefined ? weights[b] : 999;

    if (weightA !== weightB) {
        return weightA - weightB;
    }

    return a.localeCompare(b, 'zh-TW', { numeric: true });
}

// 📈 3. 統計與同步狀態 (已升級三向判斷)
function updateStats() {
    // 🎯 修正：抓取正確的資料源
    let data = currentData.employees;
    if (currentView === 'equipment') data = currentData.equipment;
    if (currentView === 'vehicle') data = currentData.vehicles;

    // 🎯 修正：判斷狀態文字 (人員用 BoO，其餘用 在隊)
    const booStatusText = (currentView === 'personnel') ? 'BoO' : '在隊';
    
    let booCount = data.filter(item => item.status === booStatusText).length;
    let outCount = data.length - booCount;

    document.getElementById('boo-count').textContent = booCount;
    document.getElementById('out-count').textContent = outCount;

    // 撤離系統連動 (僅限人員模式)
    if (currentView === 'personnel') {
        const isEvacOngoing = currentData.employees.some(p => p.evac_status && p.evac_status !== 'NONE');
        const evacIcon = document.getElementById('evac-alert-icon');
        if (isEvacOngoing) {
            if (evacIcon) { evacIcon.style.animation = 'heartbeat 0.8s infinite'; evacIcon.style.color = 'var(--neon-red)'; }
            document.body.classList.add('evac-active');
        } else {
            if (evacIcon) { evacIcon.style.animation = 'none'; evacIcon.style.color = 'var(--text-dim)'; }
            document.body.classList.remove('evac-active');
        }
        if (typeof updateQuickEvacFAB === 'function') updateQuickEvacFAB();
    }
}

// 🕒 4. 自動刷新控制
function startAutoRefresh(interval = 30000) {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(async () => {
        if (!syncStatus.isOnline || syncStatus.isSyncing) return;
        try {
            await loadDataFromSupabase();
            updateStats();
            updateChangedCards(); 
        } catch (error) { console.log('自動刷新失敗:', error); }
    }, interval);
}

// 🚨 終極效能優化：智慧比對更新 (已由長官更新完成)
function updateChangedCards() {
    let containerId = 'personnel-cards';
    if (currentView === 'equipment') containerId = 'equipment-cards';
    if (currentView === 'vehicle') containerId = 'vehicle-cards';
    const container = document.getElementById(containerId);
    if (!container) return;

    let data = currentData.employees;
    if (currentView === 'equipment') data = currentData.equipment;
    if (currentView === 'vehicle') data = currentData.vehicles;
    const existingCards = container.querySelectorAll('.card');

    if (existingCards.length !== data.length) {
        renderCards();
        return;
    }

    let needsFullRender = false;

    data.forEach(item => {
        const card = container.querySelector(`.card[data-id="${item.id}"]`);
        if (card) {
            const oldStatus = card.getAttribute('data-status');
            const oldTime = card.getAttribute('data-time');
            const oldGroup = card.getAttribute('data-group');
            const currentGroup = currentView === 'equipment' ? item.category : item.group;

            if (oldGroup !== currentGroup) {
                needsFullRender = true;
            } else if (oldStatus !== item.status || oldTime !== item.time_status) {
                const newCard = createCardSync(item);
                card.replaceWith(newCard);
            }
        } else {
            needsFullRender = true;
        }
    });

    if (needsFullRender) renderCards();
}