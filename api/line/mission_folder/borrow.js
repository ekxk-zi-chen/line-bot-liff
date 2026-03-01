// ==========================================
// borrow.js - 裝備借出與報修模組 (v3.9 共用版)
// ==========================================

function toggleBorrowMode() {
    const mode = document.querySelector('input[name="borrow_mode"]:checked').value;
    if (mode === 'borrow') {
        document.getElementById('borrow-fields').classList.remove('hidden');
        document.getElementById('borrow-fields').classList.add('flex');
        document.getElementById('repair-fields').classList.add('hidden');
    } else {
        document.getElementById('borrow-fields').classList.add('hidden');
        document.getElementById('borrow-fields').classList.remove('flex');
        document.getElementById('repair-fields').classList.remove('hidden');
    }
}

function openSingleBorrowModal(id) { 
    selectedItems.clear(); 
    selectedItems.add(id); 
    openBatchBorrowModal(); 
}

function openBatchBorrowModal() {
    if (selectedItems.size === 0) { alert("請先勾選裝備"); return; }
    document.getElementById('batch-borrow-modal').classList.add('flex');
    document.getElementById('batch-borrow-modal').classList.remove('hidden');
    document.querySelector('input[name="borrow_mode"][value="borrow"]').checked = true;
    toggleBorrowMode(); 

    const tbody = document.getElementById('batch-borrow-list'); tbody.innerHTML = "";
    selectedItems.forEach(id => {
        const eq = equipmentCache.find(e => e.id === id);
        if (eq && eq.available_qty > 0) {
            tbody.innerHTML += `<tr class="border-b border-gray-700"><td class="px-2 py-2 text-white">${eq.name}</td><td class="text-center text-gray-400">${eq.available_qty}</td><td class="text-center"><input type="number" data-id="${eq.id}" data-name="${eq.name}" class="borrow-qty-input w-16 bg-gray-700 text-white p-1 rounded border border-gray-600 text-center" value="1" min="0" max="${eq.available_qty}"></td></tr>`;
        }
    });
    renderBorrowQueue();
}

function hideBorrowModal() {
    document.getElementById('batch-borrow-modal').classList.add('hidden');
    document.getElementById('batch-borrow-modal').classList.remove('flex');
}

function cancelBatchBorrow() {
    pendingBorrowRequests = [];  
    selectedItems.clear();       
    renderEquipmentList();       
    hideBorrowModal();           
}

function addToBorrowQueue() {
    const borrower = document.getElementById('batch-borrower').value;
    if (!borrower) { alert("請輸入借用人 / 經手人"); return; }

    const mode = document.querySelector('input[name="borrow_mode"]:checked').value;
    let finalNote = "", finalNote2 = "";

    if (mode === 'borrow') {
        finalNote = document.getElementById('batch-note').value;
        finalNote2 = document.getElementById('batch-note2').value;
    } else {
        const repairReason = document.getElementById('batch-repair-note').value;
        if (!repairReason) { alert("請輸入維修原因"); return; }
        finalNote = "[維修] " + repairReason;
        finalNote2 = ""; 
    }

    const inputs = document.querySelectorAll('.borrow-qty-input');
    const tempQueue = [];

    for (let input of inputs) {
        const qty = parseInt(input.value);
        if (qty > 0) {
            const maxQty = parseInt(input.max);
            const eqId = input.dataset.id;
            const eqName = input.dataset.name;

            const queuedQty = pendingBorrowRequests.filter(req => req.eqId === eqId).reduce((sum, req) => sum + req.qty, 0);
            if (queuedQty + qty > maxQty) {
                alert(`【${eqName}】庫存不足！\n剩餘: ${maxQty}\n已排入名單: ${queuedQty}\n本次欲借: ${qty}`);
                return; 
            }
            tempQueue.push({ eqId, eqName, borrower, qty, note: finalNote, note2: finalNote2 });
        }
    }

    if (tempQueue.length === 0) return alert("請確認借用數量");
    pendingBorrowRequests.push(...tempQueue);
    renderBorrowQueue();
    document.getElementById('batch-borrower').value = "";
    document.getElementById('batch-borrower').focus();
}

function renderBorrowQueue() {
    const area = document.getElementById('borrow-queue-area');
    const list = document.getElementById('borrow-queue-list');
    list.innerHTML = "";

    if (pendingBorrowRequests.length === 0) { area.classList.add('hidden'); return; }
    area.classList.remove('hidden');
    
    pendingBorrowRequests.forEach((req, index) => {
        const n1 = req.note ? `<span class="text-blue-300 ml-1">#${req.note}</span>` : '';
        const n2 = req.note2 ? `<span class="text-fuchsia-300 ml-1 bg-fuchsia-900/40 px-1 rounded">補:${req.note2}</span>` : '';
        list.innerHTML += `
            <div class="flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700 text-sm">
                <div class="flex-1 line-clamp-1">
                    <span class="text-white font-bold">${req.borrower}</span>
                    <span class="text-gray-400 text-xs ml-1">借 ${req.eqName} <span class="text-yellow-400 font-bold">x${req.qty}</span></span>
                    ${n1}${n2}
                </div>
                <button onclick="removeFromBorrowQueue(${index})" class="text-red-400 px-2 ml-2 bg-gray-700 hover:bg-gray-600 rounded">✕</button>
            </div>`;
    });
}

function removeFromBorrowQueue(index) {
    pendingBorrowRequests.splice(index, 1);
    renderBorrowQueue();
}

// 🔥 核心修改：打包並送給統一介面卡
async function submitBatchBorrow() {
    const borrower = document.getElementById('batch-borrower').value;
    if (borrower) addToBorrowQueue();
    if (pendingBorrowRequests.length === 0) return alert("請輸入借用人或加入名單");

    const requestPayload = {
        action: 'batch_borrow_equipment',
        userId: userId,
        displayName: displayName,
        items: pendingBorrowRequests 
    };

    toggleLoader(true, "批量打包送出中..."); 
    closeModal('batch-borrow-modal');
    try { 
        await window.submitToBackend(requestPayload); // 呼叫介面卡
        alert("送出成功！"); 
        pendingBorrowRequests = []; 
        selectedItems.clear(); 
        if(typeof isExportMode !== 'undefined' && isExportMode) toggleExportMode(); 
        if(typeof fetchEquipmentData === 'function') fetchEquipmentData(false); 
    } catch (e) { 
        alert(e.message); 
    } finally { 
        toggleLoader(false); 
    }
}

function openRepairModal(id, currentUser) {
    const eq = equipmentCache.find(e => e.id === id);
    if (!eq) return;
    document.getElementById('repair-modal').classList.add('flex');
    document.getElementById('repair-eq-id').value = id;
    document.getElementById('repair-user').value = currentUser;
    document.getElementById('repair-reason').value = "";
    document.getElementById('repair-qty').value = 1;
    document.getElementById('repair-qty').max = eq.available_qty;
}

async function submitRepair() {
    const id = document.getElementById('repair-eq-id').value;
    const user = document.getElementById('repair-user').value;
    const reason = document.getElementById('repair-reason').value;
    const qty = document.getElementById('repair-qty').value;
    if (!reason) return alert("請輸入維修原因");
    
    toggleLoader(true);
    closeModal('repair-modal');
    try {
        await window.submitToBackend({ // 呼叫介面卡
            action: 'borrow_equipment', userId, displayName,
            eqId: id, borrower: user, qty: qty, note: `[維修] ${reason}`
        });
        alert("報修成功");
        if(typeof fetchEquipmentData === 'function') fetchEquipmentData(false);
    } catch (e) { alert(e.message); } finally { toggleLoader(false); }
}
