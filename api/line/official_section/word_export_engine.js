// ==========================================
// 🚀 模組化：兩棲聯合 Word 下載引擎 (全表單共用)
// ==========================================

// 1. 讀取本地範本的共用輔助函數
function loadFile(url, callback) {
    PizZipUtils.getBinaryContent(url, callback);
}

// 2. 終極發射動作：處理 iOS 分享與安卓/電腦下載分流
async function handleFinalExport() {
    if (!window.currentWordData) return alert("找不到檔案實體！");
    const { blob, fileName } = window.currentWordData;
    const exportBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    
    submitText.innerText = "⏳ 處理中...";
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    try {
        if (isIOS) {
            const file = new File([blob], fileName, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: '申請單', text: '請查收 Word 檔' });
                submitText.innerText = "✅ 已分享";
                exportBtn.classList.remove('animate-pulse');
            } else {
                fallbackDownload(blob, fileName, exportBtn, submitText);
            }
        } else {
            fallbackDownload(blob, fileName, exportBtn, submitText);
        }
    } catch (err) {
        console.log("分享失敗或取消", err);
        submitText.innerText = "📤 再次點擊分享/下載"; 
    }
}

// 3. 底層下載邏輯：對接 Kotlin APP 通道或傳統暴力下載
function fallbackDownload(blob, fileName, btn, textEl) {
    if (window.AndroidBridge && typeof window.AndroidBridge.saveWordFile === 'function') {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = function() {
            try {
                window.AndroidBridge.saveWordFile(reader.result.split(',')[1], fileName);
                if(textEl) textEl.innerText = "✅ 已存檔並啟動分享";
                if(btn) btn.classList.remove('animate-pulse');
            } catch (e) { alert("❌ APP 通道傳輸失敗：" + e.message); }
        }
    } else {
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        if (ua.indexOf("Line") > -1 || ua.indexOf("FBAN") > -1 || ua.indexOf("FBAV") > -1) {
            alert("⚠️ 警告：您使用的是 Line/FB 內建瀏覽器，這會阻擋下載！\n請點擊右上角「以預設瀏覽器開啟」！");
        } else {
            alert("⚠️ 版本太舊，請刪掉app重新下載。網頁稍後會自動下載檔案");
        }
        try {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url; a.download = fileName;
            document.body.appendChild(a); a.click();
            setTimeout(() => { window.URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
            if(textEl) textEl.innerText = "✅ 檔案已下載";
            if(btn) btn.classList.remove('animate-pulse');
        } catch (err) { alert("傳統下載發生錯誤：" + err.message); }
    }
}