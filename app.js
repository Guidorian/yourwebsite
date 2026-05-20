import { createClient } from '@vercel/kv';

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).send('<h1>Link non valido</h1>');
  }

  // Sanity check slug
  if (!/^[a-z0-9-]+$/.test(slug) || slug.length > 60) {
    return res.status(400).send('<h1>Link non valido</h1>');
  }

  try {
    const kv = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    const raw = await kv.get(`site:${slug}`);

    if (!raw) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="it">
        <head>
          <meta charset="UTF-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Sito non trovato — SitoAI</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fafaf8; }
            .box { text-align: center; padding: 2rem; }
            h1 { font-size: 2rem; margin-bottom: 1rem; }
            p { color: #666; margin-bottom: 1.5rem; }
            a { display: inline-block; padding: 10px 24px; background: #1a1a1a; color: white; border-radius: 8px; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>🔍 Sito non trovato</h1>
            <p>Questo link è scaduto o non esiste.<br/>I siti gratuiti sono disponibili per 90 giorni.</p>
            <a href="/">Crea un nuovo sito</a>
          </div>
        </body>
        </html>
      `);
    }

    const site = typeof raw === 'string' ? JSON.parse(raw) : raw;

    // Incrementa views in background (fire-and-forget)
    try {
      const updated = { ...site, views: (site.views || 0) + 1 };
      kv.set(`site:${slug}`, JSON.stringify(updated), { keepTtl: true }).catch(() => {});
    } catch (_) {}

    // Inietta banner SitoAI nel sito prima di servirlo
    const banner = `
<!-- SitoAI Banner -->
<style>
  #sitoai-banner {
    position: fixed; bottom: 16px; right: 16px; z-index: 99999;
    background: #1a1a1a; color: white;
    padding: 10px 16px; border-radius: 99px;
    font-family: system-ui, sans-serif; font-size: 13px;
    display: flex; align-items: center; gap: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    text-decoration: none;
    transition: opacity 0.2s;
  }
  #sitoai-banner:hover { opacity: 0.85; }
  #sitoai-banner .dot { width: 7px; height: 7px; background: #4ade80; border-radius: 50%; }
</style>
<a href="/" id="sitoai-banner" target="_blank">
  <span class="dot"></span> Creato con SitoAI — Crea il tuo gratis
</a>`;

    // Inserisci banner prima di </body>
    const htmlWithBanner = site.html.includes('</body>')
      ? site.html.replace('</body>', `${banner}\n</body>`)
      : site.html + banner;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300'); // cache 5 min
    return res.status(200).send(htmlWithBanner);

  } catch (err) {
    console.error('[site] Errore:', err);
    return res.status(500).send('<h1>Errore del server. Riprova più tardi.</h1>');
  }
}
