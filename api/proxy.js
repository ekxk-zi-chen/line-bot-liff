// 關掉自動解析，手動處理 text/plain
export const config = {
  api: {
    bodyParser: false,
  },
};

// 手動讀取請求體的函數
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  // 設置 CORS headers - 這是重點！
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ message: 'Proxy is working!' });
  }

  if (req.method === 'POST') {
    try {
      // 手動讀取 text/plain 請求體
      const rawBody = await getRawBody(req);
      console.log('收到的原始 body:', rawBody);
      
      if (!rawBody) {
        return res.status(400).json({ error: 'Request body is empty' });
      }

      // 解析 JSON
      const body = JSON.parse(rawBody);
      console.log('解析後的 body:', body);
      
      const { url, ...data } = body;
      
      if (!url) {
        return res.status(400).json({ error: 'Missing URL' });
      }

      // 只發送資料部分給 Apps Script，不包含 url
      const dataToSend = JSON.stringify(data);
      console.log('發送給 Apps Script 的資料:', dataToSend);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: dataToSend,
      });

      const text = await response.text();
      console.log('Apps Script 回應:', text);
      
      // 重要！確保回應也有 CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      return res.status(response.status).send(text);
      
    } catch (error) {
      console.error('Proxy 錯誤:', error);
      
      // 錯誤回應也要有 CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
