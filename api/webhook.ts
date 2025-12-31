// api/webhook.ts (改名為 .ts)

export const config = {
  runtime: 'edge', // 強制指定 Edge
};

export default async function handler(req: Request, context: any) {
  // 1. GET 測試
  if (req.method === 'GET') {
    return new Response('Vercel Edge 轉發站已就緒 (TS版)', { status: 200 });
  }

  try {
    const rawBody = await req.text();
    const GAS_URL = "https://script.google.com/macros/s/你的_GAS_ID/exec";

    // 2. 尋找 waitUntil 的各種可能位置
    // 在 Vercel Edge 中，它可能在 context 裡，也可能在 req 裡
    const waitUntil = context?.waitUntil || (req as any).waitUntil;

    const forwardTask = fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody,
    }).catch(err => console.error("GAS 轉發失敗:", err));

    if (typeof waitUntil === 'function') {
      // ✅ 情況 A：支援射後不理
      waitUntil(forwardTask);
      return new Response('OK (Async)', { status: 200 });
    } else {
      // ⚠️ 情況 B：環境還是不支援 (Node.js模式)，只好等它跑完
      await forwardTask;
      return new Response('OK (Sync)', { status: 200 });
    }

  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
