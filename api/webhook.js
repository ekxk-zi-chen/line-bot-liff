// api/webhook.js

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // 1. 處理 GET (方便瀏覽器檢查)
  if (req.method === 'GET') {
    return new Response('Vercel 轉發站運行中', { status: 200 });
  }

  // 2. 只准 POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    // 3. 取得原始內容 (先用 text 拿，避免 JSON 解析失敗直接崩潰)
    const rawBody = await req.text();
    
    // 如果是空的 Body (有時候 Verify 會這樣)，直接回 OK
    if (!rawBody) {
      return new Response('Empty Body', { status: 200 });
    }

    // 4. 設定你的 GAS 網址 (請務必確認這串 ID 是正確的)
    const GAS_URL = "https://script.google.com/macros/s/你的_GAS_ID/exec";

    // 5. 🔥 射後不理轉發
    req.waitUntil(
      fetch(GAS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Vercel-Edge-Bot'
        },
        body: rawBody, // 直接轉發原始字串，最安全
      }).catch(err => console.error("轉發 GAS 失敗:", err))
    );

    // 6. 秒回 200 OK
    return new Response('OK', { status: 200 });

  } catch (e) {
    // 這裡會把錯誤印在 Vercel 的 Logs 裡
    console.error("Webhook Error:", e.message);
    return new Response(`Internal Error: ${e.message}`, { status: 500 });
  }
}
