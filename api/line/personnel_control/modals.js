// modals.js
// ==========================================
// 🪟 彈窗與面板控制模組 (Modal & Panel)
// ==========================================

// ❌ 1. 通用關閉彈窗
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        if (modalId === 'quick-modal') {
            document.removeEventListener('keydown', handleQuickModalKeydown);
        }
    }
}

// 🗂️ 2. 面板切換控制 (資訊、歷史、分籤)
function toggleInfoPanel() {
    document.getElementById('info-panel').classList.toggle('show');
}

function toggleHistoryPanel() {
    document.getElementById('history-panel').classList.toggle('show');
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes(tabName === 'info' ? '系統說明' : '詳細資料'));
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-content`);
    });
}

// ==========================================
// 📝 原因彈窗系列 (單一、群組、批次)
// ==========================================

// --- 單一操作原因 ---
function showReasonModal(itemId, newStatus) {
    const data = currentView === 'personnel' ? currentData.employees : currentData.equipment;
    const item = data.find(item => item.id === itemId);
    if (!item) return console.error(`找不到項目 ID: ${itemId}`);

    const existingModal = document.getElementById('reason-modal');
    if (existingModal) existingModal.remove();
    const existingGroupModal = document.getElementById('group-reason-modal');
    if (existingGroupModal) existingGroupModal.remove();

    const itemName = item.detail_name || item.name;
    const title = `${itemName} - 請選擇${currentView === 'personnel' ? '外出' : '應勤'}原因`;

    const reasonModal = document.createElement('div');
    reasonModal.id = 'reason-modal';
    reasonModal.className = 'modal';

    reasonModal.innerHTML = `
        <div class="modal-content reason-modal-content">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h3>${title}</h3>
            <div class="modal-body">
                <div class="reason-options" id="reason-options">
                    ${currentReasons.map(reason => `<div class="reason-option" onclick="handleReasonOptionClick(this, ${itemId}, '${newStatus}')">${reason}</div>`).join('')}
                 </div>
                <div class="custom-reason-input" id="custom-reason-input" style="display: none;">
                    <input type="text" placeholder="請輸入自訂原因..." maxlength="50">
                </div>
                <div class="reason-actions flex gap-3 w-full mt-4">
                    <button onclick="this.closest('.modal').remove()" class="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-3 md:py-4 rounded-xl text-base md:text-lg font-bold tracking-widest shadow-lg active:scale-95 transition-all">取 消</button>
                    <button onclick="handleConfirmReason(${itemId}, '${newStatus}')" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 md:py-4 rounded-xl text-base md:text-lg font-bold tracking-widest shadow-lg active:scale-95 transition-all">確 認</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(reasonModal);
    reasonModal.style.display = 'block';
}

window.handleReasonOptionClick = function (element, itemId, newStatus) {
    const reasonModal = document.getElementById('reason-modal');
    if (!reasonModal) return;
    reasonModal.querySelectorAll('.reason-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');

    const customInput = reasonModal.querySelector('#custom-reason-input');
    if (element.textContent === '其他') {
        if (customInput) { customInput.style.display = 'block'; customInput.querySelector('input')?.focus(); }
    } else {
        if (customInput) customInput.style.display = 'none';
    }
};

window.handleConfirmReason = async function (itemId, newStatus) {
    const reasonModal = document.getElementById('reason-modal');
    if (!reasonModal) return;

    let selectedReason = '';
    const selectedOption = reasonModal.querySelector('.reason-option.selected');
    if (selectedOption) {
        selectedReason = selectedOption.textContent;
        if (selectedReason === '其他') {
            selectedReason = reasonModal.querySelector('#custom-reason-input input')?.value.trim() || '';
        }
    }

    if (!selectedReason && (newStatus === '外出' || newStatus === '應勤')) {
        return showNotification('請選擇或輸入原因');
    }
    reasonModal.remove();
    await performStatusUpdateDirect(itemId, newStatus, selectedReason);
};

// --- 群組操作原因 ---
function showGroupReasonModal(groupName, newStatus, specificIds = null) {
    const data = currentView === 'personnel' ? currentData.employees : currentData.equipment;
    let groupItems = data.filter(item => {
        const groupKey = currentView === 'personnel' ? item.group : item.category;
        return groupKey === groupName;
    });

    if (specificIds) groupItems = groupItems.filter(item => specificIds.includes(item.id));
    if (groupItems.length === 0) return;

    const existingModal = document.getElementById('group-reason-modal');
    if (existingModal) existingModal.remove();

    const title = `${groupName} - 請選擇${currentView === 'personnel' ? '外出' : '應勤'}原因`;
    const reasonModal = document.createElement('div');
    reasonModal.id = 'group-reason-modal';
    reasonModal.className = 'modal';

    reasonModal.innerHTML = `
        <div class="modal-content reason-modal-content">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h3>${title}</h3>
            <div class="modal-body">
                <p>將為 ${groupItems.length} 個選取項目設定相同原因：</p>
                <div class="reason-options" id="group-reason-options">
                    ${currentReasons.map(reason => `<div class="reason-option" onclick="selectGroupReason(this, '${groupName}', '${newStatus}')">${reason}</div>`).join('')}
                </div>
                <div class="custom-reason-input" id="group-custom-reason-input" style="display: none;">
                    <input type="text" placeholder="請輸入自訂原因..." maxlength="50">
                </div>
                <div class="reason-actions">
                    <button onclick="confirmGroupReasonUpdate('${groupName}', '${newStatus}')">確認</button>
                    <button onclick="this.closest('.modal').remove()">取消</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(reasonModal);
    reasonModal.style.display = 'block';
    if (specificIds) reasonModal.dataset.specificIds = JSON.stringify(specificIds);
}

function selectGroupReason(element, groupName, newStatus) {
    const reasonModal = document.getElementById('group-reason-modal');
    if (!reasonModal) return;
    reasonModal.querySelectorAll('.reason-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');

    const customInput = reasonModal.querySelector('#group-custom-reason-input');
    if (element.textContent === '其他') {
        if (customInput) { customInput.style.display = 'block'; customInput.querySelector('input')?.focus(); }
    } else {
        if (customInput) customInput.style.display = 'none';
    }
}

async function confirmGroupReasonUpdate(groupName, newStatus) {
    const reasonModal = document.getElementById('group-reason-modal');
    if (!reasonModal) return;

    let selectedReason = '';
    const selectedOption = reasonModal.querySelector('.reason-option.selected');

    if (selectedOption) {
        selectedReason = selectedOption.textContent;
        if (selectedReason === '其他') {
            selectedReason = reasonModal.querySelector('#group-custom-reason-input input')?.value.trim() || '';
        }
    }

    if (!selectedReason && (newStatus === '外出' || newStatus === '應勤')) {
        return showNotification('請選擇或輸入原因');
    }

    let specificIds = null;
    if (reasonModal.dataset.specificIds) {
        specificIds = JSON.parse(reasonModal.dataset.specificIds);
    }

    reasonModal.remove();
    await performBatchGroupUpdateViaAPI(groupName, newStatus, selectedReason, specificIds);
}

// --- 批次全部操作原因 ---
function showBatchAllReasonModal(newStatus) {
    const existingModal = document.getElementById('batch-all-reason-modal');
    if (existingModal) existingModal.remove();

    const title = `全部${newStatus === '外出' ? '外出' : '應勤'} - 請選擇原因`;
    const reasonModal = document.createElement('div');
    reasonModal.id = 'batch-all-reason-modal';
    reasonModal.className = 'modal';

    reasonModal.innerHTML = `
        <div class="modal-content reason-modal-content">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h3>${title}</h3>
            <div class="modal-body">
                <div class="reason-options" id="batch-all-reason-options">
                    ${currentReasons.map(reason => `<div class="reason-option" onclick="selectBatchAllReason(this, '${newStatus}')">${reason}</div>`).join('')}
                </div>
                <div class="custom-reason-input" id="batch-all-custom-reason-input" style="display: none;">
                    <input type="text" placeholder="請輸入自訂原因..." maxlength="50">
                </div>
                <div class="reason-actions">
                    <button onclick="confirmBatchAllReason('${newStatus}')">確認</button>
                    <button onclick="this.closest('.modal').remove()">取消</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(reasonModal);
    reasonModal.style.display = 'block';
}

function selectBatchAllReason(element, newStatus) {
    const reasonModal = document.getElementById('batch-all-reason-modal');
    if (!reasonModal) return;
    reasonModal.querySelectorAll('.reason-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');

    const customInput = reasonModal.querySelector('#batch-all-custom-reason-input');
    if (element.textContent === '其他') {
        if (customInput) { customInput.style.display = 'block'; customInput.querySelector('input')?.focus(); }
    } else {
        if (customInput) customInput.style.display = 'none';
    }
}

async function confirmBatchAllReason(newStatus) {
    const reasonModal = document.getElementById('batch-all-reason-modal');
    if (!reasonModal) return;

    let selectedReason = '';
    const selectedOption = reasonModal.querySelector('.reason-option.selected');
    if (selectedOption) {
        selectedReason = selectedOption.textContent;
        if (selectedReason === '其他') {
            selectedReason = reasonModal.querySelector('#batch-all-custom-reason-input input')?.value.trim() || '';
        }
    }

    if (!selectedReason) return showNotification('請選擇或輸入原因');
    reasonModal.remove();
    await performBatchAllUpdate(newStatus, selectedReason);
}

// ==========================================
// 🖼️ 其他資訊彈窗 (圖片放大、歷史、狀態)
// ==========================================

function showImageModal(name, status, time) {
    let item = currentView === 'personnel' 
        ? currentData.employees.find(emp => emp.detail_name === name || emp.name === name)
        : currentData.equipment.find(eq => eq.detail_name === name || eq.name === name);

    if (!item) return console.error('找不到項目:', name);

    let lastReason = '';
    if (item.time_history) {
        const historyLines = item.time_history.split('\n').filter(line => line.trim());
        const reasonMatch = (historyLines[0] || '').match(/\((.*?)\)/);
        if (reasonMatch) lastReason = reasonMatch[1];
    }

    const imgPath = getPhotoPath(item.photo);
    const modalImg = document.getElementById('modal-image');
    modalImg.src = imgPath;
    modalImg.alt = name;
    modalImg.onerror = function () {
        const folder = currentView === 'personnel' ? 'people' : 'equipment';
        this.src = `assets/${folder}/default.jpg`;
        this.onerror = null;
    };

    const displayName = item.detail_name || item.name;
    const groupInfo = currentView === 'personnel' ? item.group : item.category;

    document.getElementById('image-info').innerHTML = `
        <h3>${displayName}</h3>
        ${item.detail_name && item.detail_name !== item.name ? `<p class="short-name">簡稱：${item.name}</p>` : ''}
        <p><strong>${currentView === 'personnel' ? '組別' : '類別'}：</strong>${groupInfo}</p>
        <p><strong>狀態：</strong><span class="status-badge ${getStatusClass(item.status)}">${status}</span></p>
        <p><strong>最後更新：</strong>${time}</p>
        ${lastReason && (item.status === '外出' || item.status === '應勤') ? `<div class="image-reason"><strong>${currentView === 'personnel' ? '外出' : '應勤'}原因：</strong><span>${lastReason}</span></div>` : ''}
        <button class="view-history-btn" id="view-history-btn-modal"><i class="fas fa-history"></i> 查看歷史紀錄</button>
    `;

    document.getElementById('image-modal').style.display = 'block';

    setTimeout(() => {
        const historyBtn = document.getElementById('view-history-btn-modal');
        if (historyBtn) {
            historyBtn.onclick = function () {
                closeModal('image-modal');
                setTimeout(() => showHistory(item.name), 300);
            };
        }
    }, 100);
}

function showHistory(name) {
    selectedItem = name;
    let item = currentView === 'personnel' 
        ? currentData.employees.find(emp => emp.name === name)
        : currentData.equipment.find(eq => eq.name === name || eq.detail_name === name);

    const historyContainer = document.getElementById('history-content');
    historyContainer.innerHTML = '';

    if (!item) {
        historyContainer.innerHTML = `<h4>${name}</h4><p style="color:#666; text-align:center;">找不到相關資料</p>`;
    } else {
        const displayName = item.detail_name || item.name;
        const title = document.createElement('h4');
        title.textContent = `${displayName}的歷史紀錄`;
        historyContainer.appendChild(title);

        const historyLines = (item.time_history || '').split('\n').filter(line => line.trim());

        if (historyLines.length === 0) {
            historyContainer.innerHTML += '<p style="color:#666; font-style:italic;">暫無歷史紀錄</p>';
        } else {
            historyLines.forEach(record => {
                const recordDiv = document.createElement('div');
                if (record.includes('(') && record.includes(')')) {
                    recordDiv.className = 'history-item with-reason';
                    const reasonMatch = record.match(/\((.*?)\)/);
                    const reason = reasonMatch ? reasonMatch[1] : '';
                    const recordWithoutReason = record.replace(/\s*\(.*?\)/, '');
                    recordDiv.innerHTML = `<div>${recordWithoutReason}</div>${reason ? `<span class="reason-badge">${reason}</span>` : ''}`;
                } else {
                    recordDiv.className = `history-item ${record.includes('應勤') || record.includes('外出') ? 'warning' : ''}`;
                    recordDiv.textContent = record;
                }
                recordDiv.onclick = () => showHistoryDetail(displayName);
                historyContainer.appendChild(recordDiv);
            });
        }
        updateDetailInfo(item);
    }

    const historyPanel = document.getElementById('history-panel');
    if (historyPanel) {
        historyPanel.classList.remove('show');
        void historyPanel.offsetHeight;
        setTimeout(() => historyPanel.classList.add('show'), 10);
    }
}

function showHistoryDetail(name) {
    let item = currentView === 'personnel' 
        ? currentData.employees.find(emp => emp.name === name)
        : currentData.equipment.find(eq => eq.name === name);
    if (!item) return;

    document.getElementById('history-title').textContent = `${name}的詳細時序`;
    const historyLines = (item.time_history || '').split('\n').filter(line => line.trim());

    document.getElementById('history-detail').innerHTML = `
        <h4>${name} (${getStatusDisplayText(item.status)})</h4>
        <div class="history-timeline">
            ${historyLines.map(record => `<div class="timeline-item ${record.includes('外出') || record.includes('應勤') ? 'warning' : ''}">${record}</div>`).join('')}
        </div>
    `;
    document.getElementById('history-detail-modal').style.display = 'block';
}

function updateDetailInfo(item) {
    const container = document.getElementById('detail-content');
    if (!item) return container.innerHTML = '<p>請選擇項目查看詳細資訊</p>';

    container.innerHTML = `
        <h4>${item.name}</h4>
        <p><strong>狀態：</strong> <span class="${getStatusClass(item.status)}">${getStatusDisplayText(item.status)}</span></p>
        <p><strong>最後更新：</strong> ${item.time_status}</p>
        <p><strong>${currentView === 'personnel' ? '分組' : '類別'}：</strong> ${currentView === 'personnel' ? item.group : item.category}</p>
        <p><strong>歷史紀錄筆數：</strong> ${(item.time_history || '').split('\n').filter(line => line.trim()).length}</p>
        <button class="detail-btn" onclick="showHistoryDetail('${item.name}')">查看詳細時序</button>
    `;
}

function showStatusDetail(type) {
    const data = currentView === 'personnel' ? currentData.employees : currentData.equipment;
    let filteredData, title;

    if (type === 'boo') {
        filteredData = data.filter(item => item.status === (currentView === 'personnel' ? 'BoO' : '在隊'));
        title = currentView === 'personnel' ? `基地人員 (${filteredData.length}人)` : `在隊裝備 (${filteredData.length}項)`;
    } else {
        filteredData = data.filter(item => item.status === (currentView === 'personnel' ? '外出' : '應勤'));
        title = currentView === 'personnel' ? `外出人員 (${filteredData.length}人)` : `應勤裝備 (${filteredData.length}項)`;
    }

    const groups = {};
    filteredData.forEach(item => {
        const groupKey = currentView === 'personnel' ? item.group : item.category;
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(item);
    });

    const container = document.getElementById('status-detail-container');
    container.innerHTML = '';

    if (filteredData.length === 0) {
        container.innerHTML = '<p class="empty-message">目前無人員</p>';
    } else {
        Object.keys(groups).sort().forEach(groupName => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'status-group';
            groupDiv.innerHTML = `<div class="status-group-title">${groupName} (${groups[groupName].length})</div>`;
            
            const namesList = document.createElement('div');
            namesList.className = 'status-names-grid';
            groups[groupName].forEach(item => {
                const nameBtn = document.createElement('button');
                nameBtn.className = 'status-name-btn';
                nameBtn.textContent = item.detail_name || item.name;
                nameBtn.onclick = () => {
                    closeModal('status-detail-modal');
                    setTimeout(() => { showHistory(item.name); toggleHistoryPanel(); }, 300);
                };
                namesList.appendChild(nameBtn);
            });
            groupDiv.appendChild(namesList);
            container.appendChild(groupDiv);
        });
    }

    document.getElementById('status-detail-title').textContent = title;
    document.getElementById('status-detail-modal').style.display = 'block';
}