// api/webhook.ts

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request, context: any) {
  // ==========================================
  // 1. CORS 標頭設定 (解決 GitHub Pages 呼叫 Vercel 的 405/跨域錯誤)
  // ==========================================
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*", // 允許所有網域呼叫 (GitHub Pages, localhost 等)
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // 處理瀏覽器的預檢請求 (Preflight Request)
  // 當瀏覽器發送 POST 前，會先發送一個 OPTIONS 請求來確認權限
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ==========================================
  // 2. 取得環境變數中的 GAS 網址
  // ==========================================
  // @ts-ignore
  const GAS_URL = process.env.GAS_URL;

  if (!GAS_URL) {
    return new Response('Config Error: GAS_URL missing', { status: 500, headers: corsHeaders });
  }

  // 簡單的 GET 測試 (例如瀏覽器直接開網址)
  if (req.method === 'GET') {
    return new Response('Vercel Edge Gateway Active', { status: 200, headers: corsHeaders });
  }

  try {
    // 讀取請求內容
    const rawBody = await req.text();
    
    let isLiffRequest = false;
    
    // 🕵️ 判斷請求來源
    try {
      const jsonBody = JSON.parse(rawBody);
      // 如果 JSON 裡有 source: 'liff'，代表是網頁端來的
      if (jsonBody.source === 'liff') {
        isLiffRequest = true;
      }
    } catch (e) {
      // 解析 JSON 失敗，當作一般 Webhook 處理 (可能是 LINE 的驗證封包或壞掉的封包)
    }

    // ==========================================
    // 🚦 模式 A：LIFF 網頁請求 (必須等待資料回傳)
    // ==========================================
    if (isLiffRequest) {
      // console.log("📥 收到 LIFF 請求，啟動【同步等待】模式");
      
      const gasResponse = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
      });

      // 取得 GAS 的回應文字
      const data = await gasResponse.text();

      // 回傳給瀏覽器 (記得帶上 CORS 標頭，不然瀏覽器會擋)
      return new Response(data, {
        status: gasResponse.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // ==========================================
    // 🚀 模式 B：LINE Webhook (射後不理，防殭屍)
    // ==========================================
    else {
      // console.log("📥 收到 LINE Webhook，啟動【射後不理】模式");
      
      const waitUntil = context?.waitUntil || (req as any).waitUntil;
      
      const forwardTask = fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
      }).catch(err => console.error("轉發失敗:", err));

      if (typeof waitUntil === 'function') {
        waitUntil(forwardTask);
      } else {
        // 如果環境不支援，只好硬著頭皮等 (保險起見)
        await forwardTask;
      }

      // 秒回 OK 給 LINE
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500, headers: corsHeaders });
  }
}
