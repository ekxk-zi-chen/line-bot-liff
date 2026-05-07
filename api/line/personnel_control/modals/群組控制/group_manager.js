// modals/群組控制/group_manager.js
// ==========================================
// 👥 群組批次控制模組 (Group Manager Module)
// ==========================================

// 顯示群組控制彈窗
function showGroupControl() {
    // 更新群組控制按鈕
    renderGroupControls();
    document.getElementById('group-modal').style.display = 'block';
}

// 顯示群組控制彈窗
function renderGroupControls() {
    const container = document.getElementById('group-controls');
    container.innerHTML = '';
    const data = currentView === 'personnel' ? currentData.employees : currentData.equipment;

    const groups = {};

    // 🎯 根據目前視圖定義單位與稱呼
    const unit = currentView === 'personnel' ? '人' : '個';
    const label = currentView === 'personnel' ? '成員' : '項目';

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
                <span style="font-size: 12px; color: var(--text-dim); font-weight: normal;">(${groups[groupName].length}${unit})</span>
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
                    <i class="fas fa-check-square"></i> 外出選取${label}(${groups[groupName].length}${unit})
                </button>
            `;
            membersList.appendChild(actionFooter); 
        }

        groupDiv.appendChild(groupHeader);
        groupDiv.appendChild(membersList);
        container.appendChild(groupDiv);
    });
}