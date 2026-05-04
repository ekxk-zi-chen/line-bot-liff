// personnel_tour.js

// =========================================
// 🎮 人員管制系統 - 專屬新手教學 (Driver.js)
// =========================================
function startPersonnelTutorial() {
    const driver = window.driver.js.driver;
    const tourGuide = driver({
        showProgress: true,
        allowClose: true,        
        overlayClickable: false, 
        doneBtnText: '完成教學',
        closeBtnText: '跳過',    
        nextBtnText: '下一步 ➔',
        prevBtnText: '⬅ 上一步',
        steps: [
            {
                element: "#btn-help-personnel", // 指向右上角的❓按鈕
                popover: {
                    title: '👥 人員與器材管制中心',
                    description: '各位戰友，這是人員管制教學導覽，如不小心跳過可至左上角❓按鈕再次開啟！',
                    side: "bottom", align: 'center'
                }
            },
            {
                element: "#settings-fab", // 節能開關按鈕
                popover: {
                    title: '✨ 節能開關',
                    description: '取消背景光條！',
                    side: "bottom", align: 'start'
                }
            },
            {
                element: '.view-switcher', // 指向四大分頁切換區
                popover: {
                    title: '🔄 模組切換區',
                    description: '在這裡可以快速切換<span class="bg-yellow-text-red">人員、器材、車輛</span><br>以及&nbsp&nbsp<span class="bg-yellow-text-red">緊急撤離</span>&nbsp&nbsp的管制面板',
                    side: "bottom", align: 'center'
                }
            },
            {
                element: '.stats-container', // 指向頂部大數字儀表板
                popover: {
                    title: '📊 即時戰力儀表板',
                    description: '隨時掌握在隊與外出人數。<span class="text-highlight-blue">點擊數字卡片</span>，還能直接展開該狀態的「完整人員名單」！',
                    side: "bottom", align: 'center'
                }
            },
            {
                element: 'button[onclick="showGroupControl()"]', // 指向群組控制按鈕
                popover: {
                    title: '🎯 分組別控制出入',
                    description: '需要讓整個小隊一起出勤嗎？點擊這裡可以對<span class="bg-yellow-text-red">整個組別</span>進行一鍵「全部外出」或「全部歸隊」。',
                    side: "bottom", align: 'center'
                }
            },
            {
                element: 'button[onclick="showQuickControl()"]', // 指向快速控制按鈕
                popover: {
                    title: '⚡ 快速控制 (可搜尋人名)',
                    description: '找不到特定人員或裝備？<br>打開這裡，輸入關鍵字<br><span class="text-highlight-yellow">瞬間鎖定並更改狀態</span>。',
                    side: "bottom", align: 'start'
                }
            },
            {
                element: '#tour-history-btn', // 指向歷史面板按鈕
                popover: {
                    title: '📚 歷史記錄',
                    description: '查看人員狀態變更的<br>最近歷史記錄。',
                    side: "bottom", align: 'end'
                }
            },
            {
                element: 'button[onclick="manageReasons()"]', // 指向原因管理按鈕
                popover: {
                    title: '📝 原因管理',
                    description: '出勤理由不夠用？在這裡可以<span class="text-highlight-red">自訂您的常用外出原因</span>，方便未來快速點選。',
                    side: "bottom", align: 'end' 
                }
            },
            {
                element: 'button[onclick="refreshData()"]', // 指向原因管理按鈕
                popover: {
                    title: '🔄 更新資料',
                    description: '手動更新人員狀態資料。<br><span class="text-highlight-red">自動更新時間是30秒，也可以手動刷新</span>',
                    side: "bottom", align: 'end' // 因為這個按鈕比較下面，popover 改從上面彈出
                }
            }
        ]
    });
    tourGuide.drive(); // 開演！
}

// =========================================
// 🎧 自動觸發機制 (初次登入自動播放)
// =========================================
document.addEventListener('DOMContentLoaded', function() {
    // 延遲 1.5 秒等畫面跟資料都長出來後，再決定要不要彈出教學
    setTimeout(() => {
        if (!localStorage.getItem('hasSeenPersonnelTutorial')) {
            startPersonnelTutorial();
            // 標記為已觀看，下次進來就不會自動彈了
            localStorage.setItem('hasSeenPersonnelTutorial', 'true');
        }
    }, 1500); 
});