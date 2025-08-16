export default async function handler(req, res) {
  try {
    const bodyText = await req.text();

    const url = JSON.parse(bodyText).url;
    if (!url) throw new Error("Missing target URL");

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: bodyText // ✅ 直接傳文字，不再 stringify
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
