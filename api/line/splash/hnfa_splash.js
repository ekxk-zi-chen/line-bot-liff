// ==========================================
// 🚀 花搜系統：戰術部署版 (v2.1 手機完美自適應)
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
                background: #000; z-index: 99999; overflow: hidden;
                transition: opacity 0.8s ease-out;
            }
            
            /* 1. 封面圖層 */
            #splash-cover {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background-color: #050505;
                background-image: url('USAR.png');
                background-size: cover; 
                /* 預設將圖片對齊正中央 */
                background-position: center center; 
                /* 🌟 戰術暗角：在底部製造黑色漸層，讓黃色文字絕對清晰 */
                box-shadow: inset 0 -200px 150px -50px rgba(0,0,0,0.9);
                display: flex; flex-direction: column; justify-content: flex-end; align-items: center;
                cursor: pointer; z-index: 10;
            }

            /* 2. 戰術文字設計 */
            #tactical-text {
                margin-bottom: 12dvh; /* 避開手機底部的橫條 */
                color: #eab308;
                font-family: 'Courier New', Courier, monospace;
                /* 🌟 神奇縮放語法：最小 1.2rem，隨螢幕變大，最大不超過 2rem */
                font-size: clamp(1.2rem, 4vw, 2rem); 
                font-weight: bold;
                letter-spacing: 0.2em; /* 字距適中，防破版 */
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

            /* 3. 影片層共用設定 */
            #splash-video {
                position: absolute; top: 50%; left: 50%; width: 100vw; height: 100dvh;
                transform: translate(-50%, -50%); 
                display: none; z-index: 5; pointer-events: none;
                background: #000;
            }

            /* 📱 螢幕方向 A：手機直拿 (Portrait) */
            @media (orientation: portrait) {
                #splash-cover {
                    /* 手機直拿時，確保圖片重點在上方或中央不被切掉 */
                    background-position: center top; 
                }
                #splash-video {
                    /* 🌟 關鍵：橫向影片在直立手機上不裁切，保留完整畫面（上下會有電影黑邊） */
                    object-fit: contain; 
                }
            }

            /* 💻 螢幕方向 B：電腦/平板橫放 (Landscape) */
            @media (orientation: landscape) {
                #splash-video {
                    /* 橫放時完美填滿螢幕，氣勢最強 */
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
            
            wrapper.innerHTML = `
                <div id="splash-cover">
                    <div id="tactical-text">>> HUALIEN USAR <<</div>
                </div>
                <video id="splash-video" playsinline>
                    <source src="${videoSrc}" type="video/mp4">
                </video>
            `;
            document.body.appendChild(wrapper);

            const video = document.getElementById('splash-video');
            const cover = document.getElementById('splash-cover');

            if(coverImage) {
                cover.style.backgroundImage = `url('${coverImage}')`;
            }

            cover.onclick = () => {
                cover.style.display = 'none';
                video.style.display = 'block';
                video.play();
            };

            video.onended = () => {
                wrapper.classList.add('fade-out');
                setTimeout(() => {
                    wrapper.remove();
                    if (typeof onCompleteCallback === 'function') onCompleteCallback();
                }, 800);
            };
        }
    };
})();