// utils_system.js
// ==========================================
// 🛠️ 系統工具模組 (圖片、原因管理、自動刷新、統計)
// ==========================================

// 🖼️ 1. 圖片處理工具
function getPhotoPath(photoName) {
    if (!photoName || photoName.trim() === '' || photoName === '無') return getDefaultDrivePhoto();
    let cleanName = photoName.trim();
    if (!cleanName.includes('.')) cleanName = cleanName + '.jpg';
    if (badImageCache[cleanName]) return getDefaultDrivePhoto();
    let category = currentView === 'personnel' ? 'personnel' : 'equipment';
    if (driveImages[category] && driveImages[category][cleanName]) {
        return `https://drive.google.com/thumbnail?id=${driveImages[category][cleanName]}&sz=w400`;
    }
    return getDefaultDrivePhoto();
}

function getDefaultDrivePhoto() {
    const category = currentView === 'personnel' ? 'personnel' : 'equipment';
    if (driveImages[category] && driveImages[category]['default.jpg']) {
        return `https://drive.google.com/thumbnail?id=${driveImages[category]['default.jpg']}&sz=w400`;
    }
    return `assets/${category === 'personnel' ? 'people' : 'equipment'}/default.jpg`;
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
}

function saveCustomReasons() {
    try {
        const custom = currentReasons.filter(r => !["任務場地", "購物", "開會", "訓練", "裝備保養", "行政事務", "醫療就診", "裝備測試", "支援其他單位", "裝備領用", "裝備歸還", "其他"].includes(r));
        localStorage.setItem('customReasons', JSON.stringify(custom));
    } catch (e) { console.error('保存自訂原因失敗:', e); }
}

// 📈 3. 統計與同步狀態
function updateStats() {
    const data = currentView === 'personnel' ? currentData.employees : currentData.equipment;
    let booCount = data.filter(item => item.status === (currentView === 'personnel' ? 'BoO' : '在隊')).length;
    let outCount = data.length - booCount;
    document.getElementById('boo-count').textContent = booCount;
    document.getElementById('out-count').textContent = outCount;

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
        updateQuickEvacFAB();
    }
}

// 🕒 4. 自動刷新控制 (不重繪圖片版)
function startAutoRefresh(interval = 30000) {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(async () => {
        if (!syncStatus.isOnline || syncStatus.isSyncing) return;
        try {
            await loadDataFromSupabase();
            updateStats();
            updateChangedCards(); // 🎯 核心：智慧更新，不重繪圖片
        } catch (error) { console.log('自動刷新失敗:', error); }
    }, interval);
}

// 🚨 終極效能優化：智慧比對更新，杜絕網路癱瘓！
function updateChangedCards() {
    const containerId = currentView === 'personnel' ? 'personnel-cards' : 'equipment-cards';
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = currentView === 'personnel' ? currentData.employees : currentData.equipment;
    const existingCards = container.querySelectorAll('.card');

    // 數量不對代表有人員增減，才全面重繪
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
            const currentGroup = currentView === 'personnel' ? item.group : item.category;

            // 群組改變，需重繪群組框
            if (oldGroup !== currentGroup) {
                needsFullRender = true;
            }
            // 🎯 核心：只有當「狀態」或「時間」變了，才單獨抽換這張卡！圖片不會再瘋狂重載！
            else if (oldStatus !== item.status || oldTime !== item.time_status) {
                const newCard = createCardSync(item);
                card.replaceWith(newCard);
            }
        } else {
            needsFullRender = true;
        }
    });

    if (needsFullRender) renderCards();
}
