// ui_render.js (負責把裝備畫到畫面上) //

// 🔥 [修改] 列表渲染 (支援圖片模式與列表模式)
function renderEquipmentList() {
    const listDiv = document.getElementById('equipment-list');
    const searchText = document.getElementById('eq-search').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;

    // 👇 👇 👇 🔥 [v4.2 新增] 橫幅 UI 顯示 👇 👇 👇
    const contentArea = document.getElementById('content-area');
    let notifBanner = document.getElementById('notif-banner');

    if (notifEqIdsArray && notifEqIdsArray.length > 0) {
        // 如果在通知模式，且橫幅還沒生出來，就做一個塞在最上面
        if (!notifBanner) {
            notifBanner = document.createElement('div');
            notifBanner.id = 'notif-banner';
            notifBanner.className = 'mb-3 bg-indigo-900/90 border border-indigo-500 text-indigo-100 px-3 py-2 rounded-lg text-sm flex justify-between items-center shadow-lg';
            contentArea.insertBefore(notifBanner, contentArea.firstChild);
        }
        notifBanner.innerHTML = `<span>🔔 正在顯示通知相關裝備</span> <button onclick="clearNotifFilter()" class="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs font-bold transition-colors shadow">清除返回</button>`;
        notifBanner.classList.remove('hidden');
    } else if (notifBanner) {
        notifBanner.classList.add('hidden');
    }


    // ... [這裡保留你原本的 filtered 過濾與 sort 排序邏輯，完全不用動] ...
    let filtered = equipmentCache.filter(eq => {

        // 🛑 核心邏輯：如果在通知過濾模式，無視其他所有條件，強制只顯示陣列裡的裝備！
        if (notifEqIdsArray && notifEqIdsArray.length > 0) {
            return notifEqIdsArray.includes(eq.id);
        }

        const matchCat = activeCats.size === 0 || activeCats.has(eq.category);
        const matchCustodian = currentCustodian === 'All' || eq.custodian === currentCustodian;
        const eqSub = (eq.sub_category || '').trim();
        const matchSubCat = activeSubCats.size === 0 || activeSubCats.has(eqSub);
        const matchLoc = activeLocs.size === 0 || activeLocs.has(eq.location);

        let matchNote = true;
        if (activeNotes.size > 0) {
            if (!eq.active_loans || eq.active_loans.length === 0) {
                matchNote = false;
            } else {
                matchNote = eq.active_loans.some(l => {
                    const noteStr = l.note ? l.note.trim() : '未分類';
                    const mappedNote = noteStr.startsWith('[維修]') ? '維修中' : noteStr;
                    return activeNotes.has(mappedNote);
                });
            }
        }

        let matchSearch = !searchText ||
            eq.name.toLowerCase().includes(searchText) ||
            (eq.model && eq.model.toLowerCase().includes(searchText));

        if (!matchSearch && eq.active_loans && eq.active_loans.length > 0) {
            matchSearch = eq.active_loans.some(l =>
                (l.borrower && l.borrower.toLowerCase().includes(searchText)) ||
                (l.note && l.note.toLowerCase().includes(searchText)) ||
                (l.note2 && l.note2.toLowerCase().includes(searchText))
            );
        }

        let matchStatus = true;
        if (statusFilter === 'Borrowed') matchStatus = eq.available_qty < eq.total_qty;
        else if (statusFilter === 'InStock') matchStatus = eq.available_qty === eq.total_qty;
        else if (statusFilter === 'Repair') matchStatus = eq.active_loans && eq.active_loans.some(l => l.note && l.note.startsWith('[維修]'));

        return matchCat && matchSubCat && matchLoc && matchSearch && matchStatus && matchNote && matchCustodian;
    });

    filtered.sort((a, b) => {
        const aRepair = a.active_loans?.some(l => l.note?.startsWith('[維修]')) ? 1 : 0;
        const bRepair = b.active_loans?.some(l => l.note?.startsWith('[維修]')) ? 1 : 0;
        if (bRepair !== aRepair) return bRepair - aRepair;
        return (a.available_qty < a.total_qty ? -1 : 1);
    });

    // 👇 👇 👇 從這裡開始是大改的部分 👇 👇 👇

    // 依據模式切換父容器的排版方式：清單是單行直下，圖片模式是兩欄網格
    if (isImageMode) {
        listDiv.className = "grid grid-cols-2 gap-3 pb-20";
    } else {
        listDiv.className = "space-y-2 pb-20 flex flex-col";
    }

    let html = '';
    filtered.forEach(eq => {
        const isFull = eq.available_qty === eq.total_qty;
        const isEmpty = eq.available_qty === 0;
        const checked = selectedItems.has(eq.id) ? 'checked' : '';

        if (isImageMode) {
            // ==========================================
            // 🖼️ 模式：圖片卡片 (自動慢速下載)
            // ==========================================
            let firstDriveId = null;
            if (eq.image) {
                const imgArray = eq.image.split('\n').map(s => s.trim()).filter(Boolean);
                if (imgArray.length > 0) firstDriveId = imgArray[0];
            }

            // 加上 loading="lazy" 讓圖片自動懶加載，並使用 Google Drive 縮圖 API (sz=s400) 省流量
            let imgHtml = firstDriveId
                ? `<img src="https://drive.google.com/thumbnail?id=${firstDriveId}&sz=s600" loading="lazy" class="w-full h-32 object-contain" alt="${eq.name}">`
                : `<div class="w-full h-32 bg-gray-700 flex flex-col items-center justify-center text-gray-500 text-xs"><span class="text-xl mb-1">📦</span>無圖片</div>`;

            // 在圖片模式下，如果開啟了批量匯出/借還，要在左上角顯示打勾框
            const checkHtmlGrid = isExportMode
                ? `<div class="absolute top-2 left-2 z-20 bg-black/60 rounded p-1 backdrop-blur-sm" onclick="event.stopPropagation()"><input type="checkbox" onchange="toggleSelect('${eq.id}')" ${checked} class="w-5 h-5 accent-purple-500"></div>`
                : '';

            const statusColor = isEmpty ? 'bg-red-500' : (isFull ? 'bg-green-500' : 'bg-blue-500');

            html += `
                    <div onclick="openDetailsModal('${eq.id}')" class="bg-gray-800 rounded-xl border border-gray-700 shadow-lg relative overflow-hidden flex flex-col active:scale-95 transition-transform">
                        ${checkHtmlGrid}
                        <div class="absolute top-2 right-2 w-3 h-3 rounded-full ${statusColor} shadow-md border border-gray-900 z-10"></div>
                        <div class="w-full h-32 relative bg-black shrink-0">
                            ${imgHtml}
                        </div>
                        <div class="p-2 flex-1 flex flex-col justify-between">
                            <h3 class="font-bold text-white text-sm line-clamp-1">${eq.name}</h3>
                            <div class="text-xs text-gray-400 mt-1 flex justify-between items-center">
                                <span class="line-clamp-1 mr-1">${eq.sub_category || '-'}</span>
                                <span class="${isFull ? 'text-green-400' : (isEmpty ? 'text-red-400' : 'text-blue-400')} font-bold">${eq.available_qty}/${eq.total_qty}</span>
                            </div>
                        </div>
                    </div>`;

        } else {
            // ==========================================
            // 📄 模式：原本的詳細清單
            // ==========================================
            const statusBadge = isFull ? `<span class="text-green-400 font-bold text-sm">🟢 在隊 (${eq.available_qty})</span>`
                : (isEmpty ? `<span class="text-red-400 font-bold text-sm">🔴 全部借出</span>`
                    : `<span class="text-blue-400 font-bold text-sm">🔵 部分借出 (${eq.available_qty}/${eq.total_qty})</span>`);

            let loansHtml = '';
            let toggleBtnHtml = '';
            const detailsBtnHtml = `<button onclick="openDetailsModal('${eq.id}')" class="bg-indigo-900/60 hover:bg-indigo-800 text-indigo-300 px-3 py-1 rounded text-xs font-bold border border-indigo-700/50">📄 詳細</button>`;

            if (eq.active_loans && eq.active_loans.length > 0) {
                toggleBtnHtml = `
                            <div class="flex gap-2 mt-2">
                                ${detailsBtnHtml}
                                <button onclick="toggleLoanList('${eq.id}', this, ${eq.active_loans.length})" class="bg-gray-700 hover:bg-gray-600 text-blue-300 px-3 py-1 rounded text-xs font-bold border border-gray-600">名單 (${eq.active_loans.length})</button>
                            </div>`;

                loansHtml = `<div id="loan-list-${eq.id}" class="hidden mt-2 pt-2 border-t border-gray-600 space-y-1">`;
                eq.active_loans.forEach(l => {
                    const returnBtn = isUserAdmin ? `<button onclick="openSingleReturnModal('${eq.id}', '${l.loan_id}', ${l.qty}, '${l.borrower}')" class="bg-green-700 text-white px-2 py-1 rounded text-[10px]">歸還</button>` : '';

                    const isRepair = l.note && l.note.startsWith('[維修]');
                    let displayHtml = '';

                    if (isRepair) {
                        const reason = l.note.replace('[維修]', '').trim();
                        displayHtml = `<span class="text-orange-400 font-bold">🔧 維修中 <span class="text-yellow-400">x${l.qty}</span></span> <span class="text-gray-400">(${l.borrower})</span> <span class="text-orange-300 text-xs">原因: ${reason}</span>`;
                    } else {
                        const note2Html = l.note2 ? ` <span class="text-fuchsia-300 text-[11px] bg-fuchsia-900/40 px-1 rounded border border-fuchsia-800">${l.note2}</span>` : '';
                        displayHtml = `<span>👤 ${l.borrower} <span class="text-yellow-400">x${l.qty}</span>${note2Html} <span class="text-blue-300 ml-1">${l.note ? `#${l.note}` : ''}</span></span>`;
                    }
                    loansHtml += `<div class="flex justify-between items-center text-xs text-gray-300">${displayHtml}${returnBtn}</div>`;
                });
                loansHtml += `</div>`;
            } else {
                toggleBtnHtml = `<div class="flex gap-2 mt-2">${detailsBtnHtml}</div>`;
            }

            const checkHtml = isExportMode ? `<div class="mr-3 flex items-center"><input type="checkbox" onchange="toggleSelect('${eq.id}')" ${checked} class="w-6 h-6"></div>` : '';
            const repairBtn = (!isEmpty && isUserAdmin) ? `<button onclick="openRepairModal('${eq.id}', '${displayName}')" class="bg-orange-600 text-white px-3 py-1 rounded text-xs font-bold ml-2">報修</button>` : '';
            const borrowBtn = (!isEmpty && isUserAdmin) ? `<button onclick="openSingleBorrowModal('${eq.id}')" class="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold">借出</button>` : '';
            const editBtn = isUserAdmin ? `<button onclick="openEditModal('update', '${eq.id}')" class="text-gray-500 p-1">⚙️</button>` : '';
            // [準備標籤]
            const propBadge = eq.property_number ? `<div class="text-yellow-400 font-mono text-sm mt-1 font-bold"># ${eq.property_number}</div>` : '';
            const subCatBadge = eq.sub_category ? `<span class="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded ml-2">${eq.sub_category}</span>` : '';
            const custodianBadge = eq.custodian ? `<span class="bg-indigo-900/50 text-indigo-300 px-2 py-1 rounded border border-indigo-700 text-xs">🛡️保管: ${eq.custodian}</span>` : '';

            // [開始組裝卡片]
            html += `
            <div class="flex items-start bg-gray-800 p-4 rounded-lg mb-3 border-l-4 ${isEmpty ? "border-red-500" : (isFull ? "border-green-500" : "border-blue-500")}">
                ${checkHtml}
                <div class="flex-1">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <h3 class="font-bold text-white text-lg flex items-center flex-wrap gap-1">
                                ${eq.name} ${subCatBadge}
                            </h3>
                            
                            ${propBadge}
                            
                            <div class="flex gap-3 text-xs text-gray-400 mt-1.5 flex-wrap items-center">
                                <span class="bg-gray-700/50 px-1.5 py-0.5 rounded">${eq.model || '無規格'}</span>
                                <span class="flex items-center gap-0.5">📍${eq.location || '-'}</span>
                            </div>
                        </div>
                        
                        <div class="flex gap-2 shrink-0 ml-2">
                            <button onclick="fetchItemHistory('${eq.id}')" class="text-blue-400 p-1 active:scale-90 transition-transform">📜</button>
                            ${editBtn}
                        </div>
                    </div>

                    <div class="flex justify-between items-end mt-4 pt-3 border-t border-gray-700/50">
                        
                        <div class="flex flex-col gap-2">
                            ${statusBadge}
                            ${custodianBadge}
                        </div>
                        
                        <div class="flex flex-col items-end gap-2">
                            <div class="flex gap-1">${borrowBtn}${repairBtn}</div>
                            ${toggleBtnHtml}
                        </div>
                    </div>
                    
                    ${loansHtml}
                </div>
            </div>`;
        }
    });

    // 如果列表是空的，根據模式顯示置中的空提示
    listDiv.innerHTML = html || `<div class="${isImageMode ? 'col-span-2' : ''} text-center text-gray-500 py-10"><span class="text-2xl block mb-2">📭</span>無符合裝備</div>`;
    updateExportCount();
}

// 🔥 [新增] 切換圖文卡片與列表模式
function toggleImageDisplayMode() {
    isImageMode = !isImageMode;
    const btn = document.getElementById('toggle-image-mode-btn');

    // 改變按鈕的外觀與圖示，讓使用者知道狀態改變了
    if (isImageMode) {
        btn.classList.replace('text-purple-400', 'text-yellow-400');
        btn.classList.replace('border-purple-400', 'border-yellow-400');
        btn.innerText = '📄'; // 變成列表圖示
    } else {
        btn.classList.replace('text-yellow-400', 'text-purple-400');
        btn.classList.replace('border-yellow-400', 'border-purple-400');
        btn.innerText = '🖼️'; // 變成圖片圖示
    }

    // 重新渲染畫面
    renderEquipmentList();
}


// 🔥 [新增] 切換顯示借出名單
function toggleLoanList(id, btn, count) {
    const list = document.getElementById(`loan-list-${id}`);
    if (list.classList.contains('hidden')) {
        // 展開
        list.classList.remove('hidden');
        btn.innerHTML = '隱藏';
        btn.classList.replace('text-blue-300', 'text-gray-400');
    } else {
        // 收合
        list.classList.add('hidden');
        btn.innerHTML = `名單 (${count})`;
        btn.classList.replace('text-gray-400', 'text-blue-300');
    }
}
