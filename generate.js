export const config = {
  maxDuration: 60, // secondi massimi di esecuzione (piano free = 10s, pro = 60s)
};

export default async function handler(req, res) {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  // Rate limiting semplice tramite header (Vercel aggiunge IP automaticamente)
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  console.log(`[generate] richiesta da IP: ${ip}`);

  // Leggi il body
  const { tipo, nome, descrizione, colore, stile, immagini } = req.body;

  // Validazione base
  if (!descrizione && !nome) {
    return res.status(400).json({ error: 'Inserisci almeno un nome o una descrizione.' });
  }
  if (descrizione && descrizione.length > 3000) {
    return res.status(400).json({ error: 'Descrizione troppo lunga (max 3000 caratteri).' });
  }
  if (immagini && immagini.length > 5) {
    return res.status(400).json({ error: 'Massimo 5 immagini.' });
  }

  // Costruisci il prompt
  const imagesNote = immagini && immagini.length > 0
    ? `\n\nL'utente ha fornito ${immagini.length} immagine/i reali come base64. Inseriscile nel sito usando esattamente i dati base64 forniti come src degli img tag.`
    : '\n\nNon ci sono immagini: crea aree visive con CSS (forme, gradienti, sezioni colorate).';

  const imagesData = immagini && immagini.length > 0
    ? `\n\nIMMAGINI BASE64:\n${immagini.map((img, i) => `[Immagine ${i+1} - ${img.name}]: ${img.data}`).join('\n\n')}`
    : '';

  const prompt = `Crea un sito web completo e professionale in HTML autonomo (tutto in un unico file HTML) con queste specifiche:

TIPO SITO: ${tipo || 'generico'}
NOME/ATTIVITÀ: ${nome || 'Non specificato'}
DESCRIZIONE: ${descrizione || 'Sito generico di tipo ' + (tipo || 'business')}
COLORE PRINCIPALE: ${colore || '#1a1a1a'}
STILE VISIVO: ${stile || 'moderno'}

REQUISITI TECNICI OBBLIGATORI:
- Tutto CSS e JS inline in un unico file HTML
- Design completamente responsive (mobile-first)
- Font Google importati nel CSS
- Navigazione sticky con smooth scroll
- Almeno 5 sezioni: Hero, About, Servizi/Menu/Portfolio, Galleria, Contatti
- Animazioni CSS all'entrata (fade-in, slide-up)
- Footer con copyright
- Colore principale ${colore || '#1a1a1a'} per bottoni e accenti
- Form contatti frontend
- Testo in italiano
- Contenuto realistico basato sulla descrizione
${imagesNote}
${imagesData}

RISPOSTA: Solo il codice HTML. Nessun testo prima o dopo. Nessun backtick. Inizia con <!DOCTYPE html>.`;

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('[generate] ANTHROPIC_API_KEY non configurata');
      return res.status(500).json({ error: 'Configurazione server mancante. Contatta l\'amministratore.' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('[generate] Errore API Anthropic:', response.status, errData);
      return res.status(502).json({ error: 'Errore nella generazione. Riprova tra qualche secondo.' });
    }

    const data = await response.json();
    let html = data.content?.find(b => b.type === 'text')?.text || '';
    html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/g, '').trim();

    if (!html.includes('<!DOCTYPE')) {
      return res.status(502).json({ error: 'Il sito generato non è valido. Riprova.' });
    }

    return res.status(200).json({ html });

  } catch (err) {
    console.error('[generate] Errore interno:', err);
    return res.status(500).json({ error: 'Errore interno del server. Riprova.' });
  }
}
