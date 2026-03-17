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
                pointer-events: none; /* 🔥 讓點擊直接穿透影片，不要被影片吞掉 */
                background: #000;
            }

            /* 🔥 4. [新增] 透明攔截網 (專門負責收點擊) */
            #splash-skip-layer {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                z-index: 8; /* 介於影片(5)和封面(10)之間 */
                display: none; /* 預設隱藏，等封面點擊後才出現 */
            }

            /* 📱 手機直拿 (Portrait) */
            @media (orientation: portrait) {
                #splash-cover {
                    background-size: contain; 
                    background-position: center 30%;
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
            
            // 🌟 核心修正：加入透明攔截網 <div id="splash-skip-layer"></div>
            wrapper.innerHTML = `
                <div id="splash-cover">
                    <div id="tactical-text">>> TAP TO DEPLOY <<</div>
                </div>
                <div id="splash-skip-layer"></div>
                <video id="splash-video" 
                       playsinline 
                       webkit-playsinline="true" 
                       disablePictureInPicture 
                       preload="auto" 
                       poster="${coverImage}">
                    <source src="${videoSrc}" type="video/mp4">
                </video>
            `;
            document.body.insertBefore(wrapper, document.body.firstChild);

            const video = document.getElementById('splash-video');
            const cover = document.getElementById('splash-cover');
            const skipLayer = document.getElementById('splash-skip-layer'); // 🔥 抓取攔截網

            if(coverImage) {
                cover.style.backgroundImage = `url('${coverImage}')`;
            }

            // 💡 1. 退場函數
            let isFinishing = false;
            const finishSplash = () => {
                if (isFinishing) return;
                isFinishing = true;
                
                wrapper.classList.add('fade-out');
                video.pause(); 
                setTimeout(() => {
                    wrapper.remove();
                    if (typeof onCompleteCallback === 'function') onCompleteCallback();
                }, 800);
            };

            // 💡 2. 點擊封面啟動
            cover.onclick = (e) => {
                e.stopPropagation(); 
                cover.style.display = 'none'; // 封面消失
                skipLayer.style.display = 'block'; // 🔥 讓透明攔截網出現
                video.style.display = 'block'; // 顯示影片
                video.play();
            };

            // 💡 3. [終極必殺] 把跳過邏輯綁在透明攔截網上
            // 同時監聽 onclick (給電腦) 跟 ontouchstart (給手機，反應最快)
            skipLayer.onclick = () => {
                console.log(">> 攔截網觸發：點擊跳過");
                finishSplash();
            };
            skipLayer.ontouchstart = (e) => {
                e.preventDefault(); // 防止手機的連續觸控反應
                console.log(">> 攔截網觸發：觸控跳過");
                finishSplash();
            };

            // 💡 4. 影片自然播完
            video.onended = finishSplash;
        }
    };
})();
