// mission_folder/tour_guide.js

// =========================================
// 🎮 遊戲化新手教學 (Driver.js)
// =========================================
function startTutorial() {
    const driver = window.driver.js.driver;
    const tourGuide = driver({
        showProgress: true, // 顯示 1/4 進度條
        doneBtnText: '完成教學',
        closeBtnText: '✕',
        nextBtnText: '下一步 ➔',
        prevBtnText: '⬅ 上一步',
        steps: [
            {
                popover: {
                    title: '🚒 歡迎來到花蓮特搜戰情中心',
                    description: '學弟你好！第一次登入嗎？讓我花 30 秒帶你認識一下系統介面。',
                    side: "bottom", align: 'center'
                }
            },
            {
                element: '#btn-toggle-filter', // 指向你原本的搜尋放大鏡
                popover: {
                    title: '🔍 展開搜尋面板',
                    description: '點擊這裡，可以展開詳細的裝備分類與關鍵字搜尋框。不知道全名沒關係，打一個字就能找！',
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
                element: '#btn-export-mode', // 指向你原本的批量按鈕
                popover: {
                    title: '📊 批量操作與匯出',
                    description: '如果要一次借出多項裝備，或是下載裝備清單，請點擊這裡進入選擇模式。',
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
