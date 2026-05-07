

// DOM 載入完成後啟動
document.addEventListener('DOMContentLoaded', function () {
    setupNetworkListeners();
    initReasons();
    initializeApp();
    setupEventListeners();
});

// ==========================================
// 🚀 2. 應用初始化與直連驗證 (驗證三連)
// ==========================================
async function initializeApp() {
    try {
        checkNetworkStatus();

        // 1. 直連驗證：判斷身分與權限
        await verifyUserDirect();

        // 2. 載入資料 (直接從資料庫拉取)
        await loadDataFromSupabase();
        initDriveImagesAsync();

        // 3. 渲染畫面
        updateStats();
        renderGroupControls();
        renderCards();

        if (userRole === '管理') enableAdminFeatures();

        updateSyncStatus('connected', '資料載入完成');
        if (autoRefreshEnabled) startAutoRefresh(30000);

    } catch (error) {
        console.error('初始化失敗：', error);
        updateSyncStatus('error', `初始化失敗：${error.message}`);
    }
}

// 返回導航頁面
function goBack() {
    window.location.href = '../lobby.html';
}


// 設定事件監聽器
function setupEventListeners() {
    // 檢視切換按鈕
    document.querySelectorAll('.view-btn').forEach(item => {
        item.addEventListener('click', function () {
            switchView(this.dataset.view);
        });
    });

    // 關閉彈窗按鈕
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', function () {
            this.closest('.modal').style.display = 'none';
        });
    });

    // 點擊彈窗外關閉 (修復記憶體洩漏漏洞)
    window.addEventListener('click', function (event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                // 🚨 關鍵修復：這裡本來是 modal.style.display = 'none'
                // 改成呼叫 closeModal，才能確實清除隱形的鍵盤監聽器！
                closeModal(modal.id);
            }
        });
    });

    // 點擊可折疊面板外關閉
    window.addEventListener('click', function (event) {
        const infoPanel = document.getElementById('info-panel');
        const historyPanel = document.getElementById('history-panel');

        if (infoPanel.classList.contains('show') && !event.target.closest('.info-panel') &&
            !event.target.closest('[onclick*="toggleInfoPanel"]')) {
            infoPanel.classList.remove('show');
        }

        if (historyPanel.classList.contains('show') && !event.target.closest('.history-panel') &&
            !event.target.closest('[onclick*="toggleHistoryPanel"]')) {
            historyPanel.classList.remove('show');
        }
    });
}

// ==========================================
// 🚀 完美融合版：切換檢視模式 (人員 / 器材 / 車輛)
// ==========================================
function switchView(view) {
    currentView = view;

    // 1. 更新頂部按鈕發光狀態 (使用正確的 .view-btn)
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    // 2. 動態顯示對應的卡片區域 (支援無限擴充，不再寫死！)
    document.querySelectorAll('.cards-container').forEach(container => {
        container.classList.toggle('active', container.id === `${view}-cards`);
    });

    // 3. 更新標題文字
    updateViewTitle();

    // 4. 重繪底下所有卡片與群組
    renderView();
}

// 更新視圖標題 (支援車輛模式，並修復吃掉返回按鈕的 Bug)
function updateViewTitle() {
    const titleElement = document.querySelector('.logo');
    if (titleElement) {
        // 判斷當前模式的文字
        let modeText = '人員管制';
        if (currentView === 'equipment') modeText = '器材管制';
        if (currentView === 'vehicle') modeText = '車輛管制';

        // 🚨 注意：不能用 textContent，否則會把裡面的 🏠 返回按鈕吃掉！
        titleElement.innerHTML = `
            <button class="back-btn" onclick="window.location.href='../lobby.html'">🏠</button>
            ${modeText}
        `;
    }
}

// 渲染完整視圖
function renderView() {
    updateStats();
    renderGroupControls();
    renderCards();
    // 🎯 核心火力支援：如果快速控制面板正打開著，就順便刷新它裡面的名單！
    const quickModal = document.getElementById('quick-modal');
    if (quickModal && quickModal.style.display === 'block') {
        renderQuickControlList(); // 重繪快速控制清單
        
        // 🛡️ 貼心防護：如果您剛剛有輸入「搜尋關鍵字」，重繪後幫您把過濾條件套用回去，避免搜尋結果跑掉！
        const searchInput = document.getElementById('search-input');
        if (searchInput && searchInput.value.trim() !== '') {
            if (typeof filterQuickControlList === 'function') {
                filterQuickControlList(searchInput.value.trim().toLowerCase());
            }
        }
    }
}


// ==========================================
// 🚀 批次/選取 更新控制塔
// ==========================================

// 批次更新群組狀態 (支援傳入 specificIds)
async function batchUpdateGroupStatus(groupName, newStatus, specificIds = null) {
    if (userRole !== '管理') return showNotification('只有管理員可以批次更新');

    if (newStatus === '外出' || newStatus === '應勤') {
        // 開啟原因彈窗，並把選取的 IDs 傳遞過去
        showGroupReasonModal(groupName, newStatus, specificIds);
    } else {
        await performBatchGroupUpdateViaAPI(groupName, newStatus, '', specificIds);
    }
}


// 實際執行 Supabase 更新 (支援車輛版)
async function performBatchGroupUpdateViaAPI(groupName, newStatus, reason, specificIds = null) {
    try {
        // 🎯 升級 1：選取正確資料源
        let data = currentData.employees;
        if (currentView === 'equipment') data = currentData.equipment;
        if (currentView === 'vehicle') data = currentData.vehicles;

        // 🎯 升級 2：選取正確群組欄位 (人員/車輛用 group，器材用 category)
        let groupItems = data.filter(item => {
            const groupKey = currentView === 'equipment' ? item.category : item.group;
            return groupKey === groupName;
        });

        if (specificIds) {
            groupItems = groupItems.filter(item => specificIds.includes(String(item.id)));
        }

        showNotification(`🚀 正在更新 ${groupItems.length} 筆資料...`);

        // 啟動靜音模式寫入資料庫
        const promises = groupItems.map(item => performStatusUpdateDirect(item.id, newStatus, reason, true));
        await Promise.all(promises);

        await loadDataFromSupabase();
        renderView();
        showNotification(`✅ 更新完成`);
    } catch (error) {
        console.error('群組更新失敗：', error);
        showNotification(`❌ 更新失敗：${error.message}`);
    }
}

// 實際執行群組批次更新的函數
function performBatchGroupUpdate(groupName, newStatus, reason) {
    const data = currentView === 'personnel' ? currentData.employees : currentData.equipment;
    let updatedCount = 0;

    data.forEach(item => {
        const groupKey = currentView === 'personnel' ? item.group : item.category;
        if (groupKey === groupName) {
            const oldStatus = item.status;
            item.status = newStatus;
            const currentTime = getCurrentTime();
            item.time_status = currentTime;

            // 更新歷史紀錄
            const historyText = item.time_history || '';
            const historyLines = historyText.split('\n').filter(line => line.trim());

            let historyEntry = newStatus;
            if (reason && (newStatus === '外出' || newStatus === '應勤')) {
                historyEntry += ` (${reason})`;
            }
            historyEntry += ' ' + currentTime;

            historyLines.unshift(historyEntry);

            if (historyLines.length > 10) {
                historyLines.length = 10;
            }

            item.time_history = historyLines.join('\n');
            updatedCount++;

            // 立即更新該項目卡片
            updateSingleCard(item);
        }
    });

    // 顯示通知
    let notificationMsg = `${groupName} 已更新 ${updatedCount} 筆資料為 ${getStatusDisplayText(newStatus)}`;
    if (reason) {
        notificationMsg += `，原因：${reason}`;
    }
    showNotification(notificationMsg);

    updateStats();  // 更新統計數字

}

// 手動刷新圖片
function refreshDriveImages() {
    console.log('手動刷新 Google Drive 圖片...');

    // 顯示載入中訊息
    showNotification('正在重新載入圖片...');

    // 清空現有映射
    driveImages = {
        equipment: {},
        personnel: {},
        vehicles: {}
    };

    // 重新載入
    initDriveImagesAsync();

    // 5秒後嘗試更新圖片
    setTimeout(() => {
        updateImagesForCurrentView();
        showNotification('圖片更新完成');
    }, 5000);
}

// 檢查圖片載入狀態
function checkImageStatus() {
    console.log('=== 圖片載入狀態 ===');
    console.log('器材圖片:', Object.keys(driveImages.equipment).length, '張');
    console.log('人員圖片:', Object.keys(driveImages.personnel).length, '張');
    console.log('車輛圖片:', Object.keys(driveImages.vehicles).length, '張');

    // 顯示在通知中
    const equipmentCount = Object.keys(driveImages.equipment).length;
    const personnelCount = Object.keys(driveImages.personnel).length;
    showNotification(`圖片載入: 器材${equipmentCount}張, 人員${personnelCount}張`);
}

// 添加图片加载状态跟踪
const imageLoadStatus = {};

// 非同步初始化所有圖片（不阻擋主流程）
function initDriveImagesAsync() {
    console.log('開始非同步載入 Google Drive 圖片...');

    // 你的 Apps Script 部署 URL
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzE1HXXDPS4Wl-DCIrptSe41qu9eHKTNfe3uDFzhx3yrQeWlFIxkZJubsjj-SV3n2rmHQ/exec';

    // 載入三種分類的圖片（不等待）
    const categories = ['equipment', 'personnel', 'vehicles'];

    categories.forEach((category, index) => {
        // 稍微錯開請求時間，避免同時太多請求
        setTimeout(() => {
            fetch(`${SCRIPT_URL}?category=${category}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.images) {
                        driveImages[category] = data.images;
                        console.log(`✅ ${category} 圖片載入完成:`, Object.keys(data.images).length, '張');

                        // 如果當前視圖是這個分類，自動更新圖片
                        if (currentView === 'equipment' && category === 'equipment') {
                            updateImagesForCurrentView();
                        } else if (currentView === 'personnel' && category === 'personnel') {
                            updateImagesForCurrentView();
                        }
                    } else {
                        console.warn(`⚠️ ${category} 圖片載入失敗:`, data.error);
                    }
                })
                .catch(error => {
                    console.error(`❌ ${category} 圖片請求失敗:`, error);
                });
        }, index * 500); // 每個請求間隔 500ms
    });
}

// 新增：取得本地圖片路徑函數
function getLocalPhotoPath(fileName, category) {
    const folderMap = {
        'equipment': 'equipment',
        'personnel': 'people',
        'vehicles': 'vehicles'
    };

    const folder = folderMap[category] || 'equipment';
    return `assets/${folder}/${fileName}`;
}

// 取得預設圖片路徑
function getDefaultPhotoPath() {
    const folderMap = {
        'personnel': 'people',
        'equipment': 'equipment',
        'vehicles': 'vehicles'
    };

    const category = currentView === 'personnel' ? 'personnel' : 'equipment';
    const folder = folderMap[category] || 'equipment';
    return `assets/${folder}/default.jpg`;
}

// ==========================================
// 🚀 4. 直連寫入：單一狀態更新 (不透過 Vercel)
// ==========================================
async function updateStatus(id, newStatus) {
    if (userRole !== '管理') {
        showNotification('只有管理員可以更新狀態');
        return;
    }
    if (newStatus === '外出' || newStatus === '應勤') {
        showReasonModal(id, newStatus);
    } else {
        await performStatusUpdateDirect(id, newStatus, '');
    }
}

// 新增啟用管理員功能的函數
function enableAdminFeatures() {
    // 添加管理工具列
    const adminToolbar = document.createElement('div');
    adminToolbar.id = 'admin-toolbar';
    adminToolbar.style.cssText = `
        position: fixed;
        top: 120px;  // 從 70px 改為 60px，往上移一點
        right: 10px;
        z-index: 1000;
        background-color: rgba(255, 255, 255, 0.95);
        padding: 0;  // 移除原本的 padding
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        display: flex;
        flex-direction: column;
        width: 50px;  // 初始寬度設為 50px（收合狀態）
        height: 40px; // 設定高度
        overflow: hidden;  // 隱藏超出部分
        transition: all 0.3s ease;
    `;

    // 建立縮放按鈕
    const expandButton = document.createElement('button');
    expandButton.id = 'admin-expand-btn';
    expandButton.innerHTML = '<i class="fas fa-tools"></i>';
    expandButton.style.cssText = `
        padding: 10px;
        background-color: #2c3e50;
        color: white;
        border: none;
        cursor: pointer;
        font-size: 16px;
        width: 100%;
        height: 40px;
        text-align: center;
        transition: all 0.3s ease;
        flex-shrink: 0;
    `;

    // 建立工具列內容（初始隱藏）
    const toolbarContent = document.createElement('div');
    toolbarContent.id = 'toolbar-content';
    toolbarContent.style.cssText = `
        display: none;  // 初始隱藏
        padding: 10px;
        gap: 8px;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;

    // 工具列按鈕 (已移除手動刷新與自動開關，下放給全體)
    toolbarContent.innerHTML = `
        <button onclick="showMissionManagement()" style="padding: 8px 12px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%; white-space: pre-line;">
            <i class="fas fa-users"></i> 編輯參與任務
        </button>
        <button onclick="showEditDataModal()" style="padding: 8px 12px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%; white-space: pre-line;">
            <i class="fas fa-edit"></i> 編輯${currentView === 'personnel' ? '人員' : currentView === 'equipment' ? '器材' : '車輛'}資料
        </button>
        <button onclick="showBatchAddModal()" style="padding: 8px 12px; background-color: #2196F3; color: white; border: none; border-radius: 4px; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%; white-space: pre-line;">
            <i class="fas fa-user-plus"></i> 批次新增人員
        </button>
    `;

    // 展開/收起功能
    let isExpanded = false;
    expandButton.onclick = (e) => {
        e.stopPropagation();
        isExpanded = !isExpanded;

        if (isExpanded) {
            // 展開狀態
            adminToolbar.style.width = '200px';
            adminToolbar.style.height = 'auto';
            toolbarContent.style.display = 'flex';
            setTimeout(() => {
                toolbarContent.style.opacity = '1';
            }, 10);
            expandButton.innerHTML = '<i class="fas fa-times"></i>';
            expandButton.style.backgroundColor = '#e74c3c';
        } else {
            // 收合狀態
            toolbarContent.style.opacity = '0';
            setTimeout(() => {
                toolbarContent.style.display = 'none';
                adminToolbar.style.width = '50px';
                adminToolbar.style.height = '40px';
            }, 300);
            expandButton.innerHTML = '<i class="fas fa-tools"></i>';
            expandButton.style.backgroundColor = '#2c3e50';
        }
    };

    // 點擊頁面其他地方關閉工具列
    document.addEventListener('click', (e) => {
        if (!adminToolbar.contains(e.target) && isExpanded) {
            toolbarContent.style.opacity = '0';
            setTimeout(() => {
                toolbarContent.style.display = 'none';
                adminToolbar.style.width = '50px';
                adminToolbar.style.height = '40px';
            }, 300);
            expandButton.innerHTML = '<i class="fas fa-tools"></i>';
            expandButton.style.backgroundColor = '#2c3e50';
            isExpanded = false;
        }
    });

    // 添加滑鼠懸停效果
    expandButton.onmouseenter = () => {
        if (!isExpanded) {
            expandButton.style.backgroundColor = '#34495e';
        }
    };

    expandButton.onmouseleave = () => {
        if (!isExpanded) {
            expandButton.style.backgroundColor = '#2c3e50';
        }
    };

    // 組裝工具列
    adminToolbar.appendChild(expandButton);
    adminToolbar.appendChild(toolbarContent);

    document.body.appendChild(adminToolbar);
}

// 新增刷新資料函數
async function refreshData() {
    if (!syncStatus.isOnline) {
        showNotification('網路已中斷，無法刷新資料');
        updateSyncStatus('disconnected', '網路已中斷，無法刷新資料');
        return;
    }

    try {
        showNotification('正在刷新資料...');
        updateSyncStatus('syncing', '資料刷新中...');

        await loadDataFromSupabase();
        renderView();

        showNotification('資料刷新完成');

    } catch (error) {
        console.error('刷新資料失敗：', error);
        showNotification(`刷新失敗：${error.message}`);
        updateSyncStatus('error', '刷新失敗');
    }
}

// 標記圖片需要更新（當 Drive 圖片載入後）
function markImageForUpdate(fileName, category) {
    // 建立一個待更新列表
    if (!window.imagesToUpdate) {
        window.imagesToUpdate = {};
    }

    if (!window.imagesToUpdate[category]) {
        window.imagesToUpdate[category] = new Set();
    }

    window.imagesToUpdate[category].add(fileName);

    // 定期檢查是否可以更新
    setTimeout(() => {
        tryUpdateMarkedImages(category);
    }, 2000); // 2秒後檢查
}

// 嘗試更新已標記的圖片
function tryUpdateMarkedImages(category) {
    if (!window.imagesToUpdate || !window.imagesToUpdate[category]) return;

    const imagesToUpdate = window.imagesToUpdate[category];
    const updated = [];

    imagesToUpdate.forEach(fileName => {
        if (driveImages[category] && driveImages[category][fileName]) {
            updateImageSource(fileName, category);
            updated.push(fileName);
        }
    });

    // 移除已更新的
    updated.forEach(fileName => {
        imagesToUpdate.delete(fileName);
    });

    if (updated.length > 0) {
        console.log(`已更新 ${updated.length} 張 ${category} 圖片到 Google Drive`);
    }
}

// 更新圖片來源
function updateImageSource(fileName, category) {
    const fileId = driveImages[category][fileName];
    if (!fileId) return;

    const driveUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    const localPath = getLocalPhotoPath(fileName, category);

    // 更新所有對應的圖片元素
    document.querySelectorAll(`img[src="${localPath}"]`).forEach(img => {
        if (img.src !== driveUrl) {
            console.log(`更新圖片: ${fileName} → Google Drive`);
            img.src = driveUrl;

            // 添加錯誤處理
            img.onerror = function () {
                console.warn(`Drive 圖片載入失敗: ${fileName}`);
                this.src = getDefaultPhotoPath();
            };
        }
    });
}

// 更新當前視圖的圖片
function updateImagesForCurrentView() {
    const category = currentView === 'personnel' ? 'personnel' : 'equipment';

    // 更新所有卡片圖片 - 添加安全檢查
    const cardImages = document.querySelectorAll('.card-image');
    if (!cardImages.length) return;

    cardImages.forEach(img => {
        if (!img || !img.src) return;  // 添加 null 檢查

        const src = img.src;
        const fileName = src.split('/').pop();

        // 如果目前是本地圖片，檢查是否有 Drive 版本
        if (src.includes('assets/') && driveImages[category] && driveImages[category][fileName]) {
            updateImageSource(fileName, category);
        }
    });
}

// 檢查圖片是否存在（可選）
async function checkImageExists(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

// 工具函數
function getCurrentTime() {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
}

function showNotification(message) {
    // 建立通知元素
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #4CAF50;
        color: white;
        padding: 15px 25px;
        border-radius: 5px;
        z-index: 1001;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    // 3秒後移除通知
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}



// 建立測試資料
function createTestData() {
    console.log('建立測試資料...');

    currentData.employees = [
        {
            id: 1,
            name: "測試人員1",
            group: "測試組",
            photo: "default.jpg",
            status: "BoO",
            time_status: getCurrentTime(),
            time_history: "BoO " + getCurrentTime()
        }
    ];

    currentData.equipment = [
        {
            id: 101,
            name: "影音",
            detail_name: "影音聲納生命探測器",
            category: "科技類",
            photo: "default.jpg",
            status: "應勤",
            time_status: getCurrentTime(),
            time_history: "應勤 " + getCurrentTime()
        }
    ];

    // 更新畫面
    updateStats();
    renderGroupControls();
    renderCards();


    showNotification('已載入測試資料，請檢查 JSON 檔案路徑');
}


// 顯示快速控制彈窗
function showQuickControl() {
    console.log('打開快速控制，當前視圖:', currentView);

    // 更新標題
    const modalTitle = document.querySelector('#quick-modal h3');
    if (modalTitle) {
        // 🎯 升級：增加車輛模式標題
        let viewText = '人員模式';
        if (currentView === 'equipment') viewText = '器材模式';
        if (currentView === 'vehicle') viewText = '車輛模式';
        modalTitle.innerHTML = `<i class="fas fa-bolt"></i> 快速控制 <span style="font-size: 14px; color: #666; margin-left: 10px;">${viewText}</span>`;
    }

    // 更新搜尋框 placeholder
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        // 🎯 升級：增加車輛搜尋提示
        let placeholderText = '搜尋人員姓名或群組...';
        if (currentView === 'equipment') placeholderText = '搜尋器材名稱或類別...';
        if (currentView === 'vehicle') placeholderText = '搜尋車牌、車名或分隊...';
        searchInput.placeholder = placeholderText;
    }

    renderQuickControlList();
    document.getElementById('quick-modal').style.display = 'block';

    // 添加搜尋功能
    setupQuickControlSearch();

    // 添加 ESC 鍵關閉功能
    document.addEventListener('keydown', handleQuickModalKeydown);
}

// 處理快速控制彈窗的鍵盤事件
function handleQuickModalKeydown(event) {
    if (event.key === 'Escape' && document.getElementById('quick-modal').style.display === 'block') {
        closeModal('quick-modal');
    }
}



// 設置快速控制搜尋功能 (防卡死升級版)
function setupQuickControlSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    searchInput.oninput = null;

    // 🚨 確保防卡死保護機制「永遠只綁定一次」！
    if (!isQuickSearchBound) {
        searchInput.addEventListener('compositionstart', () => { isComposingQuickSearch = true; });
        searchInput.addEventListener('compositionend', () => {
            isComposingQuickSearch = false;
            filterQuickControlList(searchInput.value.trim().toLowerCase());
        });
        isQuickSearchBound = true; // 標記已綁定，下次進來就不會再綁
    }

    searchInput.oninput = function () {
        if (isComposingQuickSearch) return;

        const searchTerm = this.value.trim().toLowerCase();
        clearTimeout(quickSearchDebounce);
        quickSearchDebounce = setTimeout(() => {
            filterQuickControlList(searchTerm);
        }, 300);
    };

    searchInput.value = '';
    searchInput.focus();
}

// 過濾快速控制清單
function filterQuickControlList(searchTerm) {
    const container = document.getElementById('quick-control-list');
    if (!container) return;

    const allItems = container.querySelectorAll('.quick-item');
    const allGroupHeaders = container.querySelectorAll('.quick-group-header');
    const allGroupContainers = container.querySelectorAll('.quick-group-container');

    let hasVisibleItems = false;
    let groupsToExpand = new Set();

    // 先隱藏所有項目和群組
    allItems.forEach(item => {
        item.style.display = 'none';
    });

    allGroupContainers.forEach(container => {
        container.style.display = 'none';
    });

    // 如果有搜尋詞，進行過濾
    if (searchTerm) {
        allItems.forEach(item => {
            const nameElement = item.querySelector('.quick-item-name');
            const groupElement = item.querySelector('.quick-item-group');

            const name = nameElement?.textContent?.toLowerCase() || '';
            const group = groupElement?.textContent?.toLowerCase() || '';
            const originalName = nameElement?.dataset.originalName?.toLowerCase() || '';

            // 檢查是否匹配搜尋詞（搜尋名稱、詳細名稱、群組）
            const matchesSearch = name.includes(searchTerm) ||
                group.includes(searchTerm) ||
                originalName.includes(searchTerm);

            if (matchesSearch) {
                item.style.display = 'flex';
                hasVisibleItems = true;

                // 找到對應的群組
                const groupName = item.dataset.group;
                if (groupName) {
                    groupsToExpand.add(groupName);
                }
            }
        });
    } else {
        // 沒有搜尋詞時，只顯示群組標題
        hasVisibleItems = true;
    }

    // 處理群組標題
    allGroupHeaders.forEach(header => {
        const groupName = header.dataset.group;
        const icon = header.querySelector('i.fa-chevron-right');
        const countSpan = header.querySelector('.group-count');

        if (searchTerm) {
            // 有搜尋詞時：顯示匹配的群組
            if (groupsToExpand.has(groupName)) {
                header.style.display = 'block';
                header.dataset.expanded = 'true';
                if (icon) icon.style.transform = 'rotate(90deg)';

                // 顯示該群組的容器
                const groupContainer = document.getElementById(`quick-group-${groupName.replace(/\s+/g, '-')}`);
                if (groupContainer) {
                    groupContainer.style.display = 'block';

                    // 更新群組計數（只顯示可見項目）
                    const visibleItems = groupContainer.querySelectorAll('.quick-item[style*="display: flex"]').length;
                    if (countSpan) countSpan.textContent = `(${visibleItems})`;
                }
            } else {
                header.style.display = 'none';
            }
        } else {
            // 沒有搜尋詞時：顯示所有群組標題（預設收合）
            header.style.display = 'block';
            header.dataset.expanded = 'false';
            if (icon) icon.style.transform = 'rotate(0deg)';

            // 更新原始計數
            const groupContainer = document.getElementById(`quick-group-${groupName.replace(/\s+/g, '-')}`);
            if (groupContainer && countSpan) {
                const totalItems = groupContainer.querySelectorAll('.quick-item').length;
                countSpan.textContent = `(${totalItems})`;
            }
        }
    });

    // 顯示無結果訊息
    let noResultsMsg = container.querySelector('.no-results-message');
    if (!hasVisibleItems) {
        if (!noResultsMsg) {
            noResultsMsg = document.createElement('div');
            noResultsMsg.className = 'no-results-message';
            noResultsMsg.innerHTML = `
                <i class="fas fa-search" style="font-size: 24px; color: #999; margin-bottom: 10px;"></i>
                <p style="margin: 5px 0;">找不到符合 "${searchTerm}" 的結果</p>
                <p style="font-size: 12px; color: #888;">試試其他關鍵字或查看群組列表</p>
            `;
            noResultsMsg.style.cssText = `
                text-align: center;
                padding: 40px 20px;
                color: #666;
                grid-column: 1 / -1;
                background-color: #f9f9f9;
                border-radius: 8px;
                margin-top: 20px;
            `;
            container.appendChild(noResultsMsg);
        }
    } else if (noResultsMsg) {
        noResultsMsg.remove();
    }
}

// 批次全部操作
async function batchAll(action) {
    // 檢查權限
    if (userRole !== '管理') {
        showNotification('只有管理員可以批次更新');
        return;
    }

    // 🎯 修正：補上完美的「三向判斷」資料源
    let data = currentData.employees;
    if (currentView === 'equipment') data = currentData.equipment;
    if (currentView === 'vehicle') data = currentData.vehicles;

    const newStatus = action === 'BoO' ?
        (currentView === 'personnel' ? 'BoO' : '在隊') :
        (currentView === 'personnel' ? '外出' : '應勤');

    // 如果是外出/應勤，詢問原因
    if (newStatus === '外出' || newStatus === '應勤') {
        showBatchAllReasonModal(newStatus);
        return;
    }

    // 歸隊/在隊，直接更新
    await performBatchAllUpdate(newStatus, '');
}

// ==========================================
// 🚀 批次處理：全體操作 (直連版)
// ==========================================
async function performBatchAllUpdate(newStatus, reason) {
    try {
        showNotification('🚀 正在處理全體批次更新...');
        
        // 🎯 修正：補上完美的「三向判斷」資料源
        let data = currentData.employees;
        if (currentView === 'equipment') data = currentData.equipment;
        if (currentView === 'vehicle') data = currentData.vehicles;

        // 使用 Promise.all 同時發送請求，開啟 skipReload 靜音模式
        const promises = data.map(item => performStatusUpdateDirect(item.id, newStatus, reason, true));
        await Promise.all(promises);

        // 批次完成後，一次性重整畫面
        await loadDataFromSupabase();
        renderView();
        showNotification(`✅ 批次更新完成，共更新 ${data.length} 筆資料`);
        closeModal('group-modal');
    } catch (error) {
        console.error('全體更新失敗：', error);
        showNotification(`❌ 全體更新失敗：${error.message}`);
    }
}

// 渲染快速控制清單
function renderQuickControlList() {
    const container = document.getElementById('quick-control-list');
    if (!container) {
        console.error('找不到 quick-control-list 容器');
        return;
    }
    container.innerHTML = '';

    // 🎯 升級：選取正確資料源
    let data = currentData.employees;
    if (currentView === 'equipment') data = currentData.equipment;
    if (currentView === 'vehicle') data = currentData.vehicles;

    if (data.length === 0) {
        container.innerHTML = '<div class="empty-message" style="text-align: center; padding: 40px; color: #666;">暫無資料</div>';
        return;
    }

    const groups = {};
    data.forEach(item => {
        // 🎯 升級：選取正確群組欄位
        const groupKey = currentView === 'equipment' ? item.category : item.group;
        const finalKey = groupKey || '未分組';
        if (!groups[finalKey]) groups[finalKey] = [];
        groups[finalKey].push(item);
    });
    
    // 渲染每個群組（預設收合）
    Object.keys(groups).sort(customGroupSort).forEach((groupName, groupIndex) => {
        // 群組標題（可點擊展開）
        const groupHeader = document.createElement('div');
        groupHeader.className = 'quick-group-header';
        groupHeader.dataset.group = groupName;
        groupHeader.dataset.expanded = 'false';

        const itemCount = groups[groupName].length;
        groupHeader.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-chevron-right" style="font-size: 12px; transition: transform 0.3s;"></i>
                    <span style="font-weight: bold; color: #333;">${groupName}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="group-count">(${itemCount})</span>
                    <button class="quick-group-action-btn" onclick="event.stopPropagation(); batchUpdateGroupStatus('${groupName}', '${currentView === 'personnel' ? 'BoO' : '在隊'}')" style="background: none; border: none; cursor: pointer;" title="全部歸隊">
                        <i class="fas fa-home" style="color: #4CAF50; font-size: 14px;"></i>
                    </button>
                </div>
            </div>
        `;

        // 點擊群組標題展開/收合
        groupHeader.addEventListener('click', function (e) {
            if (!e.target.closest('.quick-group-action-btn')) {
                toggleQuickGroup(this);
            }
        });

        container.appendChild(groupHeader);

        // 群組成員容器（預設隱藏）
        const groupContainer = document.createElement('div');
        groupContainer.className = 'quick-group-container';
        groupContainer.id = `quick-group-${groupName.replace(/\s+/g, '-')}`;
        groupContainer.dataset.group = groupName;
        groupContainer.style.display = 'none';

        // 添加群組成員
        groups[groupName].forEach(item => {
            const quickItem = createQuickItem(item, groupName);
            groupContainer.appendChild(quickItem);
        });

        container.appendChild(groupContainer);
    });
}
// 切換快速控制群組展開/收合
function toggleQuickGroup(groupHeader) {
    const groupName = groupHeader.dataset.group;
    const isExpanded = groupHeader.dataset.expanded === 'true';
    const groupContainer = document.getElementById(`quick-group-${groupName.replace(/\s+/g, '-')}`);
    const icon = groupHeader.querySelector('i.fa-chevron-right');

    if (!groupContainer) return;

    if (isExpanded) {
        // 收合
        groupContainer.style.display = 'none';
        groupHeader.dataset.expanded = 'false';
        if (icon) icon.style.transform = 'rotate(0deg)';
    } else {
        // 展開
        groupContainer.style.display = 'block';
        groupHeader.dataset.expanded = 'true';
        if (icon) icon.style.transform = 'rotate(90deg)';
    }
}

// 展開所有群組
function expandAllQuickGroups() {
    const groupHeaders = document.querySelectorAll('.quick-group-header');
    groupHeaders.forEach(header => {
        if (header.dataset.expanded === 'false') {
            toggleQuickGroup(header);
        }
    });
}

// 收合所有群組
function collapseAllQuickGroups() {
    const groupHeaders = document.querySelectorAll('.quick-group-header');
    groupHeaders.forEach(header => {
        if (header.dataset.expanded === 'true') {
            toggleQuickGroup(header);
        }
    });
}

// 建立快速控制項目
function createQuickItem(item, groupName) {
    const statusClass = getStatusClass(item.status);
    const quickItem = document.createElement('div');
    quickItem.className = `quick-item ${statusClass}`;
    quickItem.dataset.group = groupName;

    const displayName = item.detail_name || item.name;
    
    const statusText = getStatusDisplayText(item.status);

    // 獲取最後一次外出的原因
    let lastReason = '';
    if (item.time_history) {
        const historyLines = item.time_history.split('\n').filter(line => line.trim());
        const lastEntry = historyLines[0] || '';
        const reasonMatch = lastEntry.match(/\((.*?)\)/);
        if (reasonMatch) {
            lastReason = reasonMatch[1];
        }
    }

    // === 修改這裡：根據用戶角色顯示不同的按鈕 ===
    let buttonsHTML = '';

    if (userRole === '管理') {
        // 管理員看到完整的按鈕
        buttonsHTML = `
            <div class="quick-item-buttons">
                <button class="status-btn mini boo ${item.status === 'BoO' || item.status === '在隊' ? 'active' : ''}"
                        onclick="event.stopPropagation(); quickUpdateStatus('${item.id}', '${currentView === 'personnel' ? 'BoO' : '在隊'}')">
                    ${currentView === 'personnel' ? '歸隊' : '在隊'}
                </button>
                <button class="status-btn mini out ${item.status === '外出' || item.status === '應勤' ? 'active' : ''}"
                        onclick="event.stopPropagation(); quickUpdateStatus('${item.id}', '${currentView === 'personnel' ? '外出' : '應勤'}')">
                    ${currentView === 'personnel' ? '外出' : '應勤'}
                </button>
            </div>
        `;
    } else {
        // 一般用戶看到不可點擊的狀態標籤
        buttonsHTML = `
            <div class="quick-item-buttons">
                <div class="status-display ${statusClass}">
                    ${statusText}
                </div>
            </div>
        `;
    }

    quickItem.innerHTML = `
        <div class="quick-item-info">
            <div class="quick-item-name" data-name="${displayName}" data-original-name="${item.name}">${displayName}</div>
            <div class="quick-item-group">${groupName}</div>
            ${lastReason && (item.status === '外出' || item.status === '應勤') ?
            `<div class="quick-item-reason">原因：${lastReason}</div>` : ''}
        </div>
        
        ${buttonsHTML}
    `;

    quickItem.addEventListener('click', function (e) {
        // 如果是管理員，點擊按鈕區域不觸發查看歷史
        // 如果是一般用戶，整個項目都可以點擊查看歷史
        if (userRole === '管理') {
            if (!e.target.closest('.status-btn')) {
                showHistory(item.name);
                closeModal('quick-modal');
            }
        } else {
            // 一般用戶點擊任何地方都查看歷史
            showHistory(item.name);
            closeModal('quick-modal');
        }
    });

    return quickItem;
}

// 快速更新狀態 (修正 API 呼叫名稱版)
async function quickUpdateStatus(id, newStatus) {
    // 檢查權限
    if (userRole !== '管理') {
        showNotification('只有管理員可以更新狀態');
        return;
    }

    // 如果是要設定為外出或應勤，先詢問原因
    if (newStatus === '外出' || newStatus === '應勤') {
        showReasonModal(id, newStatus);
    } else {
        // 🎯 歸隊或在隊，呼叫我們在 api_supabase.js 裡寫好的直連更新函數！
        // 記得加上 await，因為它是非同步的
        await performStatusUpdateDirect(id, newStatus, '');
    }
}

// 新增：預檢器材照片
async function preCheckEquipmentPhotos() {
    const checkPromises = currentData.equipment.map(async (item) => {
        if (item.photo === 'default.jpg') return;

        const imgPath = `assets/equipment/${item.photo}`;
        const exists = await checkImageExists(imgPath);

        if (!exists) {
            console.log(`器材 ${item.name} 的照片不存在，改用預設圖`);
            item.photo = 'default.jpg';
        }
    });

    await Promise.all(checkPromises);
}

////////////// 原因部分 //////////////
// 初始化常用原因


// 從本地存儲載入自訂原因
function loadCustomReasons() {
    try {
        const savedReasons = localStorage.getItem('customReasons');
        if (savedReasons) {
            const customReasons = JSON.parse(savedReasons);
            currentReasons = [...currentReasons.filter(r => r !== "其他"), ...customReasons, "其他"];
        }
    } catch (e) {
        console.log('載入自訂原因失敗:', e);
    }
}

// 設置原因相關事件監聽器
function setupReasonEventListeners() {
    // 原因選項點擊事件
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('reason-option')) {
            const reasonOptions = document.querySelectorAll('.reason-option');
            reasonOptions.forEach(opt => opt.classList.remove('selected'));
            e.target.classList.add('selected');

            // 如果是「其他」，顯示自訂輸入框
            if (e.target.textContent === '其他') {
                document.getElementById('custom-reason-input').style.display = 'block';
                document.getElementById('custom-reason-input').focus();
            } else {
                document.getElementById('custom-reason-input').style.display = 'none';
                lastSelectedReason = e.target.textContent;
            }
        }
    });

    // 自訂原因輸入框事件
    const customInput = document.getElementById('custom-reason-input');
    if (customInput) {
        customInput.addEventListener('input', function () {
            lastSelectedReason = this.value.trim();
        });
    }
}

// 原因管理功能
function manageReasons() {
    renderReasonManagementList();
    document.getElementById('reason-management-modal').style.display = 'block';
}

// ==========================================
// ⚙️ 個性設定 (頁籤切換與群組排序)
// ==========================================

// 🎯 新增：記錄彈窗內當前正在排序的模式 (獨立於主畫面的 currentView)
window.currentSortView = 'personnel';

// 1. 主頁籤切換 (原因 vs 排序)
function switchSettingTab(tab) {
    document.getElementById('tab-btn-reasons').classList.toggle('active', tab === 'reasons');
    document.getElementById('tab-btn-sort').classList.toggle('active', tab === 'sort');

    document.getElementById('setting-reasons-section').style.display = tab === 'reasons' ? 'block' : 'none';
    document.getElementById('setting-sort-section').style.display = tab === 'sort' ? 'block' : 'none';

    if (tab === 'sort') {
        // 每次點開排序頁籤，預設切換到與主畫面相同的模式，但之後可以在彈窗內自由切換
        switchSortView(currentView === 'equipment' ? 'equipment' : 'personnel');
    }
}

// 2. 🎯 新增：彈窗內的人員/器材切換邏輯
function switchSortView(type) {
    window.currentSortView = type;
    
    // 更新按鈕 UI 顏色
    const btnP = document.getElementById('sort-tab-personnel');
    const btnE = document.getElementById('sort-tab-equipment');
    
    if (type === 'personnel') {
        btnP.style.background = 'rgba(0, 243, 255, 0.2)'; btnP.style.color = 'var(--neon-cyan)'; btnP.style.borderColor = 'var(--neon-cyan)';
        btnE.style.background = 'transparent'; btnE.style.color = 'var(--text-dim)'; btnE.style.borderColor = 'var(--text-dim)';
    } else {
        btnE.style.background = 'rgba(0, 243, 255, 0.2)'; btnE.style.color = 'var(--neon-cyan)'; btnE.style.borderColor = 'var(--neon-cyan)';
        btnP.style.background = 'transparent'; btnP.style.color = 'var(--text-dim)'; btnP.style.borderColor = 'var(--text-dim)';
    }
    
    // 重新畫出清單
    renderGroupSortManagement();
}

// 3. 渲染群組排序管理介面
function renderGroupSortManagement() {
    const container = document.getElementById('group-sort-list');
    
    // 🎯 這裡改用 window.currentSortView (彈窗自己的狀態)，不再吃背景的 currentView
    const targetView = window.currentSortView || 'personnel';
    const data = targetView === 'personnel' ? currentData.employees : currentData.equipment;
    
    let currentGroups = [...new Set(data.map(item => targetView === 'personnel' ? item.group : item.category))].filter(Boolean);

    // 🎯 專屬排序過濾 (針對目標模式獨立運算)
    currentGroups.sort((a, b) => {
        const weights = targetView === 'personnel' ? groupSortWeights.personnel : groupSortWeights.equipment;
        const weightA = weights[a] !== undefined ? weights[a] : 999;
        const weightB = weights[b] !== undefined ? weights[b] : 999;
        if (weightA !== weightB) return weightA - weightB;
        return a.localeCompare(b, 'zh-TW', { numeric: true });
    });

    container.innerHTML = '';

    if (currentGroups.length === 0) {
        container.innerHTML = '<div style="text-align:center; color: var(--text-dim); padding: 20px;">目前無群組資料</div>';
        return;
    }

    currentGroups.forEach((group, index) => {
        const isFirst = index === 0;
        const isLast = index === currentGroups.length - 1;

        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = `
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 15px; background: rgba(255,255,255,0.05);
            border: 1px solid var(--border-dim); border-radius: 6px;
        `;

        itemDiv.innerHTML = `
            <div style="font-weight: bold; color: var(--text-bright); font-size: 16px;">
                <span style="display:inline-block; width: 25px; color: var(--neon-cyan); opacity: 0.7;">${index + 1}.</span> 
                ${group}
            </div>
            <div style="display: flex; gap: 8px;">
                <button onclick="moveGroupSort('${group}', -1)" ${isFirst ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''} class="action-btn" style="padding: 8px 12px; background: rgba(255,255,255,0.1); border: none; border-radius: 4px; color: #fff;">
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button onclick="moveGroupSort('${group}', 1)" ${isLast ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''} class="action-btn" style="padding: 8px 12px; background: rgba(255,255,255,0.1); border: none; border-radius: 4px; color: #fff;">
                    <i class="fas fa-arrow-down"></i>
                </button>
            </div>
        `;
        container.appendChild(itemDiv);
    });

    window.tempSortOrder = currentGroups;
}

// 4. 處理上移/下移
function moveGroupSort(groupName, direction) {
    const index = window.tempSortOrder.indexOf(groupName);
    if (index < 0) return;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= window.tempSortOrder.length) return;

    // 交換位置
    const temp = window.tempSortOrder[index];
    window.tempSortOrder[index] = window.tempSortOrder[newIndex];
    window.tempSortOrder[newIndex] = temp;

    // 重新賦予權重 (寫入對應的分類)
    const type = window.currentSortView || 'personnel';
    window.tempSortOrder.forEach((g, i) => {
        groupSortWeights[type][g] = i + 1;
    });

    renderGroupSortManagement();
}

// 5. 儲存排序設定
function saveGroupSortOrder() {
    saveGroupSortWeights(); // 寫入 localStorage
    showNotification('✅ 群組順序已儲存！');
    renderView(); // 刷新背景畫面
}

// 渲染原因管理列表
function renderReasonManagementList() {
    const container = document.getElementById('current-reasons-list');
    if (!container) return;

    // 排除預設的「其他」
    const reasonsToShow = currentReasons.filter(r => r !== '其他');

    container.innerHTML = '';

    if (reasonsToShow.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center;">暫無自訂原因</p>';
        return;
    }

    reasonsToShow.forEach((reason, index) => {
        // 檢查是否是預設原因
        const isDefault = [
            "任務場地", "購物", "開會", "訓練", "裝備保養", "行政事務",
            "醫療就診", "裝備測試", "支援其他單位", "裝備領用", "裝備歸還"
        ].includes(reason);

        const reasonItem = document.createElement('div');
        reasonItem.className = 'reason-management-item';
        reasonItem.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            margin-bottom: 5px;
            background-color: ${isDefault ? '#f9f9f9' : '#fff'};
            border: 1px solid #eee;
            border-radius: 5px;
        `;

        reasonItem.innerHTML = `
            <span>${reason}</span>
            ${!isDefault ? `
                <button onclick="removeReason(${index})" style="background: none; border: none; color: #f44336; cursor: pointer;">
                    <i class="fas fa-trash"></i>
                </button>
            ` : '<span style="color: #999; font-size: 12px;">預設</span>'}
        `;

        container.appendChild(reasonItem);
    });
}

// 新增自訂原因
function addCustomReason() {
    const input = document.getElementById('new-reason-input');
    const newReason = input.value.trim();

    if (!newReason) {
        showNotification('請輸入原因');
        return;
    }

    if (currentReasons.includes(newReason)) {
        showNotification('該原因已存在');
        return;
    }

    // 添加到「其他」之前
    const otherIndex = currentReasons.indexOf('其他');
    if (otherIndex > -1) {
        currentReasons.splice(otherIndex, 0, newReason);
    } else {
        currentReasons.push(newReason);
    }

    // 保存到本地存儲
    saveCustomReasons();

    // 更新列表
    renderReasonManagementList();

    // 清空輸入框
    input.value = '';
    input.focus();

    showNotification(`已新增原因: ${newReason}`);
}

// 移除原因
function removeReason(index) {
    const reasonToRemove = currentReasons[index];

    if (confirm(`確定要移除原因「${reasonToRemove}」嗎？`)) {
        currentReasons.splice(index, 1);
        saveCustomReasons();
        renderReasonManagementList();
        showNotification(`已移除原因: ${reasonToRemove}`);
    }
}

// 新增函數：更新同步狀態顯示
function updateSyncStatus(status, message = '') {
    const syncElement = document.getElementById('sync-status');
    if (!syncElement) return;

    const textElement = syncElement.querySelector('.sync-text');
    const iconElement = syncElement.querySelector('i');

    // 移除所有狀態類別
    syncElement.classList.remove('connected', 'disconnected', 'error', 'syncing');

    switch (status) {
        case 'connected':
            syncElement.classList.add('connected');
            iconElement.className = 'fas fa-cloud';
            textElement.textContent = message || '已連線到雲端資料庫';
            break;

        case 'disconnected':
            syncElement.classList.add('disconnected');
            iconElement.className = 'fas fa-cloud-slash';
            textElement.textContent = message || '網路已中斷，使用本地資料';
            break;

        case 'syncing':
            syncElement.classList.add('syncing');
            iconElement.className = 'fas fa-sync-alt';
            textElement.textContent = message || '資料同步中...';
            break;

        case 'error':
            syncElement.classList.add('error');
            iconElement.className = 'fas fa-exclamation-triangle';
            textElement.textContent = message || '同步錯誤';
            break;
    }

    // 顯示狀態
    syncElement.classList.add('show');

    // 如果是成功狀態，3秒後自動隱藏
    if (status === 'connected' && !syncStatus.isSyncing) {
        setTimeout(() => {
            syncElement.classList.remove('show');
        }, 3000);
    }
}

// 新增函數：檢查網路狀態
function checkNetworkStatus() {
    const isOnline = navigator.onLine;
    syncStatus.isOnline = isOnline;

    if (isOnline) {
        updateSyncStatus('connected', '已連線到雲端資料庫');
    } else {
        updateSyncStatus('disconnected', '網路已中斷，使用本地資料');
    }

    return isOnline;
}

////////////////自動更新功能//////////////////////
// 停止自動刷新
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('自動刷新已停止');
    }
}

// 切換自動刷新
function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;

    if (autoRefreshEnabled) {
        startAutoRefresh(30000);
        showNotification('已啟動自動刷新 (30秒)');
    } else {
        stopAutoRefresh();
        showNotification('已停止自動刷新');
    }

    // 更新按鈕文字
    const toggleBtn = document.querySelector('button[onclick="toggleAutoRefresh()"]');
    if (toggleBtn) {
        toggleBtn.innerHTML = `<i class="fas fa-clock"></i> ${autoRefreshEnabled ? '停止自動' : '啟動自動'}`;
    }
}

// 網路狀態監聽
function setupNetworkListeners() {
    // 監聽網路狀態變化
    window.addEventListener('online', () => {
        console.log('網路已恢復');
        syncStatus.isOnline = true;
        updateSyncStatus('connected', '網路已恢復，同步資料中...');

        // 自動刷新資料
        setTimeout(() => {
            refreshData();
        }, 1000);
    });

    window.addEventListener('offline', () => {
        console.log('網路已中斷');
        syncStatus.isOnline = false;
        updateSyncStatus('disconnected', '網路已中斷，使用本地資料');
    });

    // 監聽頁面可見性變化（當用戶切換回頁面時刷新）
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && syncStatus.isOnline) {
            // 頁面重新可見且網路正常時，檢查資料更新
            console.log('頁面重新可見，檢查資料更新');
            refreshData();
        }
    });
}

///////////// 新增管理編組任/////////////////////////////
// 顯示任務管理界面（人員加入/移除）
async function showMissionManagement() {
    // 檢查權限
    if (userRole !== '管理') {
        showNotification('只有管理員可以管理任務');
        return;
    }

    const type = currentView; 
    let title = '管理任務人員';
    if (type === 'equipment') title = '管理任務器材';
    if (type === 'vehicle') title = '管理任務車輛'; // 🎯 補上車輛標題

    // 創建任務管理彈窗（完全重寫 HTML）
    const modalId = 'mission-management-modal';
    let modal = document.getElementById(modalId);

    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 95%; max-height: 90vh; margin: 2vh auto;">
                <span class="close" onclick="closeModal('${modalId}')">&times;</span>
                <h3 style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                    <i class="fas fa-users"></i> ${title}
                    <span style="font-size: 14px; color: #666; margin-left: auto;">
                        <span id="total-selected-count">0</span> 個已選取
                    </span>
                </h3>
                
                <!-- 搜尋區域 -->
                <div style="margin-bottom: 15px;">
                    <div class="search-box" style="margin-bottom: 10px;">
                        <input type="text" id="mission-search-all" placeholder="搜尋所有項目（名稱、群組）..." style="width: 100%; padding: 10px;">
                        <i class="fas fa-search"></i>
                    </div>
                    <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                        <button onclick="selectAllItems()" style="flex: 1; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; font-size: 14px;">
                            <i class="fas fa-check-square"></i> 全選
                        </button>
                        <button onclick="deselectAllItems()" style="flex: 1; padding: 8px; background: #f0f0f0; border: none; border-radius: 4px; font-size: 14px;">
                            <i class="far fa-square"></i> 取消
                        </button>
                        <button onclick="expandAllGroups()" style="flex: 1; padding: 8px; background: #2196F3; color: white; border: none; border-radius: 4px; font-size: 14px;">
                            <i class="fas fa-expand"></i> 展開
                        </button>
                        <button onclick="collapseAllGroups()" style="flex: 1; padding: 8px; background: #FF9800; color: white; border: none; border-radius: 4px; font-size: 14px;">
                            <i class="fas fa-compress"></i> 收合
                        </button>
                    </div>
                </div>
                
                <!-- 切換標籤頁 -->
                <div style="margin-bottom: 15px; border-bottom: 1px solid #ddd;">
                    <button class="mission-tab active" onclick="switchMissionTab('all')" style="padding: 10px 15px; border: none; background: none; font-weight: bold; color: #4CAF50; border-bottom: 2px solid #4CAF50;">
                        所有項目
                    </button>
                    <button class="mission-tab" onclick="switchMissionTab('current')" style="padding: 10px 15px; border: none; background: none; font-weight: bold; color: #666;">
                        已在任務中
                    </button>
                    <button class="mission-tab" onclick="switchMissionTab('available')" style="padding: 10px 15px; border: none; background: none; font-weight: bold; color: #666;">
                        尚未加入任務
                    </button>
                </div>
                
                <!-- 項目列表 -->
                <div id="mission-items-container" style="height: 50vh; overflow-y: auto; padding: 10px 5px;">
                    <!-- 這裡會動態生成 -->
                    <div style="text-align: center; color: #666; padding: 20px;">
                        載入中...
                    </div>
                </div>
                
                <!-- 行動按鈕區（手機固定在底部） -->
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd; position: sticky; bottom: 0; background: white;">
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <button onclick="addSelectedToMission()" id="add-to-mission-btn" style="flex: 1; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 8px; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <i class="fas fa-plus"></i> 加入任務
                        </button>
                        <button onclick="removeSelectedFromMission()" id="remove-from-mission-btn" style="flex: 1; padding: 12px; background: #f44336; color: white; border: none; border-radius: 8px; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <i class="fas fa-minus"></i> 移出任務
                        </button>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666;">
                        <div>總項目: <span id="total-items-count">0</span></div>
                        <div>任務中: <span id="current-mission-count">0</span></div>
                        <div>可加入: <span id="available-count">0</span></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // 顯示模態框
    modal.style.display = 'block';

    // 載入資料
    await loadMissionManagementData(type);

    // 設置搜尋功能
    setupEnhancedMissionSearch();

    // 更新統計
    updateMissionStats();

    // 手機優化：觸發重新佈局
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 100);
}

// ==========================================
// 🚀 編輯資料：載入列表 (三向通用直連版)
// ==========================================
async function showEditDataModal() {
    // 🎯 1. 三向判斷：決定資料表、排序欄位、標題文字
    let table = 'personnel_control';
    let sortColumn = 'group_name';
    let titleText = '編輯人員資料';
    let searchPlaceholder = '搜尋人員姓名或群組...';

    if (currentView === 'equipment') {
        table = 'equipment_control';
        sortColumn = 'category'; // 裝備是用 category 排序
        titleText = '編輯器材資料';
        searchPlaceholder = '搜尋器材名稱或類別...';
    } else if (currentView === 'vehicle') {
        table = 'vehicle_control';
        sortColumn = 'group_name'; // 車輛也是用 group_name
        titleText = '編輯車輛資料';
        searchPlaceholder = '搜尋車輛名稱或群組...';
    }

    // 🎯 2. 完美保留你的雙重排序，但把欄位變成動態變數
    const { data: items, error } = await _supabase
        .from(table)
        .select('*')
        .eq('is_active', true)
        .order(sortColumn) // 動態排序群組/類別
        .order('name');

    if (error) return showNotification('❌ 讀取列表失敗');

    // 🎯 3. 萃取群組時，判斷要抓 group_name 還是 category
    const groups = [...new Set(items.map(p => currentView === 'equipment' ? p.category : p.group_name))].filter(Boolean);

    const existingModal = document.getElementById('edit-data-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'edit-data-modal';
    
    // 👇 HTML 完全保留你的設計，只替換文字變數
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 95%; max-height: 90vh; margin: 2vh auto;">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h3 style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-edit"></i> ${titleText}
            </h3>
            <div class="search-box" style="margin: 15px 0;">
                <input type="text" id="edit-search-input" placeholder="${searchPlaceholder}" style="width: 100%; padding: 10px;">
                <i class="fas fa-search"></i>
            </div>
            <div id="edit-data-list" style="max-height: 60vh; overflow-y: auto;"></div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'block';

    // 呼叫下一個渲染函數
    renderEditDataList(items, groups);

    document.getElementById('edit-search-input').oninput = function () {
        const searchTerm = this.value.toLowerCase();
        const rows = document.querySelectorAll('.edit-person-item');
        const groupHeaders = document.querySelectorAll('.edit-group-header');

        rows.forEach(item => {
            const name = item.dataset.name.toLowerCase();
            const group = item.dataset.group.toLowerCase();
            if (name.includes(searchTerm) || group.includes(searchTerm)) {
                item.style.display = 'flex';
                const groupHeader = item.closest('.edit-group-container').previousElementSibling;
                if (groupHeader) groupHeader.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });

        groupHeaders.forEach(header => {
            const groupContainer = header.nextElementSibling;
            const visibleItems = groupContainer.querySelectorAll('.edit-person-item[style*="display: flex"]');
            if (visibleItems.length === 0 && searchTerm) {
                header.style.display = 'none';
                groupContainer.style.display = 'none';
            }
        });
    };
}

// 渲染編輯資料列表
function renderEditDataList(items, groups) {
    const listDiv = document.getElementById('edit-data-list');
    listDiv.innerHTML = '';

    const groupedData = {};
    items.forEach(p => {
        // 🎯 1. 抓取正確的分組欄位
        const group = (currentView === 'equipment' ? p.category : p.group_name) || '未分組';
        if (!groupedData[group]) groupedData[group] = [];
        groupedData[group].push(p);
    });

    Object.keys(groupedData).sort(customGroupSort).forEach(groupName => {
        // 👇 群組標題 HTML (完全保留你的樣式)
        const groupHeader = document.createElement('div');
        groupHeader.className = 'edit-group-header';
        groupHeader.style.cssText = `
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 15px; background: #e8f5e8; border-left: 4px solid #4CAF50;
            cursor: pointer; margin-bottom: 5px; border-radius: 8px;
        `;
        groupHeader.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-chevron-down" style="transition: transform 0.3s;"></i>
                <strong>${groupName}</strong> (${groupedData[groupName].length})
            </div>
        `;

        const groupContainer = document.createElement('div');
        groupContainer.className = 'edit-group-container';
        groupContainer.style.cssText = `display: none; padding: 10px; margin-bottom: 15px;`;

        groupedData[groupName].forEach(p => {
            // 🎯 2. 顯示名稱處理 (支援裝備的 detail_name)
            const displayName = p.detail_name || p.name;
            const detailParam = p.detail_name || '';

            const item = document.createElement('div');
            item.className = 'edit-person-item';
            item.dataset.name = displayName; // 搜尋時可以用全名
            item.dataset.group = groupName;
            
            // 👇 項目 HTML (完全保留你的樣式)
            item.style.cssText = `
                display: flex; justify-content: space-between; align-items: center;
                padding: 12px; border: 1px solid #eee; margin-bottom: 5px;
                background: white; border-radius: 8px;
            `;

            item.innerHTML = `
                <div>
                    <strong style="font-size: 15px;">${displayName}</strong>
                    ${p.detail_name && p.detail_name !== p.name ? `<div style="font-size: 11px; color: #999;">${p.name}</div>` : ''}
                    <div style="font-size: 12px; color: #666; margin-top: 3px;">${groupName}</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="editSingleItem('${p.id}', '${p.name}', '${groupName}', '${detailParam}')" style="padding: 8px 12px; background: #2196F3; color: white; border: none; border-radius: 5px; font-size: 13px;">
                        <i class="fas fa-edit"></i> 編輯
                    </button>
                    <button onclick="deleteSingleItem('${p.id}', '${p.name}')" style="padding: 8px 12px; background: #F44336; color: white; border: none; border-radius: 5px; font-size: 13px;">
                        <i class="fas fa-trash"></i> 刪除
                    </button>
                </div>
            `;
            groupContainer.appendChild(item);
        });

        groupHeader.addEventListener('click', function () {
            const icon = this.querySelector('i');
            if (groupContainer.style.display === 'none') {
                groupContainer.style.display = 'block';
                icon.style.transform = 'rotate(0deg)';
            } else {
                groupContainer.style.display = 'none';
                icon.style.transform = 'rotate(-90deg)';
            }
        });

        listDiv.appendChild(groupHeader);
        listDiv.appendChild(groupContainer);
    });
}

// ==========================================
// 🚀 編輯單一項目：生成編輯窗 (精準對應版)
// ==========================================
async function editSingleItem(id, currentName, currentGroup, currentDetail) {
    let table = currentView === 'equipment' ? 'equipment_control' : currentView === 'vehicle' ? 'vehicle_control' : 'personnel_control';
    let groupLabel = currentView === 'equipment' ? '器材類別' : '所屬組別';
    
    // 找出這筆資料的原始內容 (為了車牌)
    let rawItem = null;
    if (currentView === 'vehicle') rawItem = currentData.vehicles.find(v => String(v.id) === String(id));

    const { data } = await _supabase.from(table).select('*').eq('is_active', true);
    const groups = [...new Set(data.map(i => currentView === 'equipment' ? i.category : i.group_name))].filter(Boolean);

    const editModal = document.createElement('div');
    editModal.className = 'modal';
    editModal.id = 'single-edit-modal';
    editModal.style.zIndex = '3000';
    
    editModal.innerHTML = `
    <div class="modal-content" style="max-width: 400px;">
      <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
      <h3>編輯詳細資料</h3>
      
      <div style="margin-bottom: 15px;">
        <label>名稱 / 姓名</label>
        <input type="text" id="edit-name-input" value="${currentName}" style="width: 100%;">
      </div>

      <div style="margin-bottom: 15px; display: ${currentView === 'vehicle' ? 'block' : 'none'};">
        <label>車牌號碼</label>
        <input type="text" id="edit-license-input" value="${rawItem?.license_plate || ''}" placeholder="例：ABC-1234" style="width: 100%; border: 1px solid var(--neon-orange);">
      </div>

      <div style="margin-bottom: 15px; display: ${currentView === 'equipment' ? 'block' : 'none'};">
        <label>完整名稱 (詳細)</label>
        <input type="text" id="edit-detail-name-input" value="${currentDetail}" style="width: 100%;">
      </div>

      <div style="margin-bottom: 15px;">
        <label>${groupLabel}</label>
        <select id="edit-group-select" style="width: 100%;">
          ${groups.map(g => `<option value="${g}" ${g === currentGroup ? 'selected' : ''}>${g}</option>`).join('')}
          <option value="__custom__">📝 新增自訂...</option>
        </select>
        <input type="text" id="edit-custom-group-input" placeholder="新名稱" style="width: 100%; margin-top: 10px; display: none;">
      </div>

      <button onclick="confirmEditItem('${id}')" style="width: 100%; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 8px;">儲存變更</button>
    </div>
    `;

    document.body.appendChild(editModal);
    editModal.style.display = 'block';

    document.getElementById('edit-group-select').onchange = function() {
        document.getElementById('edit-custom-group-input').style.display = this.value === '__custom__' ? 'block' : 'none';
    };
}

// ==========================================
// 🚀 批次新增人員：準備視窗 (支援從 users 表調用)
// ==========================================
async function showBatchAddModal() {
    // 1. 直連獲取現有群組清單
    const { data: personnel } = await _supabase.from('personnel_control').select('name, group_name').eq('is_active', true);
    const groups = personnel ? [...new Set(personnel.map(p => p.group_name))].filter(Boolean) : [];
    const activeNames = personnel ? personnel.map(p => p.name) : []; // 記下已經在任務中的人名

    // 2. 獲取 users 表單的既有人員 (加上探測器)
    const { data: usersData, error: usersErr } = await _supabase.from('users').select('姓名, display_name');

    // 🚨 聲納探測器：請按 F12 打開開發者工具的 Console (主控台) 看這裡印出什麼！
    if (usersErr) console.error("【敵襲警告】Supabase 拒絕存取：", usersErr);

    // 過濾出尚未加入任務的 users
    let availableUsers = [];
    if (usersData) {
        availableUsers = usersData
            .map(u => {
                // 順便印出每筆資料，看是不是欄位名稱有落差
                const extractedName = u.姓名 || u.display_name;
                return extractedName ? extractedName.trim() : null;
            })
            .filter(name => name && !activeNames.includes(name)); // 過濾掉已經在任務中的人

        // 移除重複的名字
        availableUsers = [...new Set(availableUsers)];
    }

    // 建立彈窗
    const existingModal = document.getElementById('batch-add-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'batch-add-modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 95%; max-height: 90vh; margin: 2vh auto;">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h3 style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                <i class="fas fa-users-plus"></i> 批次新增人員
            </h3>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">選擇加入群組</label>
                <select id="batch-group-select" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px;">
                    ${groups.map(g => `<option value="${g}">${g}</option>`).join('')}
                    <option value="__custom__">📝 輸入新組別...</option>
                </select>
                <input type="text" id="batch-custom-group-input" placeholder="輸入新組別名稱" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px; margin-top: 10px; display: none;">
            </div>

            <!-- 🎯 新增：從既有使用者選擇 -->
            <div style="margin-bottom: 15px; background: rgba(0, 243, 255, 0.05); padding: 15px; border-radius: 8px; border: 1px dashed var(--neon-cyan);">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--neon-cyan);">從系統既有人員選擇</label>
                <div style="display: flex; gap: 10px;">
                    <select id="batch-user-select" style="flex: 1; padding: 12px; border: 1px solid var(--neon-cyan); background: #000; color: var(--text-bright); border-radius: 8px; font-size: 15px;">
                        <option value="">-- 請選擇人員 --</option>
                        ${availableUsers.map(name => `<option value="${name}">${name}</option>`).join('')}
                    </select>
                    <button onclick="addSelectedUserToList()" style="padding: 12px 20px; background: rgba(0, 243, 255, 0.2); color: var(--neon-cyan); border: 1px solid var(--neon-cyan); border-radius: 8px; font-weight: bold; white-space: nowrap;">
                        <i class="fas fa-user-check"></i> 加入選取
                    </button>
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">或手動輸入姓名</label>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="batch-name-input" placeholder="輸入人員姓名..." style="flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px;">
                    <button onclick="addPersonToList()" style="padding: 12px 20px; background: #4CAF50; color: white; border: none; border-radius: 8px; font-weight: bold; white-space: nowrap;">
                        <i class="fas fa-plus"></i> 加入
                    </button>
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">待新增清單 (<span id="batch-count">0</span> 人)</label>
                <div id="batch-person-list" style="max-height: 30vh; overflow-y: auto; border: 1px solid #ddd; border-radius: 8px; padding: 10px; background: #f9f9f9;"></div>
            </div>

            <button onclick="confirmBatchAdd()" style="width: 100%; padding: 15px; background: #2196F3; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
                <i class="fas fa-check"></i> 確認新增
            </button>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'block';

    window.batchPersonList = [];

    document.getElementById('batch-group-select').onchange = function () {
        const customInput = document.getElementById('batch-custom-group-input');
        if (this.value === '__custom__') {
            customInput.style.display = 'block';
            customInput.focus();
        } else {
            customInput.style.display = 'none';
        }
    };

    document.getElementById('batch-name-input').onkeypress = function (e) {
        if (e.key === 'Enter') addPersonToList();
    };
}

// ==========================================
// 🚨 補回遺失的函數：處理下拉選單加入清單
// ==========================================
function addSelectedUserToList() {
    const select = document.getElementById('batch-user-select');
    const name = select.value;

    if (!name) {
        showNotification('請選擇人員');
        return;
    }

    const groupSelect = document.getElementById('batch-group-select');
    const customGroupInput = document.getElementById('batch-custom-group-input');

    let group = groupSelect.value;
    if (group === '__custom__') {
        group = customGroupInput.value.trim();
        if (!group) {
            showNotification('請輸入組別名稱');
            return;
        }
    }

    // 防呆：檢查是否已經在下方的待新增清單中
    if (window.batchPersonList.some(p => p.name === name)) {
        return showNotification('此人已在待新增清單中！');
    }

    // 加入清單
    window.batchPersonList.push({ name, group_name: group });

    // 更新畫面顯示
    renderBatchPersonList();

    // 🎯 貼心設計：將選過的人從下拉選單中移除，避免重複選取
    select.options[select.selectedIndex].remove();
    select.value = "";
}

// 加入人員到清單
function addPersonToList() {
    const nameInput = document.getElementById('batch-name-input');
    const groupSelect = document.getElementById('batch-group-select');
    const customGroupInput = document.getElementById('batch-custom-group-input');

    const name = nameInput.value.trim();
    if (!name) {
        showNotification('請輸入姓名');
        return;
    }

    let group = groupSelect.value;
    if (group === '__custom__') {
        group = customGroupInput.value.trim();
        if (!group) {
            showNotification('請輸入組別名稱');
            return;
        }
    }

    // 加入清單
    window.batchPersonList.push({ name, group_name: group });

    // 更新顯示
    renderBatchPersonList();

    // 清空輸入框
    nameInput.value = '';
    nameInput.focus();
}

// 渲染批次新增清單
function renderBatchPersonList() {
    const listDiv = document.getElementById('batch-person-list');
    const countSpan = document.getElementById('batch-count');

    if (window.batchPersonList.length === 0) {
        listDiv.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">尚未加入任何人員</div>';
        countSpan.textContent = '0';
        return;
    }

    countSpan.textContent = window.batchPersonList.length;

    listDiv.innerHTML = window.batchPersonList.map((person, index) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: white; border: 1px solid #eee; border-radius: 8px; margin-bottom: 8px;">
      <div>
        <strong style="font-size: 15px;">${person.name}</strong>
        <div style="font-size: 12px; color: #666; margin-top: 3px;">
          <i class="fas fa-users"></i> ${person.group_name}
        </div>
      </div>
      <button onclick="removePersonFromList(${index})" style="padding: 8px 12px; background: #F44336; color: white; border: none; border-radius: 5px; font-size: 13px;">
        <i class="fas fa-times"></i> 取消
      </button>
    </div>
  `).join('');
}

// 從清單移除人員 (自動歸建版)
function removePersonFromList(index) {
    // 1. 先記住要被移除的這位弟兄是誰
    const removedPerson = window.batchPersonList[index];

    // 2. 從待新增清單的陣列中移除他
    window.batchPersonList.splice(index, 1);

    // 3. 🎯 核心修復：把他安全送回下拉選單！
    const select = document.getElementById('batch-user-select');
    if (select) {
        // 先檢查選單裡是不是已經有他了 (預防您剛剛是用「手動輸入」加他進來的)
        let exists = false;
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === removedPerson.name) {
                exists = true;
                break;
            }
        }

        // 如果選單裡沒有他，就幫他做一個新的專屬座位放回去
        if (!exists) {
            const newOption = document.createElement('option');
            newOption.value = removedPerson.name;
            newOption.textContent = removedPerson.name;
            select.appendChild(newOption);
        }
    }

    // 4. 重新渲染下方的待新增畫面
    renderBatchPersonList();
}

// 增強版搜尋功能 - 可搜尋所有項目
function setupEnhancedMissionSearch() {
    const searchInput = document.getElementById('mission-search-all');
    if (!searchInput) return;

    searchInput.oninput = function () {
        const searchTerm = this.value.trim().toLowerCase();
        const items = document.querySelectorAll('.mission-item');
        const groups = document.querySelectorAll('.mission-group');

        if (!searchTerm) {
            // 沒有搜尋詞，顯示所有項目和群組
            items.forEach(item => item.style.display = 'flex');
            groups.forEach(group => {
                const groupItems = group.querySelectorAll('.mission-item');
                const hasVisible = Array.from(groupItems).some(item => item.style.display !== 'none');
                group.style.display = hasVisible ? 'block' : 'none';
            });
            return;
        }

        let foundAny = false;

        // 先隱藏所有群組標題
        groups.forEach(group => {
            group.style.display = 'none';
        });

        // 搜尋每個項目
        items.forEach(item => {
            const name = item.querySelector('.mission-item-name').textContent.toLowerCase();
            const group = item.querySelector('.mission-item-group').textContent.toLowerCase();
            const status = item.querySelector('.mission-item-status').textContent.toLowerCase();

            const matches = name.includes(searchTerm) ||
                group.includes(searchTerm) ||
                status.includes(searchTerm);

            if (matches) {
                item.style.display = 'flex';
                foundAny = true;

                // 顯示所屬群組
                const groupElement = item.closest('.mission-group');
                if (groupElement) {
                    groupElement.style.display = 'block';
                }
            } else {
                item.style.display = 'none';
            }
        });

        // 如果沒有找到任何項目，顯示提示
        const noResults = document.getElementById('mission-no-results');
        if (!foundAny) {
            if (!noResults) {
                const container = document.getElementById('mission-items-container');
                const message = document.createElement('div');
                message.id = 'mission-no-results';
                message.innerHTML = `
                    <div style="text-align: center; padding: 30px; color: #666;">
                        <i class="fas fa-search" style="font-size: 40px; margin-bottom: 10px; opacity: 0.5;"></i>
                        <p style="font-size: 16px;">找不到符合 "${searchTerm}" 的項目</p>
                        <p style="font-size: 14px; opacity: 0.8;">請嘗試其他關鍵字</p>
                    </div>
                `;
                container.appendChild(message);
            }
        } else if (noResults) {
            noResults.remove();
        }
    };
}

function renderMissionGroups() {
    const { all, type, currentTab } = window.missionData || { all: [], type: 'personnel' };
    const container = document.getElementById('mission-items-container');

    if (!container) return;

    container.innerHTML = '';

    // 過濾項目
    let filteredItems = all;
    if (currentTab === 'current') {
        filteredItems = all.filter(item => item.inMission);
    } else if (currentTab === 'available') {
        filteredItems = all.filter(item => !item.inMission);
    }

    // 按群組分組
    const groups = {};
    filteredItems.forEach(item => {
        if (!groups[item.group]) {
            groups[item.group] = [];
        }
        groups[item.group].push(item);
    });

    // 渲染每個群組
    Object.keys(groups).sort(customGroupSort).forEach(groupName => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'mission-group';
        groupDiv.style.cssText = `
            margin-bottom: 15px;
            background: #f9f9f9;
            border-radius: 8px;
            overflow: hidden;
        `;

        // 群組標題
        const groupHeader = document.createElement('div');
        groupHeader.className = 'mission-group-header';
        groupHeader.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 15px;
            background: #f0f0f0; /* 🎯 預設改為灰色 */
            border-left: 4px solid #4CAF50;
            cursor: pointer;
            user-select: none;
        `;

        groupHeader.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <!-- 🎯 箭頭預設轉向 -90度 -->
                <i class="fas fa-chevron-down" style="transition: transform 0.3s; font-size: 12px; transform: rotate(-90deg);"></i>
                <div>
                    <div style="font-weight: bold; color: #333;">${groupName}</div>
                    <div style="font-size: 12px; color: #666;">${groups[groupName].length} 個項目</div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 5px;">
                <input type="checkbox" class="group-checkbox" data-group="${groupName}" style="transform: scale(1.2);">
                <button onclick="event.stopPropagation(); toggleGroupSelection('${groupName}')" style="background: none; border: none; color: #2196F3; font-size: 14px; cursor: pointer;">
                    全選群組
                </button>
            </div>
        `;

        // 群組內容
        const groupContent = document.createElement('div');
        groupContent.className = 'mission-group-content';
        groupContent.id = `group-content-${groupName.replace(/\s+/g, '-')}`;
        groupContent.style.cssText = `
            padding: 10px;
            display: none; /* 🎯 預設隱藏 */
        `;

        // 群組內項目 (此段邏輯保持不變)
        groups[groupName].forEach(item => {
            const displayName = type === 'personnel' ? item.name : (item.detail_name || item.name);
            const statusText = type === 'personnel' ?
                (item.status === 'BoO' ? '基地' : '外出') :
                (item.status === '在隊' ? '在隊' : '應勤');

            const itemDiv = document.createElement('div');
            itemDiv.className = 'mission-item';
            itemDiv.style.cssText = `
                display: flex;
                align-items: center;
                padding: 10px;
                margin-bottom: 5px;
                background: white;
                border-radius: 6px;
                border: 1px solid #eee;
                transition: all 0.2s;
            `;

            itemDiv.innerHTML = `
                <input type="checkbox" class="item-checkbox" data-id="${item.id}" data-group="${groupName}" style="margin-right: 10px; transform: scale(1.2);">
                <div style="flex: 1; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div class="mission-item-name" style="font-weight: bold; margin-bottom: 2px;">${displayName}</div>
                        <div class="mission-item-group" style="font-size: 12px; color: #666; background: #f0f0f0; padding: 2px 6px; border-radius: 3px; display: inline-block;">
                            ${groupName}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="mission-item-status" style="font-size: 12px; padding: 4px 8px; border-radius: 4px; background: ${item.inMission ? '#FFEBEE' : '#E8F5E9'}; color: ${item.inMission ? '#C62828' : '#2E7D32'};">
                            ${item.inMission ? '任務中' : '未加入'}
                        </span>
                        <span style="font-size: 12px; color: #666;">
                            ${statusText}
                        </span>
                    </div>
                </div>
            `;

            itemDiv.onmouseenter = () => {
                itemDiv.style.backgroundColor = '#f5f5f5';
                itemDiv.style.transform = 'translateX(3px)';
            };
            itemDiv.onmouseleave = () => {
                itemDiv.style.backgroundColor = 'white';
                itemDiv.style.transform = 'translateX(0)';
            };

            groupContent.appendChild(itemDiv);
        });

        // 點擊事件 (此段邏輯保持不變，會自動與預設狀態銜接)
        groupHeader.addEventListener('click', function () {
            const icon = this.querySelector('i');
            const content = document.getElementById(`group-content-${groupName.replace(/\s+/g, '-')}`);

            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.style.transform = 'rotate(0deg)';
                this.style.background = '#e8f5e8';
            } else {
                content.style.display = 'none';
                icon.style.transform = 'rotate(-90deg)';
                this.style.background = '#f0f0f0';
            }
        });

        groupDiv.appendChild(groupHeader);
        groupDiv.appendChild(groupContent);
        container.appendChild(groupDiv);
    });

    setupMissionEventListeners();
    updateMissionStats();
}

// 設置事件監聽器
function setupMissionEventListeners() {
    // 項目勾選框事件
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', updateMissionStats);
    });

    // 群組勾選框事件
    document.querySelectorAll('.group-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const groupName = this.dataset.group;
            const groupCheckboxes = document.querySelectorAll(`.item-checkbox[data-group="${groupName}"]`);
            groupCheckboxes.forEach(cb => {
                cb.checked = this.checked;
            });
            updateMissionStats();
        });
    });
}

// 切換標籤頁
function switchMissionTab(tab) {
    window.missionData.currentTab = tab;

    // 更新標籤樣式
    document.querySelectorAll('.mission-tab').forEach(tabBtn => {
        tabBtn.style.borderBottom = '2px solid transparent';
        tabBtn.style.color = '#666';
        tabBtn.classList.remove('active');
    });

    const activeTab = document.querySelector(`.mission-tab[onclick*="${tab}"]`);
    if (activeTab) {
        activeTab.style.borderBottom = '2px solid #4CAF50';
        activeTab.style.color = '#4CAF50';
        activeTab.classList.add('active');
    }

    // 重新渲染
    renderMissionGroups();
}

// 全選所有項目
function selectAllItems() {
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.checked = true;
    });
    document.querySelectorAll('.group-checkbox').forEach(checkbox => {
        checkbox.checked = true;
    });
    updateMissionStats();
}

// 取消全選
function deselectAllItems() {
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    document.querySelectorAll('.group-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateMissionStats();
}

// 切換群組選取
function toggleGroupSelection(groupName) {
    const groupCheckbox = document.querySelector(`.group-checkbox[data-group="${groupName}"]`);
    if (groupCheckbox) {
        groupCheckbox.checked = !groupCheckbox.checked;
        groupCheckbox.dispatchEvent(new Event('change'));
    }
}

// 展開所有群組
function expandAllGroups() {
    document.querySelectorAll('.mission-group-content').forEach(content => {
        content.style.display = 'block';
    });
    document.querySelectorAll('.mission-group-header i').forEach(icon => {
        icon.style.transform = 'rotate(0deg)';
    });
}

// 收合所有群組
function collapseAllGroups() {
    document.querySelectorAll('.mission-group-content').forEach(content => {
        content.style.display = 'none';
    });
    document.querySelectorAll('.mission-group-header i').forEach(icon => {
        icon.style.transform = 'rotate(-90deg)';
    });
}


// 渲染任務列表
function renderMissionLists() {
    const { master, current, type } = window.missionData || { master: [], current: [], type: 'personnel' };

    // 過濾：總資料庫中排除已經在當前任務中的項目
    const currentIds = new Set(current.map(item => item.id));
    const availableMaster = master.filter(item => !currentIds.has(item.id));

    // 渲染總資料庫列表
    const masterContainer = document.getElementById('master-list-container');
    masterContainer.innerHTML = '';

    if (availableMaster.length === 0) {
        masterContainer.innerHTML = `
            <div style="text-align: center; color: #666; padding: 20px;">
                沒有可加入的項目
            </div>
        `;
    } else {
        availableMaster.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'mission-master-item';
            itemDiv.style.cssText = `
                display: flex;
                align-items: center;
                padding: 8px;
                margin-bottom: 5px;
                background: #f9f9f9;
                border-radius: 4px;
                border: 1px solid #eee;
            `;

            const displayName = type === 'personnel' ? item.name : (item.detail_name || item.name);
            const groupName = type === 'personnel' ? (item.group_name || '未分組') : (item.category || '未分類');

            itemDiv.innerHTML = `
                <input type="checkbox" class="master-checkbox" data-id="${item.id}" style="margin-right: 10px;">
                <div style="flex: 1;">
                    <div style="font-weight: bold;">${displayName}</div>
                    <div style="font-size: 12px; color: #666;">${groupName}</div>
                </div>
            `;

            masterContainer.appendChild(itemDiv);
        });
    }

    // 渲染當前任務列表
    const currentContainer = document.getElementById('current-list-container');
    currentContainer.innerHTML = '';

    if (current.length === 0) {
        currentContainer.innerHTML = `
            <div style="text-align: center; color: #666; padding: 20px;">
                任務中沒有項目
            </div>
        `;
    } else {
        current.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'mission-current-item';
            itemDiv.style.cssText = `
                display: flex;
                align-items: center;
                padding: 8px;
                margin-bottom: 5px;
                background: #f0f8ff;
                border-radius: 4px;
                border: 1px solid #ddeeff;
            `;

            const displayName = type === 'personnel' ? item.name : (item.detail_name || item.name);
            const groupName = type === 'personnel' ? (item.group_name || '未分組') : (item.category || '未分類');
            const status = item.status || (type === 'personnel' ? 'BoO' : '在隊');

            itemDiv.innerHTML = `
                <input type="checkbox" class="current-checkbox" data-id="${item.id}" style="margin-right: 10px;">
                <div style="flex: 1;">
                    <div style="font-weight: bold;">${displayName}</div>
                    <div style="font-size: 12px; color: #666;">${groupName} | 狀態: ${status}</div>
                </div>
            `;

            currentContainer.appendChild(itemDiv);
        });
    }

    // 更新統計
    updateMissionStats();
}

// 設置搜尋功能
function setupMissionSearch() {
    const searchInput = document.getElementById('master-search');
    if (searchInput) {
        searchInput.oninput = function () {
            const searchTerm = this.value.toLowerCase();
            const items = document.querySelectorAll('.mission-master-item');

            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        };
    }
}

// 更新任務統計
function updateMissionStats() {
    const { all } = window.missionData || { all: [] };

    // 計算各種數量
    const totalItems = all.length;
    const currentItems = all.filter(item => item.inMission).length;
    const availableItems = totalItems - currentItems;

    // 計算選取數量
    const selectedCheckboxes = document.querySelectorAll('.item-checkbox:checked');
    const selectedCount = selectedCheckboxes.length;

    // 更新顯示
    document.getElementById('total-items-count').textContent = totalItems;
    document.getElementById('current-mission-count').textContent = currentItems;
    document.getElementById('available-count').textContent = availableItems;
    document.getElementById('total-selected-count').textContent = selectedCount;

    // 計算選取項目的狀態
    let inMissionSelected = 0;
    let availableSelected = 0;

    selectedCheckboxes.forEach(checkbox => {
        // 🎯 核心修正：不要使用 parseInt，直接拿字串 ID
        const itemId = checkbox.dataset.id; 
        
        // 使用 String() 強制轉字串比對，確保人員(BigInt)與車輛(UUID)都能找到
        const item = all.find(item => String(item.id) === String(itemId));
        
        if (item) {
            if (item.inMission) {
                inMissionSelected++;
            } else {
                availableSelected++;
            }
        }
    });

    // 更新按鈕狀態
    const addBtn = document.getElementById('add-to-mission-btn');
    const removeBtn = document.getElementById('remove-from-mission-btn');

    if (addBtn) {
        addBtn.disabled = availableSelected === 0;
        addBtn.style.opacity = availableSelected === 0 ? '0.5' : '1';
    }

    if (removeBtn) {
        removeBtn.disabled = inMissionSelected === 0;
        removeBtn.style.opacity = inMissionSelected === 0 ? '0.5' : '1';
    }
}

// 選擇所有總資料庫項目
function selectAllMaster() {
    document.querySelectorAll('.master-checkbox').forEach(checkbox => {
        checkbox.checked = true;
    });
    updateMissionStats();
}

// 取消選擇所有總資料庫項目
function deselectAllMaster() {
    document.querySelectorAll('.master-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateMissionStats();
}

// 選擇所有當前任務項目
function selectAllCurrent() {
    document.querySelectorAll('.current-checkbox').forEach(checkbox => {
        checkbox.checked = true;
    });
    updateMissionStats();
}

// 取消選擇所有當前任務項目
function deselectAllCurrent() {
    document.querySelectorAll('.current-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateMissionStats();
}

window.showMissionManagement = showMissionManagement;
/////////////////////////////////////////////////////
// 新增 CSS 動畫
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .summary-name {
        cursor: pointer;
        display: inline-block;
        margin: 2px 5px;
        padding: 2px 5px;
        border-radius: 3px;
    }
    
    .summary-name:hover {
        background-color: #f0f0f0;
        text-decoration: underline;
    }
    
    .summary-name.warning {
        color: #FF0000;
    }
    
    .summary-name.warning:hover {
        background-color: #fff0f0;
    }
    
    .summary-group {
        margin-bottom: 15px;
    }
    
    .group-title {
        font-weight: bold;
        margin-bottom: 5px;
    }
    
    .group-title.warning {
        color: #FF0000;
    }
    
    .history-timeline {
        margin-top: 20px;
    }
    
    .timeline-item {
        padding: 10px;
        border-left: 3px solid #4CAF50;
        margin-bottom: 10px;
        background-color: #f9f9f9;
    }
    
    .timeline-item.warning {
        border-left-color: #FF0000;
        background-color: #fff5f5;
    }
    
    .detail-btn {
        padding: 8px 15px;
        background-color: #0066cc;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        margin-top: 10px;
    }
    
    .detail-btn:hover {
        background-color: #0052a3;
    }
    
    .group-btn {
        padding: 8px 15px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.3s;
        min-width: 120px;
    }
    
    .group-btn.boo {
        background-color: #90EE90;
        color: #000;
    }
    
    .group-btn.out {
        background-color: #FF6347;
        color: #fff;
    }
    
    .group-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
    
    .group-control-item {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
        align-items: center;
        padding: 10px;
        background-color: #f8f8f8;
        border-radius: 5px;
    }
`;
document.head.appendChild(style);

console.log('系統初始化完成，等待使用者操作...');

// ==========================================
// 🟢 效能與特效管理 (省電模式)
// ==========================================
function toggleNeonEffects() {
    const isDisabled = document.body.classList.toggle('effects-disabled');
    document.documentElement.classList.toggle('effects-disabled');

    const icon = document.querySelector('#settings-fab i');
    if (isDisabled) {
        if (icon) icon.className = 'fas fa-leaf';
        showNotification('🟢 已開啟省電模式 (關閉背景特效)');
        localStorage.setItem('neonEffects', 'off'); // 記憶使用者設定
    } else {
        if (icon) icon.className = 'fas fa-magic';
        showNotification('✨ 已恢復炫炮特效');
        localStorage.setItem('neonEffects', 'on');
    }
}

// 系統初始化時，讀取使用者的省電設定
document.addEventListener('DOMContentLoaded', function () {
    if (localStorage.getItem('neonEffects') === 'off') {
        document.body.classList.add('effects-disabled');
        document.documentElement.classList.add('effects-disabled');
        const icon = document.querySelector('#settings-fab i');
        if (icon) icon.className = 'fas fa-leaf';
    }
});