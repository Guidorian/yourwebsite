export default async function handler(req, res) {
  const { slug } = req.query;
  if (!slug || !/^[a-z0-9-]+$/.test(slug) || slug.length > 60) return res.status(400).send('<h1>Link non valido</h1>');

  try {
    const { kv } = await import('@vercel/kv');
    const raw = await kv.get(`site:${slug}`);

    if (!raw) return res.status(404).send(`<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Non trovato</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafaf8}div{text-align:center;padding:2rem}h1{font-size:2rem;margin-bottom:1rem}p{color:#666;margin-bottom:1.5rem}a{display:inline-block;padding:10px 24px;background:#1a1a1a;color:#fff;border-radius:8px;text-decoration:none}</style></head><body><div><h1>🔍 Sito non trovato</h1><p>Questo link è scaduto o non esiste.<br/>I siti gratuiti sono attivi per 90 giorni.</p><a href="/">Crea un nuovo sito</a></div></body></html>`);

    const site = typeof raw === 'string' ? JSON.parse(raw) : raw;

    // Incrementa views
    try { kv.set(`site:${slug}`, JSON.stringify({ ...site, views: (site.views || 0) + 1 }), { keepTtl: true }).catch(() => {}) } catch(_) {}

    const banner = `<style>#sai-bar{position:fixed;bottom:16px;right:16px;z-index:99999;background:#1a1a1a;color:#fff;padding:10px 16px;border-radius:99px;font-family:system-ui,sans-serif;font-size:13px;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,.25);text-decoration:none}#sai-bar:hover{opacity:.85}#sai-bar .dot{width:7px;height:7px;background:#4ade80;border-radius:50%}</style><a href="/" id="sai-bar" target="_blank"><span class="dot"></span>Creato con SitoAI — Crea il tuo gratis</a>`;
    const htmlOut = site.html.includes('</body>') ? site.html.replace('</body>', `${banner}\n</body>`) : site.html + banner;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(htmlOut);
  } catch (err) {
    console.error('[site]', err);
    return res.status(500).send('<h1>Errore del server</h1>');
  }
}

