export default async function handler(req, res) {
  console.log('請求方法:', req.method);
  console.log('Content-Type:', req.headers['content-type']);

  // 只在最後回應前端時才設置 CORS，不要在中間設置
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ message: 'Proxy is working!' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('req.body:', req.body);
    console.log('req.body type:', typeof req.body);
    
    // 前端發送的是完整的 JSON 字串（包含 url）
    let requestData;
    
    if (typeof req.body === 'string') {
      requestData = JSON.parse(req.body);
    } else {
      requestData = req.body;
    }
    
    console.log('解析的請求資料:', requestData);
    
    const targetUrl = requestData.url;
    if (!targetUrl) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({ error: 'Missing URL' });
    }

    // 重要：原封不動把整個請求體發送給 Apps Script
    // Apps Script 自己會從中取出需要的資料（idToken, sessionToken, slot 等）
    const bodyToSend = JSON.stringify(requestData);
    console.log('發送給 Apps Script 的完整資料:', bodyToSend);

    // 呼叫 Apps Script，不設置任何 CORS
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'text/plain'
      },
      body: bodyToSend  // 完整的資料給 Apps Script
    });

    console.log('Apps Script 回應狀態:', response.status);
    
    const responseText = await response.text();
    console.log('Apps Script 回應內容:', responseText);

    // 只在這裡，回應給前端時，才加上 CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 把 Apps Script 的回應原封不動傳回前端
    return res.status(response.status).send(responseText);
    
  } catch (error) {
    console.error('Proxy 錯誤:', error);
    
    // 錯誤時也要加 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}
