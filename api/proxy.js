// 支援 text/plain 和 application/json
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // 設置 CORS
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
      let body;
      
      // 處理不同的 Content-Type
      if (typeof req.body === 'string') {
        // PowerShell 用 text/plain 發送的 JSON 字串
        body = JSON.parse(req.body);
      } else {
        // 正常的 application/json
        body = req.body;
      }
      
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
        body: dataToSend,  // 只發送資料，不包含 url
      });

      const text = await response.text();
      console.log('Apps Script 回應:', text);
      
      return res.status(response.status).send(text);
      
    } catch (error) {
      console.error('Proxy 錯誤:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
