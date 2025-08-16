export default async function handler(req, res) {
  try {
    const bodyText = await req.text(); // <- 取純文字
    const body = JSON.parse(bodyText); // <- JSON.parse 手動解析

    const url = body.url;
    if (!url) throw new Error("Missing target URL");

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body) // 原封不動送給 Apps Script
    });

    const text = await response.text();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    res.status(response.status).send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
