import { buffer } from 'micro';

export const config = {
  api: {
    bodyParser: false, // 關掉 Vercel 的自動 JSON parser
  },
};

export default async function handler(req, res) {
  // 處理 CORS preflight 請求
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // 處理 GET 請求 (用於測試)
  if (req.method === 'GET') {
    return res.status(200).json({ 
      message: 'Proxy is working! Use POST method to forward requests.',
      usage: 'POST with body: { "url": "your-apps-script-url", ...data }'
    });
  }

  // 處理 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 讀取並解析請求體
    const rawBody = (await buffer(req)).toString();
    
    // 檢查是否為空
    if (!rawBody) {
      return res.status(400).json({ error: 'Request body is empty' });
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid JSON format' });
    }

    // 檢查必要參數
    if (!body.url) {
      return res.status(400).json({ error: 'Missing target URL in request body' });
    }

    console.log('Forwarding to:', body.url);
    console.log('Request body:', rawBody);

    // 轉發到 Apps Script
    const response = await fetch(body.url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'text/plain',
        'User-Agent': 'Vercel-Proxy/1.0'
      },
      body: rawBody, // 原封不動送給 Apps Script
    });

    const responseText = await response.text();
    
    console.log('Apps Script response status:', response.status);
    console.log('Apps Script response:', responseText);

    // 設置 CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 返回 Apps Script 的回應
    res.status(response.status).send(responseText);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
