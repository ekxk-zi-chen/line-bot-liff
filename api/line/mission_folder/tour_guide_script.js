// mission_folder/tour_guide.js

// =========================================
// 🎮 遊戲化新手教學 (Driver.js)
// =========================================
function startTutorial() {
    const driver = window.driver.js.driver;
    const tourGuide = driver({
        showProgress: true,
        allowClose: true,        // 💡 必須為 true 才有右上角的 X，我們會用 CSS 移位置
        overlayClickable: false, // 💡 關鍵：設為 false，點擊黑色背景不會消失
        // ---------------------------------------------------------
        // 🎨 下面這四個是按鈕文字自定義
        // ---------------------------------------------------------
        doneBtnText: '完成教學',
        closeBtnText: '跳過',    // 💡 你想做 skip，這裡改寫成「跳過」或「✕」
        nextBtnText: '下一步 ➔',
        prevBtnText: '⬅ 上一步',
        // ---------------------------------------------------------
        steps: [
            {
                popover: {
                    title: '🚒 歡迎來到花蓮特搜戰情中心',
                    description: '學弟你好！第一次登入嗎？讓我花 30 秒帶你認識一下系統介面。',
                    side: "bottom", align: 'center'
                }
            },
            {
                element: '#settings-modal-btn',
                popover: {
                    title: '⚙️ 系統設定',
                    // 💡 使用 <span class="text-highlight-red"> 來達成紅字強調效果
                    description: '調整你的保管人推播設定！<span class="text-highlight-red">重要!!</span> 不想被吵就記得選取「<span class="bg-yellow-text-red">僅限我保管的裝備</span>」',
                    side: "bottom", align: 'start'
                }
            },
            {
                element: '#btn-toggle-filter',
                popover: {
                    title: '🔍 展開搜尋面板',
                    description: '點擊這裡展開詳細搜尋。注意：這裡也可以直接輸入<span class="bg-yellow-text-red">「借出人姓名」</span>來查看他借了什麼！',
                    side: "bottom", align: 'start'
                }
            },
            {
                element: '#status-filter', // 指向你原本的狀態選單
                popover: {
                    title: '📦 裝備狀態過濾',
                    description: '想知道哪些裝備被借走了？或哪些正在維修？點擊這個下拉選單切換就對了！',
                    side: "bottom", align: 'start'
                }
            },
            {
                element: '#history-btn', // 查看歷史紀錄按鈕
                popover: {
                    title: '📜 歷史紀錄',
                    description: '查看最近的歷史紀錄！',
                    side: "bottom", align: 'start'
                }
            },
            {
                element: '#toggle-image-mode-btn', // 切換圖片模式按鈕
                popover: {
                    title: '🖼️ 圖片模式',
                    description: '切換到圖片模式，可以更直觀地查看裝備！',
                    side: "bottom", align: 'start'
                }
            },
            {
                element: '#refresh-btn', // 刷新按鈕
                popover: {
                    title: '🔄 刷新',
                    description: '資源有限，不走即時更新變化，但有做額外裝備變更推播，點擊這裡刷新裝備資料！',
                    side: "bottom", align: 'start'
                }
            },
            {
                element: '#btn-export-mode', // 指向你原本的批量按鈕
                popover: {
                    title: '📊 批量操作與匯出',
                    description: '如果要一次借出多項裝備，或是匯出裝備清單，請點擊這裡進入勾選模式。篩選好後底部有<span class="text-highlight-red">全選</span>可以用!',
                    side: "top", align: 'start'
                }
            },
            {
                element: '#btn-add-eq', // 新增按鈕
                popover: {
                    title: '➕新增 裝備',
                    description: '可以一次匯新增多個裝備，記得多筆要加入清單列表喔!',
                    side: "top", align: 'start'
                }
            }
        ]
    });
    tourGuide.drive(); // 開演！
}

function tryRunTutorial() {
    // 1. 語意超級明確！一看就知道這兩個變數是屬於「系統狀態」的
    if (AppState.system.isSplashFinished && AppState.system.isSystemEntered) {
        if (!localStorage.getItem('hasSeenTutorial')) {
            setTimeout(() => {
                startTutorial();
                localStorage.setItem('hasSeenTutorial', 'true');
            }, 500);
        }
    }
}

// =========================================
// 🎧 事件監聽器綁定區 (神經網路)
// =========================================

// document.addEventListener('DOMContentLoaded', ...) 的意思是：
// 「等 HTML 所有的按鈕、圖片都乖乖排好隊之後，我才開始點名綁定動作！」
document.addEventListener('DOMContentLoaded', function() {
    
    // 1. 抓出畫面上的問號按鈕
    const helpBtn = document.getElementById('btn-help');
    
    // 2. 如果有抓到這個按鈕，就幫它裝上「點擊 (click) 監聽器」
    if (helpBtn) {
        helpBtn.addEventListener('click', function() {
            console.log("💡 呼叫特搜導覽員！");
            
            // 💡 測試專用：清除記憶，確保每次點都能重看 (正式上線可刪除這行)
            localStorage.removeItem('hasSeenTutorial'); 
            
            // 執行教學函數
            startTutorial(); 
        });
    }

});