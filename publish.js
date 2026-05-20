import { createClient } from '@vercel/kv';

// TTL: 90 giorni in secondi (puoi aumentarlo per piani a pagamento)
const TTL_FREE = 60 * 60 * 24 * 90;      // 90 giorni
const TTL_PRO  = 60 * 60 * 24 * 365 * 5; // 5 anni (per futuri piani a pagamento)

function generateSlug(nome) {
  // Genera uno slug leggibile dal nome + ID casuale
  const base = (nome || 'sito')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // rimuovi accenti
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 24);

  const rand = Math.random().toString(36).slice(2, 7); // 5 char casuali
  return `${base}-${rand}`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { html, nome, tipo, colore } = req.body;

  if (!html || !html.includes('<!DOCTYPE')) {
    return res.status(400).json({ error: 'HTML non valido.' });
  }

  if (html.length > 500000) {
    return res.status(400).json({ error: 'Sito troppo grande (max 500KB).' });
  }

  try {
    const kv = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    const slug = generateSlug(nome);
    const createdAt = new Date().toISOString();

    const siteData = {
      html,
      nome: nome || 'Sito senza nome',
      tipo: tipo || 'generico',
      colore: colore || '#1a1a1a',
      createdAt,
      views: 0,
    };

    // Salva il sito con TTL
    await kv.set(`site:${slug}`, JSON.stringify(siteData), { ex: TTL_FREE });

    // Salva metadati separati per statistiche future
    await kv.set(`meta:${slug}`, JSON.stringify({
      nome: siteData.nome,
      tipo: siteData.tipo,
      colore: siteData.colore,
      createdAt,
    }), { ex: TTL_FREE });

    console.log(`[publish] Sito pubblicato: ${slug} (${nome})`);

    return res.status(200).json({
      slug,
      url: `/s/${slug}`,
    });

  } catch (err) {
    console.error('[publish] Errore KV:', err);
    return res.status(500).json({ error: 'Errore nel salvataggio. Riprova.' });
  }
}
