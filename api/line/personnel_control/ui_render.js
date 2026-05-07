// ui_render.js
// ==========================================
// 🎨 UI 渲染模組 (負責生成卡片、群組與狀態標籤)
// ==========================================

// 🏷️ 1. 取得狀態對應的 CSS class
function getStatusClass(status) {
    if (currentView === 'personnel') return status === 'BoO' ? 'boo' : 'out';
    if (currentView === 'equipment') return status === '在隊' ? 'boo' : 'out';
    if (currentView === 'vehicle') return status === '在隊' ? 'boo' : 'out'; // 車輛邏輯與器材相同
    return 'out';
}

// 🏷️ 2. 取得狀態顯示文字
function getStatusDisplayText(status) {
    if (currentView === 'personnel') return status === 'BoO' ? '基地' : '外出';
    if (currentView === 'equipment') return status === '在隊' ? '在隊' : '應勤';
    if (currentView === 'vehicle') return status === '在隊' ? '在隊' : '應勤';
    return status;
}

// 🗂️ 3. 渲染主畫面群組控制與清單
// modals/群組控制/group_manager.js 中的 renderGroupControls() 已經被重構到這裡，並且進行了優化與增強。

// 🗂️ 4. 觸發選取單位的操作
function updateSelectedInGroup(groupName, newStatus) {
    const checkboxes = document.querySelectorAll(`.group-member-checkbox[data-group="${groupName}"]:checked`);
    if (checkboxes.length === 0) return showNotification('⚠️ 請先勾選要外出的單位');
    const ids = Array.from(checkboxes).map(cb => cb.dataset.id);
    batchUpdateGroupStatus(groupName, newStatus, ids);
}

// 🗂️ 5. 展開/收起群組成員 (完整捲動加強版)
function toggleGroupMembers(groupName) {
    const membersList = document.getElementById(`members-${groupName}`);
    if (!membersList) {
        console.error(`找不到成員列表: members-${groupName}`);
        return;
    }

    // 抓取觸發事件的按鈕
    const btn = event.target.closest('.expand-btn');
    if (!btn) return;

    const icon = btn.querySelector('i');
    const isExpanded = membersList.classList.contains('expanded');

    if (isExpanded) {
        // --- 收起邏輯 ---
        membersList.classList.remove('expanded');
        btn.classList.remove('expanded');
        if (icon) icon.className = 'fas fa-chevron-down';
        membersList.style.display = 'none';
    } else {
        // --- 展開邏輯 ---
        membersList.classList.add('expanded');
        btn.classList.add('expanded');
        if (icon) icon.className = 'fas fa-chevron-up';
        membersList.style.display = 'block';

        // 🎯 關鍵補回：等待 100ms 確保 DOM 渲染完成後再捲動
        setTimeout(() => {
            try {
                membersList.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            } catch (e) {
                console.warn('自動捲動失敗（不影響功能）:', e);
            }
        }, 100);
    }
}

// 🗂️ 6. 渲染所有卡片容器
async function renderCards() {
    // 🎯 A. 根據當前視圖，精準選擇對應的 HTML 容器
    let containerId = 'personnel-cards';
    if (currentView === 'equipment') containerId = 'equipment-cards';
    if (currentView === 'vehicle') containerId = 'vehicle-cards'; // 補上車輛容器

    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    
    // 🎯 B. 根據當前視圖，選取正確的資料來源
    let data = [];
    if (currentView === 'personnel') data = currentData.employees;
    else if (currentView === 'equipment') data = currentData.equipment;
    else if (currentView === 'vehicle') data = currentData.vehicles; // 補上車輛資料

    if (data.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <p>暫無資料</p>
            <p>資料筆數：0</p>
            <button onclick="refreshData()" style="margin-top: 10px;">重新載入</button>
        `;
        emptyMessage.style.cssText = "text-align: center; padding: 40px; color: #666; font-size: 16px;";
        container.appendChild(emptyMessage);
        return;
    }

    const statsDiv = document.createElement('div');
    statsDiv.className = 'data-stats';
    statsDiv.style.cssText = `
        grid-column: 1 / -1; background: rgba(0, 243, 255, 0.05); border: 1px solid var(--neon-cyan);
        box-shadow: inset 0 0 10px rgba(0, 243, 255, 0.1); padding: 12px 20px; border-radius: 6px;
        margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;
    `;
    statsDiv.innerHTML = `
        <span style="color: var(--neon-cyan); font-weight: bold; text-shadow: 0 0 5px rgba(0, 243, 255, 0.5);">
            <i class="fas fa-users"></i> 此任務共 ${data.length} 個單位
        </span>
        <button onclick="refreshData()" style="padding: 6px 15px; background: rgba(0, 243, 255, 0.15); border: 1px solid var(--neon-cyan); color: var(--neon-cyan); border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.3s; text-shadow: 0 0 5px var(--neon-cyan);">
            <i class="fas fa-sync-alt"></i> 刷新
        </button>
    `;
    container.appendChild(statsDiv);

    const groupedData = {};
    data.forEach(item => {
        // 🎯 升級三向判斷：人員和車輛都是用 item.group，只有器材是用 item.category
        let groupKey = item.group;
        if (currentView === 'equipment') groupKey = item.category;
        
        if (groupKey && !groupedData[groupKey]) groupedData[groupKey] = [];
        if (groupKey) groupedData[groupKey].push(item);
    });

    Object.keys(groupedData).sort(customGroupSort).forEach(groupName => {
        const groupHeader = document.createElement('div');
        groupHeader.className = 'group-header';
        groupHeader.innerHTML = `<h3>${groupName} (${groupedData[groupName].length}人)</h3>`;
        groupHeader.style.cssText = "grid-column: 1 / -1; margin: 20px 0 10px 0; padding-bottom: 5px; border-bottom: 2px solid #ccc; color: #333;";
        container.appendChild(groupHeader);

        groupedData[groupName].forEach(item => {
            const card = createCardSync(item); 
            container.appendChild(card);
        });
    });
}

// 🗂️ 7. 創建單一卡片 (同步版引擎)
function createCardSync(item) {
    const card = document.createElement('div');
    card.className = `card ${getStatusClass(item.status)}`;
    card.dataset.id = item.id;
    card.dataset.status = item.status;
    card.dataset.time = item.time_status;
    
    // 🎯 升級三向判斷
    card.dataset.group = currentView === 'equipment' ? item.category : item.group;

    const statusText = getStatusDisplayText(item.status);
    const displayName = item.detail_name || item.name;

    let currentReason = '';
    if ((item.status === '外出' || item.status === '應勤') && item.time_history) {
        const historyLines = item.time_history.split('\n').filter(line => line.trim());
        const lastEntry = historyLines[0] || '';
        const reasonMatch = lastEntry.match(/\((.*?)\)/);
        if (reasonMatch) {
            currentReason = reasonMatch[1];
        }
    }

    const imgPath = getPhotoPath(item.photo);
    const imgElement = document.createElement('img');
    imgElement.src = imgPath;
    imgElement.alt = displayName;
    imgElement.className = 'card-image';
    imgElement.dataset.filename = item.photo;
    
    // 🎯 升級三向判斷相簿路徑
    let imgCat = 'personnel';
    if (currentView === 'equipment') imgCat = 'equipment';
    if (currentView === 'vehicle') imgCat = 'vehicles';
    imgElement.dataset.category = imgCat;

    imgElement.onerror = function () {
        const fileName = this.dataset.filename;
        if (fileName) {
            let cleanName = fileName.trim();
            if (!cleanName.includes('.')) cleanName = cleanName + '.jpg';
            badImageCache[cleanName] = true;
        }
        this.src = getDefaultDrivePhoto();
        this.onerror = null;
    };

    imgElement.onclick = function () {
        showImageModal(displayName, statusText, item.time_status);
    };

    const cardContent = document.createElement('div');
    let buttonsHTML = '';

    if (userRole === '管理') {
        // 🎯 動態判斷狀態字眼 (車輛與器材共用「在隊/應勤」的邏輯)
        const btnBooText = currentView === 'personnel' ? 'BoO' : '在隊';
        const btnOutText = currentView === 'personnel' ? '外出' : '應勤';

        buttonsHTML = `
            <div class="card-buttons">
                <button class="status-btn boo ${item.status === btnBooText ? 'active' : ''}"
                        onclick="updateStatus('${item.id}', '${btnBooText}')">
                    ${btnBooText}
                </button>
                <button class="status-btn out ${item.status === btnOutText ? 'active' : ''}"
                        onclick="updateStatus('${item.id}', '${btnOutText}')">
                    ${btnOutText}
                </button>
            </div>
        `;
    } else {
        // 一般用戶看到的唯讀狀態 (這裡的函數已經支援車輛了，直接沿用！)
        const statusClass = getStatusClass(item.status);
        const displayStatus = getStatusDisplayText(item.status);
        buttonsHTML = `
            <div class="card-buttons">
                <div class="status-display ${statusClass}">
                    ${displayStatus}
                </div>
            </div>
        `;
    }

    let cardBodyHTML = '';

    if (currentView === 'equipment') {
        // 🎯 器材：極簡化，只顯示簡稱 (item.name)
        cardBodyHTML = `
            <div class="card-name shortname" data-name="${item.name}">${item.name}</div>
            <div class="card-status">${item.time_status} ${statusText}</div>
        `;
    } else if (currentView === 'vehicle') {
        // 🎯 車輛：顯示名字 + 下方顯示車牌號碼 (license_plate)
        cardBodyHTML = `
            <div class="card-name" data-name="${item.name}">${item.name}</div>
            <div class="card-category" style="color: var(--neon-orange); font-size: 13px; margin-bottom: 5px; font-weight: bold; text-align: center;">
                <i class="fas fa-id-card"></i> ${item.license_plate || '無車牌'}
            </div>
            <div class="card-status">${item.time_status} ${statusText}</div>
        `;
    } else {
        // 人員：維持你原本的排版
        const displayName = item.detail_name || item.name;
        cardBodyHTML = `
            <div class="card-name" data-name="${item.name}">${displayName}</div>
            ${item.detail_name && item.detail_name !== item.name ? `<div class="card-shortname">${item.name}</div>` : ''}
            <div class="card-status">${item.time_status} ${statusText}</div>
        `;
    }

    // 組合最終內容
    cardContent.innerHTML = `
        ${cardBodyHTML}
        ${currentReason && (item.status === '外出' || item.status === '應勤') ? `<div class="card-reason">${currentReason}</div>` : ''}
        ${buttonsHTML}
    `;

    card.appendChild(imgElement);
    card.appendChild(cardContent);

    const nameElement = card.querySelector('.card-name');
    if (nameElement) {
        try {
            nameElement.style.cursor = 'pointer';
            nameElement.addEventListener('click', function () {
                showHistory(item.name);
            });
        } catch (error) {
            console.error('設置名字點擊事件時出錯:', error);
        }
    }

    return card;
}

// 🗂️ 8. 更新單一卡片 (智慧比對用)
function updateSingleCard(updatedItem) {
    // 🎯 升級三向判斷
    let containerId = 'personnel-cards';
    if (currentView === 'equipment') containerId = 'equipment-cards';
    if (currentView === 'vehicle') containerId = 'vehicle-cards';
    
    const container = document.getElementById(containerId);
    if (!container) return;

    const cardSelector = `.card[data-id="${updatedItem.id}"]`;
    const cardElement = container.querySelector(cardSelector);

    if (cardElement) {
        const newCard = createCardSync(updatedItem);
        cardElement.replaceWith(newCard);
    } else {
        renderView();
    }
}