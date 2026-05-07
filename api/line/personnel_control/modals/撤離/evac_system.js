// ==========================================
// 🚨 緊急撤離回報系統 (E.E.R.S) - 嚴謹全域版
// ==========================================
// 1. 開啟撤離系統
async function openEvacSystem() {
    // 🎯 戰術隱身：開啟撤離視窗時，隱藏右上角的節能按鈕
    const settingsFab = document.getElementById('settings-fab');
    if (settingsFab) settingsFab.style.display = 'none';
    const modal = document.getElementById('evac-modal');
    const cancelAlertBtn = document.getElementById('evac-cancel-alert-btn');

    const isEvacOngoing = currentData.employees.some(p => p.evac_status && p.evac_status !== 'NONE');

    if (userRole === '管理') {
        cancelAlertBtn.style.display = 'block';
        if (!isEvacOngoing) {
            const choice = confirm("⚠️ 目前無撤離警報。\n\n是否要 [發布緊急撤離]？\n(這會將任務面板上『所有人』標記為失聯！)");
            if (choice) {
                await executeEvacAlert();
            } else {
                return;
            }
        }
    } else {
        cancelAlertBtn.style.display = 'none';
        if (!isEvacOngoing) return showNotification('目前平安，無撤離警報。');
        showNotification('🚨 撤離警報！請盡速點擊自己的名字回報安全！');
    }

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    renderEvacList();

    // 🔥 修正：10秒輪詢只針對撤離資料 (不干擾主畫面)
    if (evacInterval) clearInterval(evacInterval);
    evacInterval = setInterval(async () => {
        // 只有在人員畫面且撤離系統開啟時才抓資料
        const { data } = await _supabase.from('personnel_control').select('id, evac_status').eq('is_active', true);
        if (data) {
            // 更新本地快取
            data.forEach(remoteItem => {
                const localItem = currentData.employees.find(p => p.id === remoteItem.id);
                if (localItem) localItem.evac_status = remoteItem.evac_status;
            });
            // 刷新彈窗畫面
            renderEvacList();

            // 🎯 核心火力支援 3：讓背景輪詢也能連動刷新右下角按鈕與紅光
            updateQuickEvacFAB();
            updateStats();
        }
    }, 10000);
}

// 2. 🚨 取消警報 -> 徹底結束撤離狀態
async function cancelEvacAlert() {
    if (confirm("⚠️ 確定要【取消撤離警報】嗎？\n\n這將結束本次撤離，所有人員恢復正常狀態，警報燈號將會熄滅！")) {
        try {
            // 把所有參加任務的人 (is_active) 狀態洗回 NONE
            const activeIds = currentData.employees.map(p => p.id);
            if (activeIds.length > 0) {
                // 瞬間修改本地記憶體
                currentData.employees.forEach(p => p.evac_status = 'NONE');
                // 同步寫入雲端
                await _supabase.from('personnel_control').update({ evac_status: 'NONE' }).in('id', activeIds);
                // 🟢 連動關閉全域廣播
                await _supabase.from('system_settings').update({ is_evac_active: false, updated_at: new Date().toISOString() }).eq('id', 1);
            }

            showNotification('✅ 撤離警報已解除！');

            // 關閉視窗 (我們已在裡面加上強制重繪邏輯)
            closeEvacWindow();

        } catch (err) {
            showNotification('❌ 解除警報失敗：' + err.message);
        }
    }
}

// 3. 關閉視窗 (單純隱藏介面，警報繼續)
function closeEvacWindow() {
    const modal = document.getElementById('evac-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = 'auto';

    // 停止 10 秒輪詢
    if (evacInterval) {
        clearInterval(evacInterval);
        evacInterval = null;
    }
    // 🎯 戰術歸建：關閉視窗後，恢復右上角的節能按鈕
    const settingsFab = document.getElementById('settings-fab');
    if (settingsFab) settingsFab.style.display = 'flex';
    // 之前改好的強制跳回人員面板指令
    switchView('personnel');
}

// 4. 執行發布撤離 (將所有 is_active = true 的人設為 MISSING)
async function executeEvacAlert() {
    try {
        const activeIds = currentData.employees.map(p => p.id);
        if (activeIds.length === 0) return showNotification('⚠️ 目前沒有任何人員參與任務！');

        document.getElementById('evac-list-container').innerHTML = '<div style="text-align:center; padding:20px; color:var(--neon-cyan);">撤離協議啟動中...</div>';

        // 瞬間修改本地記憶體
        currentData.employees.forEach(p => p.evac_status = 'MISSING');

        // 批次寫入：所有人變成失聯
        const { error } = await _supabase.from('personnel_control').update({ evac_status: 'MISSING' }).in('id', activeIds);
        // 🚨 連動開啟全域廣播
        await _supabase.from('system_settings').update({ is_evac_active: true, updated_at: new Date().toISOString() }).eq('id', 1);
        if (error) throw error;

        renderEvacList();

        // 🎯 這裡也換成最強制的刷新指令
        switchView('personnel');

        showNotification('🚨 撤離警報已發布！');
    } catch (err) {
        showNotification('❌ 發布失敗：' + err.message);
    }
}

// 5. 渲染名單畫面 (徹底拔除對「外出」狀態的依賴)
function renderEvacList() {
    const container = document.getElementById('evac-list-container');

    // 🚨 只要在面板上的人 (currentData.employees)，不管是不是外出，全部列入撤離名單！
    const targetPeople = currentData.employees;

    // 計算人數：只要不是 SAFE，就通通算作 MISSING (包含初始狀態)
    const safeCount = targetPeople.filter(p => p.evac_status === 'SAFE').length;
    const missingCount = targetPeople.length - safeCount;

    document.getElementById('evac-safe-count').textContent = safeCount;
    document.getElementById('evac-missing-count').textContent = missingCount;

    if (targetPeople.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#666;">無參與任務之人員。</div>';
        return;
    }

    const groups = {};
    targetPeople.forEach(item => {
        const g = item.group || '未分組';
        if (!groups[g]) groups[g] = [];
        groups[g].push(item);
    });

    // 🎯 新增：排序邏輯 (算好每組是不是全部 SAFE)
    const sortedGroupNames = Object.keys(groups).sort((a, b) => {
        const safeA = groups[a].filter(p => p.evac_status === 'SAFE').length;
        const safeB = groups[b].filter(p => p.evac_status === 'SAFE').length;
        const isCompleteA = safeA === groups[a].length ? 1 : 0; // 1代表全安全
        const isCompleteB = safeB === groups[b].length ? 1 : 0;
        return isCompleteA - isCompleteB || a.localeCompare(b); // 未完成(0)排前面
    });

    let html = '';
    // 🎯 修改：把 Object.keys 改成我們排好序的 sortedGroupNames
    sortedGroupNames.forEach(groupName => {
        
        // 🎯 新增：算出這組幾分之幾
        const safeCount = groups[groupName].filter(p => p.evac_status === 'SAFE').length;
        const totalCount = groups[groupName].length;
        const isComplete = safeCount === totalCount;
        const groupClass = isComplete ? 'evac-group-complete' : 'evac-group-incomplete';

        // 🎯 修改：換成帶有 (幾/幾) 加上排版特效的 HTML
        html += `
            <div class="${groupClass}" style="margin-bottom: 20px; transition: opacity 0.5s;">
                <div style="color: ${isComplete ? 'var(--neon-green)' : 'var(--text-dim)'}; border-bottom: 1px dashed ${isComplete ? 'var(--neon-green)' : 'var(--border-dim)'}; padding-bottom: 5px; margin-bottom: 15px; font-weight: bold; letter-spacing: 1px; display: flex; justify-content: space-between; align-items: center;">
                    <span>${groupName} <span style="font-size: 0.9em; margin-left: 8px; opacity: 0.9;">(${safeCount}/${totalCount})</span></span>
                    ${isComplete ? '<i class="fas fa-check-circle" style="text-shadow: 0 0 5px var(--neon-green);"></i>' : ''}
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 15px;">
        `;

        groups[groupName].forEach(p => {
            const displayName = p.detail_name || p.name;
            const isSafe = (p.evac_status === 'SAFE');
            const statusClass = isSafe ? 'evac-safe' : 'evac-missing';

            const isMe = currentUser ? (currentUser.displayName === p.name || currentUser.displayName === p.detail_name) : false;
            const canClick = (userRole === '管理' || isMe);

            const clickAction = canClick
                ? `toggleEvacStatus(${p.id}, '${p.evac_status}')`
                : `showNotification('⚠️ 只能回報自己的安全狀態！')`;
            const pointerClass = canClick ? 'clickable' : 'locked';

            html += `
                <div class="evac-card ${statusClass} ${pointerClass}" onclick="${clickAction}" data-id="${p.id}">
                    ${displayName}
                </div>
            `;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
}

// 6. 點擊切換狀態
async function toggleEvacStatus(id, currentEvacStatus) {
    const newStatus = (currentEvacStatus === 'SAFE') ? 'MISSING' : 'SAFE';

    // 瞬間改變 UI (針對清單裡的卡片)
    const card = document.querySelector(`.evac-card[data-id="${id}"]`);
    if (card) {
        card.className = `evac-card ${newStatus === 'SAFE' ? 'evac-safe' : 'evac-missing'} clickable`;
        card.onclick = () => toggleEvacStatus(id, newStatus);
    }

    // 瞬間修改本地記憶體，防止輪詢時讀到舊資料
    const person = currentData.employees.find(p => p.id === id);
    if (person) {
        person.evac_status = newStatus;
    }

    // 立即刷新清單畫面
    renderEvacList();

    // 🎯 核心火力支援 1：立刻刷新右下角的 FAB 按鈕外觀！(原本漏了這行導致畫面卡死)
    updateQuickEvacFAB();

    // 🎯 核心火力支援 2：立刻檢查全系統警報狀態，同步刷新主畫面紅光
    updateStats();

    try {
        const { error } = await _supabase.from('personnel_control').update({ evac_status: newStatus }).eq('id', id);
        if (error) throw error;
    } catch (err) {
        showNotification('更新失敗，請檢查網路連線！');
        await loadDataFromSupabase();
        renderEvacList();
        updateQuickEvacFAB(); // 失敗時自動退回紅色驚嘆號
        updateStats();
    }
}

// ==========================================
// 🚨 全域 5 秒撤離「奪命連環 Call」提醒輪詢
// ==========================================
setInterval(() => {
    // 只有在人員畫面才檢查
    if (currentView !== 'personnel') return;

    // 檢查全系統是否處於撤離狀態
    const isEvacOngoing = currentData.employees.some(p => p.evac_status && p.evac_status !== 'NONE');
    if (!isEvacOngoing) return;

    // 確定當前使用者身分是否在任務中
    if (!currentUser) return;
    const myRecord = currentData.employees.find(p => p.name === currentUser.displayName || p.detail_name === currentUser.displayName);

    // 🎯 核心：如果你在任務中，而且狀態是 MISSING (尚未回報)，就彈射通知！
    if (myRecord && myRecord.evac_status === 'MISSING') {
        showNotification('🚨 撤離警報！點右下方回報安全！');
    }
}, 5000);


// ==========================================
// 🚨 個人專屬一鍵撤離回報 (FAB 控制)
// ==========================================

// 1. 更新右下角按鈕狀態
function updateQuickEvacFAB() {
    const fab = document.getElementById('quick-evac-fab');
    if (!fab) return;

    if (currentView !== 'personnel') {
        fab.style.display = 'none';
        return;
    }

    const isEvacOngoing = currentData.employees.some(p => p.evac_status && p.evac_status !== 'NONE');
    if (!isEvacOngoing || !currentUser) {
        fab.style.display = 'none';
        return;
    }

    const myRecord = currentData.employees.find(p => p.name === currentUser.displayName || p.detail_name === currentUser.displayName);
    if (!myRecord) {
        fab.style.display = 'none';
        return;
    }

    fab.style.display = 'flex';
    if (myRecord.evac_status === 'SAFE') {
        fab.className = 'safe';
        fab.innerHTML = '<i class="fas fa-check"></i>'; // 🎯 乾淨的打勾
    } else {
        fab.className = 'missing';
        fab.innerHTML = '<i class="fas fa-exclamation-triangle"></i>'; // 🚨 驚嘆號
    }
}

// 2. 點擊右下角按鈕的觸發事件
async function quickToggleMyEvacStatus() {
    if (!currentUser) return;
    const myRecord = currentData.employees.find(p => p.name === currentUser.displayName || p.detail_name === currentUser.displayName);
    if (!myRecord) return;

    // 借用已經寫好的狀態切換邏輯 (自動包含樂觀更新、雲端寫入與錯誤還原)
    await toggleEvacStatus(myRecord.id, myRecord.evac_status);
}
