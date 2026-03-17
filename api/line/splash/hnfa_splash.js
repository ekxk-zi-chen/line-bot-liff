// ==========================================
// 🚀 花搜系統：戰術部署版 (v2.2 跨平台完美適應版)
// ==========================================

const Splash = (() => {
    let onCompleteCallback = null;

    function injectStyles() {
        if (document.getElementById('splash-v-styles')) return;
        const style = document.createElement('style');
        style.id = 'splash-v-styles';
        style.innerHTML = `
            #splash-wrapper {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100dvh;
                background: #050505; z-index: 99999; overflow: hidden;
                transition: opacity 0.8s ease-out;
            }
            
            /* 1. 封面圖層 */
            #splash-cover {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background-color: #050505;
                background-position: center center; 
                background-repeat: no-repeat;
                /* 🌟 戰術暗角：在底部製造黑色漸層，讓黃色文字絕對清晰 */
                box-shadow: inset 0 -200px 150px -50px rgba(0,0,0,0.95);
                display: flex; flex-direction: column; justify-content: flex-end; align-items: center;
                cursor: pointer; z-index: 10;
            }

            /* 2. 戰術文字設計 */
            #tactical-text {
                margin-bottom: 12dvh;
                color: #eab308;
                font-family: 'Courier New', Courier, monospace;
                font-size: clamp(1.2rem, 4vw, 2rem); 
                font-weight: bold;
                letter-spacing: 0.2em;
                text-align: center;
                text-shadow: 0 0 12px rgba(234, 179, 8, 0.8), 0 2px 4px rgba(0,0,0,1);
                animation: terminalBlink 1.2s infinite;
                padding: 0 20px;
                width: 100%;
                box-sizing: border-box;
            }

            @keyframes terminalBlink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0; }
            }

            /* 3. 影片層 */
            #splash-video {
                position: absolute; top: 50%; left: 50%; width: 100vw; height: 100dvh;
                transform: translate(-50%, -50%); 
                display: none; z-index: 5; 
                pointer-events: auto; /* 💡 [關鍵修改] 讓影片可以接收點擊事件 */
                background: #000;
            }

            /* 📱 手機直拿 (Portrait) */
            @media (orientation: portrait) {
                #splash-cover {
                    /* 🔥 關鍵修改：手機上用 contain 保證山豬不被切掉，搭配黑色背景無縫融合 */
                    background-size: contain; 
                    background-position: center 30%; /* 稍微偏上方一點，讓底部有空間放文字 */
                }
                #splash-video {
                    object-fit: contain; 
                }
            }

            /* 💻 電腦/平板橫放 (Landscape) */
            @media (orientation: landscape) {
                #splash-cover {
                    background-size: cover; 
                }
                #splash-video {
                    object-fit: cover; 
                }
            }

            #splash-wrapper.fade-out { opacity: 0; pointer-events: none; }
        `;
        document.head.appendChild(style);
    }

    return {
        init: function({ videoSrc, coverImage, onComplete }) {
            onCompleteCallback = onComplete;
            injectStyles();

            const wrapper = document.createElement('div');
            wrapper.id = 'splash-wrapper';
            
            // 🌟 核心修正：加入 poster (解決安卓灰屏) 與 webkit-playsinline / disablePictureInPicture (解決 iOS 播放器 UI)
            wrapper.innerHTML = `
                <div id="splash-cover">
                    <div id="tactical-text">>> TAP TO DEPLOY <<</div>
                </div>
                <video id="splash-video" 
                       playsinline 
                       webkit-playsinline="true" 
                       disablePictureInPicture 
                       preload="auto" 
                       poster="${coverImage}">
                    <source src="${videoSrc}" type="video/mp4">
                </video>
            `;
            // 強制插在 body 的最前面，確保第一時間蓋住畫面
            document.body.insertBefore(wrapper, document.body.firstChild);

            const video = document.getElementById('splash-video');
            const cover = document.getElementById('splash-cover');

            if(coverImage) {
                cover.style.backgroundImage = `url('${coverImage}')`;
            }

            // 💡 1. 把「退場機制」獨立打包成一個函數
            const finishSplash = () => {
                wrapper.classList.add('fade-out');
                setTimeout(() => {
                    wrapper.remove();
                    if (typeof onCompleteCallback === 'function') onCompleteCallback();
                }, 800);
            };

            // 點擊封面：隱藏封面、顯示影片並播放
            cover.onclick = () => {
                cover.style.display = 'none';
                video.style.display = 'block';
                video.play();
            };

            // 💡 2. [新增] 點擊播放中的影片：立刻暫停，並提早執行退場機制
            video.onclick = () => {
                video.pause();
                finishSplash();
            };

            // 💡 3. 影片自然播完：執行退場機制
            video.onended = finishSplash;
        }
    };
})();
