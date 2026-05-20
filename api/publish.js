export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });

  const { html, nome, tipo, colore } = req.body;
  if (!html || !html.includes('<!DOCTYPE')) return res.status(400).json({ error: 'HTML non valido.' });
  if (html.length > 600000) return res.status(400).json({ error: 'Sito troppo grande.' });

  try {
    const { kv } = await import('@vercel/kv');

    const base = (nome || 'sito')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').trim()
      .replace(/\s+/g, '-').slice(0, 24);
    const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;

    const data = { html, nome: nome || 'Sito', tipo: tipo || 'generico', colore: colore || '#1a1a1a', createdAt: new Date().toISOString(), views: 0 };

    await kv.set(`site:${slug}`, JSON.stringify(data), { ex: 60 * 60 * 24 * 90 });

    return res.status(200).json({ slug, url: `/s/${slug}` });
  } catch (err) {
    console.error('[publish]', err);
    return res.status(500).json({ error: 'Errore nel salvataggio. Verifica che Vercel KV sia configurato.' });
  }
}

