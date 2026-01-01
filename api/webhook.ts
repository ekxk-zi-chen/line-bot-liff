// api/webhook.ts
export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request, context: any) {
  // 1. 取得環境變數中的 GAS 網址
  // @ts-ignore
  const GAS_URL = process.env.GAS_URL;

  if (!GAS_URL) {
    return new Response('Config Error', { status: 500 });
  }

  if (req.method === 'GET') {
    return new Response('Vercel Edge Gateway Active', { status: 200 });
  }

  try {
    // 複製一份 request，因為 body 串流只能讀一次
    const reqClone = req.clone();
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
      // 解析 JSON 失敗，當作一般 Webhook 處理
    }

    // ==========================================
    // 🚦 模式 A：LIFF 網頁請求 (必須等待資料回傳)
    // ==========================================
    if (isLiffRequest) {
      console.log("📥 收到 LIFF 請求，啟動【同步等待】模式");
      
      const gasResponse = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
      });

      // 直接把 GAS 的回應 (JSON) 轉發回給瀏覽器
      const data = await gasResponse.text();
      return new Response(data, {
        status: gasResponse.status,
        headers: { 'Content-Type': 'application/json' }
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
      return new Response('OK', { status: 200 });
    }

  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
