// ui_filter.js (負責膠囊按鈕、篩選條件邏輯) //
// 🔥 [修改] 切換保管人過濾，並自動幫他「多選」對應的分類與細項
function switchCustodian(c) {
    currentCustodian = c;

    // 先清空目前的分類與細項選擇
    activeCats.clear();
    activeSubCats.clear();

    if (c !== 'All') {
        // 找出這個人保管的所有裝備
        const myEqs = equipmentCache.filter(e => e.custodian === c);
        // 把對應的大分類與細項塞進「已選集合」中
        myEqs.forEach(eq => {
            if (eq.category) activeCats.add(eq.category);
            // 🔥 關鍵：把空字串(沒有細項)也視為一種狀態加入集合
            const sub = (eq.sub_category || '').trim();
            activeSubCats.add(sub);
        });
    }

    renderDatalists();
    renderEquipmentList();
}


// 🔥 [修正] 統一管理下拉選單 (已移除舊的分類渲染邏輯，改呼叫新函數)
function renderDatalists() {
    const cats = new Set(equipmentCache.map(e => e.category));
    const subcats = new Set(equipmentCache.map(e => e.sub_category || ''));
    const locs = new Set(equipmentCache.map(e => e.location));
    const custodians = new Set(equipmentCache.map(e => e.custodian).filter(Boolean)); // 🔥 抓取有值的保管人

    const notes = new Set(['雪訓', '繩索訓練', '動員訓練', '山域搜救']);
    equipmentCache.forEach(e => e.active_loans?.forEach(l => { if (l.note) notes.add(l.note) }));

    // 處理暫存區資料
    pendingBatchItems.forEach(i => {
        if (i.category) cats.add(i.category);
        if (i.subCategory) subcats.add(i.subCategory);
        if (i.location) locs.add(i.location);
    });

    // ❌ [移除] 這裡原本有一段「渲染上方分類按鈕」的舊程式碼，把它刪掉了！
    // ❌ 不要再手寫 innerHTML = html 了

    // ✅ [新增] 直接呼叫我們寫好的漂亮 UI 函數
    renderCategoryUI();

    // 渲染 Datalist (輸入框的下拉選單) - 這邊維持原樣
    document.getElementById('category-options').innerHTML = [...cats].map(c => `<option value="${c}">`).join('');
    document.getElementById('subcategory-options').innerHTML = [...subcats].map(s => `<option value="${s}">`).join('');
    document.getElementById('location-options').innerHTML = [...locs].sort().map(l => `<option value="${l}">`).join('');
    document.getElementById('note-suggestions').innerHTML = [...notes].sort().map(n => `<option value="${n}">`).join('');
    // 塞進 Datalist
    document.getElementById('custodian-options').innerHTML = [...custodians].sort().map(c => `<option value="${c}">`).join('');

    renderSubCategoryUI();
    renderLocationUI();
    renderNoteUI();

    // 🔥 [新增] 渲染頂部保管人下拉選單
    const custodianSelect = document.getElementById('custodian-filter');
    let custHtml = `<option value="All">所有🛡️</option>`;
    Array.from(custodians).sort().forEach(c => custHtml += `<option value="${c}">${c}</option>`);
    custodianSelect.innerHTML = custHtml;
    if (currentCustodian) custodianSelect.value = currentCustodian; // 保持選擇狀態不跑掉

    attachDragToElements();
}

// 🔥 1. 大分類渲染 (解決電腦版無法拖曳的問題)
function renderCategoryUI() {
    const container = document.getElementById('category-filter-container');
    if (!container) return;
    const categories = ['All', ...new Set(equipmentCache.map(e => e.category))];

    container.className = "";
    container.style.border = "3px solid #F59E0B";
    container.style.backgroundColor = "#1F2937";
    container.style.borderRadius = "12px";
    container.style.padding = "15px";
    container.style.marginBottom = "20px";
    container.style.boxShadow = "0 4px 6px rgba(0,0,0,0.3)";

    // 🔥 關鍵修復：在內層 div 加上 filter-row 類別，即可支援滑鼠拖曳
    let html = `
                <div style="margin-bottom: 10px; color: #FBBF24; font-weight: bold; font-size: 1.1rem; border-bottom: 1px solid #4B5563; padding-bottom: 5px;">
                    ⚡ 選擇分類 <span style="font-size: 0.8rem; color: #9CA3AF; font-weight: normal;">(大分類)</span>
                </div>
                <div class="flex gap-3 overflow-x-auto pb-2 custom-scrollbar filter-row" style="scrollbar-width: none; cursor: grab;">
            `;

    categories.forEach(cat => {
        const isActive = (cat === 'All' && activeCats.size === 0) || activeCats.has(cat);
        const btnStyle = isActive
            ? "background-color: #F59E0B; color: black; font-weight: 800; border: 2px solid #F59E0B; transform: scale(1.05);"
            : "background-color: transparent; color: white; border: 1px solid #6B7280;";
        const label = cat === 'All' ? '全部顯示' : cat;
        html += `<button onclick="switchCategory('${cat}')" style="padding: 8px 16px; border-radius: 9999px; white-space: nowrap; transition: all 0.2s; ${btnStyle}">${label}</button>`;
    });
    html += `</div>`;
    container.innerHTML = html;
}

// 🔥 2. 細項渲染 (支援多選樣式)
function renderSubCategoryUI() {
    const container = document.getElementById('subcategory-filter-container');
    const subcats = new Set();
    const sourceData = activeCats.size === 0 ? equipmentCache : equipmentCache.filter(e => activeCats.has(e.category));
    sourceData.forEach(e => { if (e.sub_category) subcats.add(e.sub_category); });

    if (subcats.size === 0) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');

    let html = `<button onclick="switchSubCategory('All')" class="btn-chip ${(activeSubCats.size === 0 || activeSubCats.has('')) ? 'active' : ''}">全部細項</button>`;
    Array.from(subcats).sort().forEach(sc => {
        html += `<button onclick="switchSubCategory('${sc}')" class="btn-chip ${activeSubCats.has(sc) ? 'active' : ''}">${sc}</button>`;
    });
    container.innerHTML = html;
}

// 🔥 3. 位置渲染 (智慧連動：只顯示選中細項有的位置)
function renderLocationUI() {
    const container = document.getElementById('location-filter-container');
    const locs = new Set();

    let sourceData = activeCats.size === 0 ? equipmentCache : equipmentCache.filter(e => activeCats.has(e.category));
    if (activeSubCats.size > 0) sourceData = sourceData.filter(e => activeSubCats.has(e.sub_category || '')); // 瀑布流連動

    sourceData.forEach(e => { if (e.location) locs.add(e.location); });
    if (locs.size === 0) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');

    let html = `<button onclick="switchLocation('All')" class="btn-chip ${activeLocs.size === 0 ? 'active' : ''}">全部位置</button>`;
    Array.from(locs).sort().forEach(loc => {
        html += `<button onclick="switchLocation('${loc}')" class="btn-chip ${activeLocs.has(loc) ? 'active' : ''}">${loc}</button>`;
    });
    container.innerHTML = html;
}


// 🔥 4. 用途渲染 (終極智慧連動：只顯示目前過濾下的用途)
function renderNoteUI() {
    const container = document.getElementById('note-filter-container');
    const notes = new Set();

    let sourceData = activeCats.size === 0 ? equipmentCache : equipmentCache.filter(e => activeCats.has(e.category));
    if (activeSubCats.size > 0) sourceData = sourceData.filter(e => activeSubCats.has(e.sub_category || '')); // 瀑布流連動
    if (activeLocs.size > 0) sourceData = sourceData.filter(e => activeLocs.has(e.location)); // 瀑布流連動

    sourceData.forEach(e => {
        if (e.active_loans) {
            e.active_loans.forEach(l => {
                const note = l.note ? l.note.trim() : '未分類';
                if (note.startsWith('[維修]')) notes.add('維修中');
                else notes.add(note);
            });
        }
    });

    // 清理：如果已經不存在該用途，自動從選中名單中移除
    for (let n of activeNotes) { if (!notes.has(n)) activeNotes.delete(n); }

    if (notes.size === 0) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');

    let html = `<button onclick="switchNote('All')" class="btn-chip ${activeNotes.size === 0 ? 'active' : ''}">全部用途</button>`;
    const sortedNotes = Array.from(notes).sort((a, b) => {
        if (a === '維修中') return -1; if (b === '維修中') return 1; return a.localeCompare(b);
    });
    sortedNotes.forEach(n => {
        html += `<button onclick="switchNote('${n}')" class="btn-chip ${activeNotes.has(n) ? 'active' : ''}">${n}</button>`;
    });
    container.innerHTML = html;
}

// 🔥 [修改] 切換大分類 (升級為多選，且不清空底下的狀態，保留保管人連動)
function switchCategory(c) {
    if (c === 'All') {
        activeCats.clear(); // 點「全部顯示」就清空所有大分類條件
    } else {
        // 點擊切換：有就刪掉，沒有就加進去
        activeCats.has(c) ? activeCats.delete(c) : activeCats.add(c);
    }
    renderDatalists();
    renderEquipmentList();
}

// 🔥 切換細項 (多選)
function switchSubCategory(sc) {
    if (sc === 'All') activeSubCats.clear();
    else activeSubCats.has(sc) ? activeSubCats.delete(sc) : activeSubCats.add(sc);
    renderDatalists(); // 刷新 UI 讓它反黃，並連動下方
    renderEquipmentList();
}

// 🔥 切換位置 (多選)
function switchLocation(loc) {
    if (loc === 'All') activeLocs.clear();
    else activeLocs.has(loc) ? activeLocs.delete(loc) : activeLocs.add(loc);
    renderDatalists();
    renderEquipmentList();
}

// 🔥 切換用途 (多選，且不自動收合面板)
function switchNote(n) {
    if (n === 'All') activeNotes.clear();
    else activeNotes.has(n) ? activeNotes.delete(n) : activeNotes.add(n);
    renderDatalists();
    renderEquipmentList();
}
