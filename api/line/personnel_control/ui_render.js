// ui_render.js
// ==========================================
// 🎨 UI 渲染模組 (負責生成卡片、群組與狀態標籤)
// ==========================================

// 🏷️ 1. 取得狀態對應的 CSS class
function getStatusClass(status) {
    if (currentView === 'personnel') {
        return status === 'BoO' ? 'boo' : 'out';
    } else {
        return status === '在隊' ? 'boo' : 'out';
    }
}

// 🏷️ 2. 取得狀態顯示文字
function getStatusDisplayText(status) {
    if (currentView === 'personnel') {
        return status === 'BoO' ? '基地' : '外出';
    } else {
        return status === '在隊' ? '在隊' : '應勤';
    }
}

// 🗂️ 3. 渲染主畫面群組控制與清單
// modals/群組控制/group_manager.js 中的 renderGroupControls() 已經被重構到這裡，並且進行了優化與增強。

// 🗂️ 4. 觸發選取單位的操作
function updateSelectedInGroup(groupName, newStatus) {
    const checkboxes = document.querySelectorAll(`.group-member-checkbox[data-group="${groupName}"]:checked`);
    if (checkboxes.length === 0) return showNotification('⚠️ 請先勾選要外出的單位');
    const ids = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
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
    const containerId = currentView === 'personnel' ? 'personnel-cards' : 'equipment-cards';
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    const data = currentView === 'personnel' ? currentData.employees : currentData.equipment;

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
            <i class="fas fa-users"></i> 此任務共 ${data.length} 參與人員
        </span>
        <button onclick="refreshData()" style="padding: 6px 15px; background: rgba(0, 243, 255, 0.15); border: 1px solid var(--neon-cyan); color: var(--neon-cyan); border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.3s; text-shadow: 0 0 5px var(--neon-cyan);">
            <i class="fas fa-sync-alt"></i> 刷新
        </button>
    `;
    container.appendChild(statsDiv);

    const groupedData = {};
    data.forEach(item => {
        const groupKey = currentView === 'personnel' ? item.group : item.category;
        if (!groupedData[groupKey]) groupedData[groupKey] = [];
        groupedData[groupKey].push(item);
    });

    Object.keys(groupedData).sort().forEach(groupName => {
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
    card.dataset.group = currentView === 'personnel' ? item.group : item.category;

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
    imgElement.dataset.category = currentView === 'personnel' ? 'personnel' : 'equipment';

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
        buttonsHTML = `
            <div class="card-buttons">
                <button class="status-btn boo ${item.status === 'BoO' || item.status === '在隊' ? 'active' : ''}"
                        onclick="updateStatus(${item.id}, '${currentView === 'personnel' ? 'BoO' : '在隊'}')">
                    ${currentView === 'personnel' ? 'BoO' : '在隊'}
                </button>
                <button class="status-btn out ${item.status === '外出' || item.status === '應勤' ? 'active' : ''}"
                        onclick="updateStatus(${item.id}, '${currentView === 'personnel' ? '外出' : '應勤'}')">
                    ${currentView === 'personnel' ? '外出' : '應勤'}
                </button>
            </div>
        `;
    } else {
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

    cardContent.innerHTML = `
        ${currentView === 'equipment' && item.category ? `<div class="card-category">${item.category}</div>` : ''}
        <div class="card-name ${item.detail_name ? 'fullname' : 'shortname'}" data-name="${item.name}" title="${item.detail_name ? item.name : ''}">
            ${displayName}
        </div>
        ${item.detail_name && item.detail_name !== item.name ? `<div class="card-shortname">簡稱：${item.name}</div>` : ''}
        <div class="card-status">${item.time_status} ${statusText}</div>
        ${currentReason && (item.status === '外出' || item.status === '應勤') ? `<div class="card-reason" title="原因：${currentReason}">${currentReason}</div>` : ''}
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
    const containerId = currentView === 'personnel' ? 'personnel-cards' : 'equipment-cards';
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