export default async function handler(req, res) {
  try {
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);

    const targetUrl = body.url;
    if (!targetUrl) throw new Error("Missing target URL");

    const payloadForAS = JSON.stringify({
      idToken: body.idToken,
      sessionToken: body.sessionToken,
      slot: body.slot
    });

    let response, text;
    try {
      response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: payloadForAS
      });
      text = await response.text();
    } catch (fetchErr) {
      console.error('Fetch to Apps Script failed:', fetchErr);
      return res.status(502).json({ error: 'Fetch to Apps Script failed', detail: fetchErr.message });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    res.status(response.status).send(text);

  } catch (err) {
    console.error('Proxy handler error:', err);
    res.status(500).json({ error: err.message });
  }
}
