/**
 * 檔案：mission_folder/task.js
 * 用途：負責「任務回報」與「任務看板」的邏輯
 * 依賴：主程式必須提供 userId, callGasApi, toggleLoader
 */

// ============================================
// 🔥 1. 任務回報 (完整版：保留梯次、備註)
// ============================================
async function showReportPage() {
    document.getElementById('view-equipment')?.classList.add('hidden');
    document.getElementById('view-query')?.classList.add('hidden');
    document.getElementById('view-ai')?.classList.add('hidden');
    document.getElementById('view-report')?.classList.remove('hidden');

    toggleLoader(true, "同步任務中...");
    try {
        const data = await callGasApi({ action: 'get_my_assignments', userId: userId });
        const listDiv = document.getElementById('report-list');
        listDiv.innerHTML = "";
        if (!data || data.length === 0) {
            listDiv.innerHTML = "<p class='text-center text-gray-500'>💤 無任務</p>";
        } else {
            data.forEach(task => {
                const div = document.createElement('div');
                div.className = "card";
                div.innerHTML = `
                    <h3 class="font-bold text-lg">${task.mission_title}</h3>
                    <p class="text-sm text-gray-300 mb-2">
                        梯次: <span class="text-yellow-400">${task.batch_no || '未定'}</span> 
                        ${task.assignment_note ? `| 備註: ${task.assignment_note}` : ''}
                    </p>
                    <input type="text" id="note-${task.assignment_id}" class="input-dark mb-2" placeholder="輸入回報內容 (例如: 抵達)">
                    <div class="flex gap-2">
                        <button onclick="submitReport(${task.assignment_id}, '${task.mission_id}', false)" class="btn btn-blue flex-1">僅回報</button>
                        <button onclick="submitReport(${task.assignment_id}, '${task.mission_id}', true)" class="btn btn-green flex-1">任務完成</button>
                    </div>
                `;
                listDiv.appendChild(div);
            });
        }
    } catch (e) { alert("錯誤: " + e.message); } finally { toggleLoader(false); }
}

async function submitReport(aid, mid, fin) {
    const note = document.getElementById(`note-${aid}`).value;
    const msg = fin ? "確定回報任務完成嗎？" : "確定回報進度嗎？";
    if (!confirm(msg)) return;
    
    toggleLoader(true, "回報傳送中...");
    try {
        await callGasApi({action:'submit_report', userId:userId, assignmentId:aid, missionId:mid, isFinished:fin, note:note || (fin ? '任務完成' : '')});
        alert("成功"); 
        
        // 🔥 雙棲判斷：如果在 LINE 裡面就關閉視窗，如果在 App 裡面就重新整理任務列表
        if (typeof liff !== 'undefined' && liff.isInClient()) {
            liff.closeWindow();
        } else {
            showReportPage(); 
        }
        
    } catch (e) { 
        alert("失敗: " + e.message); 
    } finally { 
        toggleLoader(false); 
    }
}

// ============================================
// 🔥 2. 任務看板 (完整版：保留展開、日誌、折疊)
// ============================================
async function showQueryPage() {
    document.getElementById('view-equipment')?.classList.add('hidden');
    document.getElementById('view-report')?.classList.add('hidden');
    document.getElementById('view-ai')?.classList.add('hidden');
    document.getElementById('view-query')?.classList.remove('hidden');

    toggleLoader(true, "連線戰情中心...");
    try {
        const data = await callGasApi({ action: 'get_public_missions', userId: userId });
        const listDiv = document.getElementById('query-list');
        listDiv.innerHTML = "";

        if (!data || data.length === 0) {
            listDiv.innerHTML = "<p class='text-center text-gray-500 mt-4'>📭 無進行中任務</p>";
        } else {
            data.forEach(task => {
                const cardId = `mission-${Math.random().toString(36).substr(2, 9)}`;
                const summaryId = `summary-${cardId}`;
                
                // 處理回報日誌
                let logsHtml = '';
                if (task.progress_logs && task.progress_logs.length > 0) {
                    logsHtml = `<div class="mt-3 pt-3 border-t border-gray-600">
                        <p class="text-xs text-gray-400 mb-2">📡 現場回報日誌 (最新在上)</p>
                        <div class="space-y-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar">`;
                    task.progress_logs.forEach(log => {
                        let statusColor = "text-gray-400";
                        if (log.status === '已完成') statusColor = "text-green-400";
                        else if (log.status === '進行中') statusColor = "text-blue-400";
                        
                        const batchInfo = log.batch_num !== '未知' ? `<span class="bg-gray-600 px-1 rounded ml-2">第${log.batch_num}梯</span>` : '';

                        logsHtml += `
                            <div class="p-2 bg-gray-700 rounded-md text-sm border-l-4 border-gray-500">
                                <div class="flex justify-between items-center mb-1">
                                    <div class="flex items-center">
                                        <span class="font-bold ${statusColor}">${log.status}</span>
                                        <span class="text-[10px] text-gray-400 ml-2">${log.time_str}</span>
                                        ${batchInfo}
                                    </div>
                                </div>
                                <div class="text-gray-200">${log.note}</div>
                                <div class="text-xs text-gray-400 text-right mt-1">回報人: ${log.reporter_name}</div>
                            </div>`;
                    });
                    logsHtml += `</div></div>`;
                } else {
                    logsHtml = `<div class="mt-3 pt-2 border-t border-gray-600 text-center text-xs text-gray-500">(尚無回報紀錄)</div>`;
                }

                // 建立完整看板卡片
                const div = document.createElement('div');
                div.className = "card";
                div.style.borderLeftColor = "#2196F3"; // 藍色邊框
                div.innerHTML = `
                    <div onclick="toggleDetail('${cardId}')" class="flex justify-between items-center cursor-pointer select-none">
                        <div class="flex-1">
                            <h3 class="font-bold text-lg text-white">${task.title}</h3>
                            <p class="text-sm text-gray-400">🕒 啟動: ${task.start_time ? task.start_time.replace('T', ' ').substring(0, 16) : '時間未定'}</p>
                        </div>
                        <div class="text-2xl text-gray-500 transition-transform duration-300" id="icon-${cardId}">▼</div>
                    </div>
                    <div id="${cardId}" class="mission-detail mt-0">
                        <div class="p-3 bg-gray-800 rounded-b-lg">
                            <div class="text-sm text-gray-400 mb-2">
                                <span class="block mb-1 font-bold text-gray-500">📝 任務摘要:</span>
                                <div id="${summaryId}" class="text-gray-300 bg-gray-900 p-2 rounded text-xs leading-relaxed line-clamp-3">
                                    ${task.description || "尚無詳細描述"}
                                </div>
                                <button onclick="toggleSummary('${summaryId}', this)" class="text-blue-400 text-xs mt-1 w-full text-center hover:text-blue-300 focus:outline-none py-1">
                                    展開全文 ▼
                                </button>
                            </div>
                            ${logsHtml}
                        </div>
                    </div>`;
                listDiv.appendChild(div);
            });
        }
    } catch (e) { alert("讀取失敗: " + e.message); } finally { toggleLoader(false); }
}

// UI 互動邏輯 (折疊/展開)
function toggleSummary(id, btn) {
    event.stopPropagation();
    const el = document.getElementById(id);
    if (el.classList.contains('line-clamp-3')) {
        el.classList.remove('line-clamp-3');
        btn.innerText = "收合摘要 ▲";
    } else {
        el.classList.add('line-clamp-3');
        btn.innerText = "展開全文 ▼";
    }
}

function toggleDetail(id) {
    const el = document.getElementById(id);
    const icon = document.getElementById(`icon-${id}`);
    if (el.classList.contains('open')) {
        el.classList.remove('open');
        icon.style.transform = "rotate(0deg)";
    } else {
        document.querySelectorAll('.mission-detail.open').forEach(d => {
            d.classList.remove('open');
            const otherIcon = document.getElementById(`icon-${d.id}`);
            if(otherIcon) otherIcon.style.transform = "rotate(0deg)";
        });
        el.classList.add('open');
        icon.style.transform = "rotate(180deg)";
    }
}
