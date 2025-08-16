import { buffer } from 'micro';

export const config = {
  api: {
    bodyParser: false, // 先關掉 Vercel 的自動 JSON parser
  },
};

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const rawBody = (await buffer(req)).toString(); // 讀取純文字
    const body = JSON.parse(rawBody); // 手動解析 JSON

    if (!body.url) throw new Error('Missing target URL');

    const response = await fetch(body.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: rawBody, // 原封不動送給 Apps Script
    });

    const text = await response.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    res.status(response.status).send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
