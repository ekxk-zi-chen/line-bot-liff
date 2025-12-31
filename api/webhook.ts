export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request, context: any) {
  // 1. GET 測試
  if (req.method === 'GET') {
    return new Response('Vercel Edge 轉發站已就緒 (診斷版)', { status: 200 });
  }

  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 收到 LINE Webhook 請求`);

  try {
    const rawBody = await req.text();
    const GAS_URL = "https://script.google.com/macros/s/AKfycbwPPgRYU_hsKv1rb9H1Rqo49sMh4P4UjY5559lGUEzhwpM_eIroz_W9xBYuvfCU87b-/exec";

    // 🕵️ 尋找 waitUntil 蹤跡
    const waitUntil = context?.waitUntil || (req as any).waitUntil;

    const forwardTask = fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody,
    })
    .then(res => {
      console.log(`[${new Date().toISOString()}] GAS 回應狀態: ${res.status}`);
      return res;
    })
    .catch(err => {
      console.error(`[${new Date().toISOString()}] 轉發 GAS 失敗:`, err);
    });

    if (typeof waitUntil === 'function') {
      // 🚀 方案 A：真正的無情轉發 (Edge 模式)
      console.log("✅ 偵測到 waitUntil: 啟動【射後不理】方案");
      waitUntil(forwardTask);
      
      // 這裡立刻回傳，不用等 fetch 完成
      return new Response('OK - Async Mode', { status: 200 });
      
    } else {
      // 🐢 方案 B：環境異常 (Node.js 降級模式)
      console.warn("⚠️ 未偵測到 waitUntil: 啟動【同步轉發】方案 (會稍微延遲)");
      
      // 必須等待 fetch 完成，否則 Vercel 會在回傳 Response 後直接殺掉進程
      await forwardTask;
      return new Response('OK - Sync Mode', { status: 200 });
    }

  } catch (e: any) {
    console.error(`[${timestamp}] 系統錯誤:`, e.message);
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
