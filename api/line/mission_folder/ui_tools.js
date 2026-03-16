// ui_tools.js (負責介面小工具與特效) //
// 🔥 切換篩選面板展開/收合
function toggleFilterPanel() {
    const panel = document.getElementById('collapsible-filters');
    const btn = document.getElementById('btn-toggle-filter');
    const icon = btn.querySelector('span');

    // 判斷目前是用 max-height 控制還是 class hidden
    // 這裡我們用 style.maxHeight 來做動畫效果
    if (panel.style.maxHeight === '0px') {
        // 展開
        panel.style.maxHeight = '500px'; // 足夠大的高度
        panel.style.opacity = '1';
        btn.innerHTML = '<span>▼</span> 收合';
        btn.classList.add('text-yellow-400', 'border-yellow-600');
        btn.classList.remove('text-gray-400', 'border-gray-600');
    } else {
        // 收合
        panel.style.maxHeight = '0px';
        panel.style.opacity = '0';
        btn.innerHTML = '<span>🔍</span>'; // 收起來時變成搜尋圖示
        btn.classList.remove('text-yellow-400', 'border-yellow-600');
        btn.classList.add('text-gray-400', 'border-gray-600');
    }
}

// 🔥 將滑鼠拖曳封裝成函數，支援動態生成的 UI
function attachDragToElements() {
    const sliders = document.querySelectorAll('.filter-row');
    sliders.forEach(slider => {
        if (slider.dataset.dragAttached) return; // 避免重複綁定
        slider.dataset.dragAttached = 'true';

        let isDown = false; let startX; let scrollLeft;
        slider.addEventListener('mousedown', (e) => { isDown = true; slider.classList.add('active'); startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; });
        slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('active'); });
        slider.addEventListener('mouseup', () => { isDown = false; slider.classList.remove('active'); });
        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const walk = (e.pageX - slider.offsetLeft - startX) * 2;
            slider.scrollLeft = scrollLeft - walk;
        });
    });
}

// 其他工具
function toggleExportMode() { isExportMode = !isExportMode; document.getElementById('export-toolbar').classList.toggle('hidden'); document.getElementById('btn-export-mode').innerText = isExportMode ? "❌ 取消" : "批量/匯出"; renderEquipmentList(); }
function toggleSelect(id) { if (selectedItems.has(id)) selectedItems.delete(id); else selectedItems.add(id); updateExportCount(); }
function toggleSelectAll() { const ids = Array.from(document.querySelectorAll('#equipment-list input[type="checkbox"]')).map(c => c.getAttribute('onchange').match(/'([^']+)'/)[1]); if (ids.every(id => selectedItems.has(id))) ids.forEach(id => selectedItems.delete(id)); else ids.forEach(id => selectedItems.add(id)); renderEquipmentList(); updateExportCount(); }
function updateExportCount() { document.getElementById('export-count').innerText = selectedItems.size; }
