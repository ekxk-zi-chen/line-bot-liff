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
function renderGroupControls() {
    const container = document.getElementById('group-controls');
    container.innerHTML = '';
    const data = currentView === 'personnel' ? currentData.employees : currentData.equipment;

    const groups = {};
    data.forEach(item => {
        const groupKey = currentView === 'personnel' ? item.group : item.category;
        if (groupKey && !groups[groupKey]) groups[groupKey] = [];
        if (groupKey) groups[groupKey].push(item);
    });

    Object.keys(groups).forEach(groupName => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'group-control-item';

        // 群組標題區 (終極合體版)
        const groupHeader = document.createElement('div');
        groupHeader.className = 'group-control-header';
        groupHeader.style.cssText = "display: flex; align-items: center; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px dashed var(--border-dim);";

        let adminBtns = '';
        if (userRole === '管理') {
            adminBtns = `
                <div style="display: flex; gap: 8px; margin-left: auto; margin-right: 10px;">
                    <button onclick="batchUpdateGroupStatus('${groupName}', '${currentView === 'personnel' ? 'BoO' : '在隊'}')" style="padding: 4px 8px; font-size: 11px; border-radius: 4px; background: rgba(0,255,102,0.1); color: var(--neon-green); border: 1px solid var(--neon-green); cursor: pointer; font-weight: bold; white-space: nowrap; box-shadow: 0 0 5px rgba(0,255,102,0.2);">
                        全部${currentView === 'personnel' ? '歸隊' : '在隊'}
                    </button>
                    <button onclick="batchUpdateGroupStatus('${groupName}', '${currentView === 'personnel' ? '外出' : '應勤'}')" style="padding: 4px 8px; font-size: 11px; border-radius: 4px; background: rgba(255,0,85,0.1); color: var(--neon-red); border: 1px solid var(--neon-red); cursor: pointer; font-weight: bold; white-space: nowrap; box-shadow: 0 0 5px rgba(255,0,85,0.2);">
                        全部${currentView === 'personnel' ? '外出' : '應勤'}
                    </button>
                </div>
            `;
        } else {
            adminBtns = `<div style="margin-left: auto; margin-right: 10px; font-size: 11px; color: var(--text-dim);">僅管理操作</div>`;
        }

        groupHeader.innerHTML = `
            <h4 style="margin: 0; border: none; padding: 0; display: flex; align-items: center; gap: 6px; color: var(--neon-cyan);">
                ${groupName} 
                <span style="font-size: 12px; color: var(--text-dim); font-weight: normal;">(${groups[groupName].length}人)</span>
            </h4>
            ${adminBtns}
            <button class="expand-btn" onclick="toggleGroupMembers('${groupName}')" style="padding: 5px; color: var(--text-dim); background: none; border: none; cursor: pointer;">
                <i class="fas fa-chevron-down"></i>
            </button>
        `;

        // 成員列表
        const membersList = document.createElement('div');
        membersList.className = 'group-members-list';
        membersList.id = `members-${groupName}`;
        membersList.style.display = 'none';

        groups[groupName].forEach(member => {
            const memberItem = document.createElement('div');
            memberItem.className = 'member-item';
            const displayName = member.detail_name || member.name;
            const statusClass = getStatusClass(member.status);
            const statusText = getStatusDisplayText(member.status);

            let currentReason = '';
            if (member.lastReason) {
                currentReason = member.lastReason;
            } else if (member.status === '外出' || member.status === '應勤') {
                const historyLines = (member.time_history || '').split('\n').filter(line => line.trim());
                if (historyLines[0]) {
                    const reasonMatch = historyLines[0].match(/\((.*?)\)/);
                    if (reasonMatch) currentReason = reasonMatch[1];
                }
            }

            memberItem.innerHTML = `
                <label style="display: flex; align-items: center; width: 100%; gap: 15px; cursor: pointer; margin: 0; padding: 5px;">
                    ${userRole === '管理' ? `<input type="checkbox" class="group-member-checkbox" data-group="${groupName}" data-id="${member.id}" style="transform: scale(1.4); margin-left: 5px; accent-color: var(--neon-orange);">` : ''}
                    <div class="member-info" style="flex: 1; display: flex; justify-content: space-between; align-items: center;">
                        <span class="member-name" style="font-size: 16px;">${displayName}</span>
                        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                            <span class="member-status ${statusClass}" style="padding: 4px 10px; font-size: 12px;">${statusText}</span>
                            ${currentReason && (member.status === '外出' || member.status === '應勤') ? `<span class="member-reason" style="font-size: 11px; color: var(--neon-red); background: rgba(255,0,85,0.1); padding: 2px 6px; border-radius: 4px; border: 1px dashed rgba(255,0,85,0.4);">原因: ${currentReason}</span>` : ''}
                        </div>
                    </div>
                </label>
            `;
            membersList.appendChild(memberItem);
        });

        if (userRole === '管理') {
            const actionFooter = document.createElement('div');
            actionFooter.style.cssText = "display: flex; justify-content: flex-end; margin-top: 15px; padding-top: 15px; border-top: 1px dashed var(--border-dim);";
            actionFooter.innerHTML = `
                <button onclick="updateSelectedInGroup('${groupName}', '${currentView === 'personnel' ? '外出' : '應勤'}')" style="padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.3s; background: rgba(255, 170, 0, 0.15); border: 1px solid var(--neon-orange); color: var(--neon-orange); text-align: center; box-shadow: 0 0 10px rgba(255, 170, 0, 0.2);">
                    <i class="fas fa-check-square"></i> 外出選取單位
                </button>
            `;
            membersList.appendChild(actionFooter); 
        }

        groupDiv.appendChild(groupHeader);
        groupDiv.appendChild(membersList);
        container.appendChild(groupDiv);
    });
}

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