// api_supabase.js
// ==========================================
// 💽 Supabase 資料庫互動邏輯 (API 層)
// ==========================================

// 🔥 1. 驗證身分與權限
async function verifyUserDirect() {
    const { data: authData, error: authErr } = await _supabase.auth.getSession();
    if (authErr || !authData.session) {
        console.warn("未登入，踢回大廳");
        window.location.replace('../lobby.html?redirect=' + encodeURIComponent(window.location.href));
        return;
    }
    const userEmail = authData.session.user.email;
    const { data: userData, error: dbErr } = await _supabase
        .from('users')
        .select('user_id, 姓名, 管理員, display_name, 電子信箱')
        .eq('電子信箱', userEmail)
        .single();

    if (dbErr || !userData) {
        console.warn("找不到此信箱的使用者資料，踢回大廳");
        window.location.replace('../lobby.html?redirect=' + encodeURIComponent(window.location.href));
        return;
    }

    const isAdmin = (userData.管理員 === '是' || userData.管理員 === 'true' || userData.管理員 === '管理');
    currentUser = {
        userId: userData.user_id,
        displayName: userData.display_name || userData.姓名 || '未知隊員',
        role: isAdmin ? '管理' : '一般用戶'
    };
    userRole = currentUser.role;
    console.log(`✅ 登入成功！身分：${currentUser.displayName} (${userRole})`);
}

// 📦 2. 載入主畫面資料 (終極並行載入版)
async function loadDataFromSupabase() {
    try {
        updateSyncStatus('syncing', '資料載入中...');
        syncStatus.isSyncing = true;

        // 🚀 核心：不判斷 currentView，一開機就用 Promise.all 同時發射三個請求！
        // (假設您的車輛資料表名稱為 'vehicle_control')
        const [resP, resE, resV] = await Promise.all([
            _supabase.from('personnel_control').select('*').eq('is_active', true).order('group_name').order('name'),
            _supabase.from('equipment_control').select('*').eq('is_active', true).order('category').order('name'),
            _supabase.from('vehicle_control').select('*').eq('is_active', true).order('group_name').order('name')
        ]);

        if (resP.error) throw resP.error;
        if (resE.error) throw resE.error;
        // 容錯處理：如果車輛表還沒建，不要讓整個系統崩潰
        if (resV.error && resV.error.code !== '42P01') console.warn('車輛表讀取警告:', resV.error);

        // 👨‍🚒 1. 寫入人員資料
        currentData.employees = (resP.data || []).map(item => ({
            id: item.id,
            name: item.name,
            group: item.group_name || '未分組',
            photo: item.photo || 'default.jpg',
            status: item.status || 'BoO',
            time_status: item.time_status || '',
            time_history: item.time_history || '',
            lastReason: item.reason || '',
            evac_status: item.evac_status || 'NONE',
            rawData: item
        }));

        // 🧰 2. 寫入器材資料
        currentData.equipment = (resE.data || []).map(item => ({
            id: item.id,
            name: item.name,
            detail_name: item.detail_name || item.name,
            category: item.category || '未分類',
            photo: item.photo || 'default.jpg',
            status: item.status || '在隊',
            time_status: item.time_status || '',
            time_history: item.time_history || '',
            lastReason: item.reason || '',
            rawData: item
        }));

        // 🚒 3. 寫入車輛資料 (比照器材邏輯)
        currentData.vehicles = (resV.data || []).map(item => ({
            id: item.id,
            name: item.name,
            group: item.group_name || '未分組', // 🎯 這裡改為 group_name
            photo: item.photo || 'default.jpg',
            status: item.status || '在隊',
            time_status: item.time_status || '',
            time_history: item.time_history || '',
            evac_status: item.evac_status || 'NONE',
            rawData: item
        }));

        syncStatus.lastSyncTime = new Date();
        syncStatus.isSyncing = false;
        updateSyncStatus('connected', `資料同步完成 (${new Date().toLocaleTimeString()})`);
        
        console.log("✅ 系統資料庫同步完畢：", 
            `人員 ${currentData.employees.length} 名 | `, 
            `器材 ${currentData.equipment.length} 件 | `,
            `車輛 ${currentData.vehicles.length} 輛`);

    } catch (error) {
        console.error('載入資料失敗：', error);
        syncStatus.isSyncing = false;
        updateSyncStatus('error', '資料載入失敗');
        // 不要 throw error 導致整個系統卡死，彈出通知即可
        showNotification(`❌ 資料載入失敗：${error.message}`);
    }
}

// 🕵️‍♂️ 輕量化檢查：只抓 ID 與 狀態時間 (time_status)，把封包壓到極致！
async function checkUpdatesFromSupabase() {
    // 如果正在進行完整同步，就先不打擾
    if (syncStatus.isSyncing) return;

    try {
        // 🚀 核心：改抓 time_status！因為你的程式碼每次更新都會確實寫入這個欄位
        const [resP, resE, resV] = await Promise.all([
            _supabase.from('personnel_control').select('id, time_status').eq('is_active', true),
            _supabase.from('equipment_control').select('id, time_status').eq('is_active', true),
            _supabase.from('vehicle_control').select('id, time_status').eq('is_active', true)
        ]);

        if (resP.error) throw resP.error;
        if (resE.error) throw resE.error;
        if (resV.error && resV.error.code !== '42P01') console.warn(resV.error);

        let hasChanges = false;

        // 🧠 建立比對邏輯
        const detectChanges = (localData, remoteData) => {
            if (!remoteData) return false;
            // 1. 數量不一樣（有人加入或移出面板），直接判定有變動
            if (localData.length !== remoteData.length) return true; 

            // 2. 建立遠端資料的字典 (Map)
            const remoteMap = {};
            remoteData.forEach(item => remoteMap[item.id] = item.time_status);

            // 3. 檢查本地端的每一筆資料
            return localData.some(localItem => {
                // 如果本地的時間，跟遠端對不上，代表有人改過狀態了！
                return remoteMap[localItem.id] !== localItem.time_status;
            });
        };

        // 依序檢查三個兵種
        hasChanges = hasChanges || detectChanges(currentData.employees, resP.data);
        hasChanges = hasChanges || detectChanges(currentData.equipment, resE.data);
        hasChanges = hasChanges || detectChanges(currentData.vehicles, resV.data || []);

        if (hasChanges) {
            console.log("🔄 發現雲端狀態有變動，啟動完整更新！");
            // 只要有一筆不同，就呼叫原本的重型函數去抓完整資料並重繪畫面
            await loadDataFromSupabase();
            renderView();
        } else {
            // console.log("✅ 輕量檢查完畢：無人變動，成功省下一次完整傳輸");
        }
    } catch (error) {
        console.error("輕量檢查失敗:", error);
    }
}

// ⚡ 3. 狀態更新底層 (單一與批次共用)
async function performStatusUpdateDirect(id, newStatus, reason, skipReload = false) {
    try {
        // 🎯 升級三向判斷：精準對應三個資料表
        let table = 'personnel_control';
        if (currentView === 'equipment') table = 'equipment_control';
        if (currentView === 'vehicle') table = 'vehicle_control';

        const currentTime = getCurrentTime();

        const { data: currentItem, error: fetchErr } = await _supabase
            .from(table).select('time_history').eq('id', id).single();
        if (fetchErr) throw fetchErr;

        const historyLines = (currentItem.time_history || '').split('\n').filter(l => l.trim());
        let historyEntry = newStatus;
        if (reason && (newStatus === '外出' || newStatus === '應勤')) historyEntry += ` (${reason})`;
        historyEntry += ' ' + currentTime;
        historyLines.unshift(historyEntry);
        if (historyLines.length > 20) historyLines.length = 20;

        const { error: updateErr } = await _supabase
            .from(table)
            .update({ status: newStatus, time_status: currentTime, time_history: historyLines.join('\n'), reason: reason || '' })
            .eq('id', id);
        if (updateErr) throw updateErr;

        if (!skipReload) {
            await loadDataFromSupabase();
            renderView();
            showNotification(`✅ 更新成功`);
        }
    } catch (error) {
        console.error('更新狀態失敗：', error);
        if (!skipReload) showNotification(`❌ 更新失敗：${error.message}`);
    }
}

// ✏️ 4. 編輯人員寫入
async function confirmEditPerson(id) {
    const newName = document.getElementById('edit-name-input').value.trim();
    let newGroup = document.getElementById('edit-group-select').value;
    if (newGroup === '__custom__') newGroup = document.getElementById('edit-custom-group-input').value.trim();

    if (!newName || !newGroup) return showNotification('⚠️ 姓名與組別不可為空');

    const { error } = await _supabase
        .from('personnel_control')
        .update({ name: newName, group_name: newGroup })
        .eq('id', id);

    if (error) {
        showNotification('❌ 更新失敗：' + error.message);
    } else {
        showNotification('✅ 更新成功');
        const smallModal = document.getElementById('single-edit-modal');
        if (smallModal) smallModal.remove();
        await loadDataFromSupabase();
        renderView();
        showEditPersonnelModal();
    }
}

// 🗑️ 5. 軟刪除人員
async function deleteSinglePersonnel(id, name) {
    if (!confirm(`確定要刪除 ${name} 嗎？\n(資料將會隱藏，不會完全從資料庫抹除)`)) return;
    const { error } = await _supabase
        .from('personnel_control')
        .update({ is_active: false })
        .eq('id', id);

    if (error) {
        showNotification('❌ 刪除失敗：' + error.message);
    } else {
        showNotification('✅ 刪除成功');
        await loadDataFromSupabase();
        renderView();
        showEditPersonnelModal();
    }
}

// ➕ 6. 批次新增人員 (修正照片對應邏輯)
async function confirmBatchAdd() {
    if (window.batchPersonList.length === 0) return showNotification('⚠️ 請先加入人員');
    const currentTime = getCurrentTime();

    // 組合要新增的陣列物件
    const insertPayload = window.batchPersonList.map(person => ({
        name: person.name,
        group_name: person.group_name,
        photo: `${person.name}.jpg`, // 🎯 您的正確修正：使用姓名作為照片檔名
        status: 'BoO',
        time_status: currentTime,
        time_history: `BoO ${currentTime}`,
        is_active: true // 讓他復活並顯示在面板上
    }));

    // 💥 致命除錯：將 .insert 改為 .upsert，並指定如果 name 撞名就直接覆蓋！
    const { error } = await _supabase
        .from('personnel_control')
        .upsert(insertPayload, { onConflict: 'name' }); 

    if (error) {
        showNotification(`❌ 新增失敗：${error.message}`);
        console.error('Supabase 錯誤細節:', error);
    } else {
        showNotification(`✅ 成功寫入 ${insertPayload.length} 名人員！`);
        document.getElementById('batch-add-modal').remove();
        await loadDataFromSupabase(); // 重新拉取最新資料
        renderView(); // 重繪畫面
    }
}

// 📋 7. 載入任務管理清單
async function loadMissionManagementData(type) {
    try {
        // 🎯 升級三向判斷
        let table = 'personnel_control';
        if (type === 'equipment') table = 'equipment_control';
        if (type === 'vehicle') table = 'vehicle_control';

        // 🎯 針對不同兵種，抓取正確的排序欄位 (人員/車輛用 group_name，器材用 category)
        const sortColumn = (type === 'equipment') ? 'category' : 'group_name';

        const { data: allItems, error } = await _supabase
            .from(table)
            .select('*')
            .order(sortColumn, { ascending: true })
            .order('name', { ascending: true });

        if (error) throw error;

        const processedItems = allItems.map(item => ({
            ...item,
            inMission: item.is_active === true,
            group: type === 'equipment' ? (item.category || '未分類') : (item.group_name || '未分組'),
            status: item.status || (type === 'personnel' ? 'BoO' : '在隊')
        }));

        window.missionData = {
            all: processedItems,
            current: processedItems.filter(item => item.inMission),
            type: type,
            currentTab: 'all'
        };
        renderMissionGroups();
    } catch (error) {
        console.error('載入任務管理資料失敗：', error);
        showNotification(`載入失敗：${error.message}`);
    }
}

// 📥 8. 加入面板
async function addSelectedToMission() {
    const { type } = window.missionData || { type: 'personnel' };
    const checkboxes = document.querySelectorAll('.item-checkbox:checked');
    // 【加入面板 addSelectedToMission 改為】
    const availableCheckboxes = Array.from(checkboxes).filter(cb => {
        const itemId = cb.dataset.id;
        // 使用 String() 強制轉字串比對，人員跟車輛都不會出錯
        const item = window.missionData.all.find(i => String(i.id) === String(itemId));
        return item && !item.inMission;
    });
    if (availableCheckboxes.length === 0) return showNotification('請選擇未在任務中的項目');
    const ids = availableCheckboxes.map(cb => cb.dataset.id);
    
    // 🎯 升級三向判斷
    let table = 'personnel_control';
    if (type === 'equipment') table = 'equipment_control';
    if (type === 'vehicle') table = 'vehicle_control';

    try {
        showNotification('正在將項目加入面板...');
        const { error } = await _supabase.from(table).update({ is_active: true }).in('id', ids);
        if (error) throw error;

        showNotification(`✅ 已將 ${ids.length} 個項目顯示於面板`);
        await loadDataFromSupabase();
        renderView();
        await loadMissionManagementData(type);
    } catch (error) {
        console.error('加入任務失敗：', error);
        showNotification(`加入任務失敗：${error.message}`);
    }
}

// 📤 9. 移出面板
async function removeSelectedFromMission() {
    const { type } = window.missionData || { type: 'personnel' };
    const checkboxes = document.querySelectorAll('.item-checkbox:checked');
    const currentCheckboxes = Array.from(checkboxes).filter(cb => {
        const itemId = cb.dataset.id;
        const item = window.missionData.all.find(i => String(i.id) === String(itemId));
        return item && item.inMission;
    });
    if (currentCheckboxes.length === 0) return showNotification('請選擇已在任務中的項目');
    const ids = currentCheckboxes.map(cb => cb.dataset.id);
    
    // 🎯 升級三向判斷
    let table = 'personnel_control';
    if (type === 'equipment') table = 'equipment_control';
    if (type === 'vehicle') table = 'vehicle_control';

    try {
        showNotification('正在將項目移出面板...');
        const { error } = await _supabase.from(table).update({ is_active: false }).in('id', ids);
        if (error) throw error;

        showNotification(`✅ 已將 ${ids.length} 個項目從面板隱藏`);
        await loadDataFromSupabase();
        renderView();
        await loadMissionManagementData(type);
    } catch (error) {
        console.error('移除任務失敗：', error);
        showNotification(`移除任務失敗：${error.message}`);
    }
}

// 🚪 10. 登出
async function logout() {
    await _supabase.auth.signOut();
    window.location.href = '../lobby.html';
}