// Edge function (longer streaming window than a regular function). Server-side proxy to Kimi through OpenRouter (same provider as the Towpath CRM). The API key lives in Netlify env vars, never in the browser.
// Env: STUDIO_PASSPHRASE (required). Per engine: OPENROUTER_API_KEY, or CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN.

const SYSTEM = `You are the frontend engineer inside Towpath Studio, building static websites made only of HTML, CSS and vanilla JS files (no build step, no frameworks, no external libraries unless asked).

OUTPUT FORMAT (strict):
- Start with one or two plain sentences saying what you changed.
- Then output every file you create or change IN FULL, each as a fenced block whose info string is file:<filename>, for example:
\`\`\`file:index.html
<!doctype html>...
\`\`\`
- Never output partial files, diffs or placeholders like "rest unchanged". Do not output files you did not change.

DESIGN RULES:
- Commit to a distinctive, specific aesthetic. Avoid generic template output: no default purple gradients, no stock hero-plus-three-cards layout unless the brief calls for it.
- Choose real type (Google Fonts via <link> is fine), a deliberate color palette, and restrained motion.
- Mobile first and responsive. Semantic HTML, alt text, visible focus states, sufficient contrast.
- Never invent facts about a business (reviews, addresses, years in business, awards, phone numbers). Use clearly marked placeholders such as [phone] instead.
- Copy must be plain and specific. Never use em dashes. Avoid filler words and AI cliches ("elevate", "seamless", "unlock", "world-class").`;

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const pass = Netlify.env.get('STUDIO_PASSPHRASE');
  if (!pass || req.headers.get('x-studio-key') !== pass) return new Response('Unauthorized', { status: 401 });
  let body;
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const clean = messages.filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string');
  if (!clean.length || clean.reduce((n, m) => n + m.content.length, 0) > 150000)
    return new Response('Empty or too large', { status: 413 });

  // Engines are a fixed whitelist so the browser can never pick an arbitrary (paid) model.
  const clean_ = v => (v || '').replace(/[\s"']/g, '');
  const ENGINES = {
    'cf-kimi': () => {
      const acct = clean_(Netlify.env.get('CLOUDFLARE_ACCOUNT_ID')), token = clean_(Netlify.env.get('CLOUDFLARE_API_TOKEN'));
      if (!acct || !token) return { error: 'Server is missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN' };
      return { url: 'https://api.cloudflare.com/client/v4/accounts/' + acct + '/ai/v1/chat/completions', key: token, model: '@cf/moonshotai/kimi-k2.6', extra: {} };
    },
    'or-free': () => orEngine(Netlify.env.get('FREE_MODEL') || 'cohere/north-mini-code:free'),
    'or-kimi': () => orEngine('moonshotai/kimi-k2.6')
  };
  const orEngine = model => {
    const key = clean_(Netlify.env.get('OPENROUTER_API_KEY'));
    if (!key) return { error: 'Server is missing OPENROUTER_API_KEY' };
    return { url: 'https://openrouter.ai/api/v1/chat/completions', key, model, extra: { reasoning: { effort: 'low' } } };
  };
  const eng = (ENGINES[body.engine] || ENGINES['or-free'])();
  if (eng.error) return new Response(eng.error, { status: 500 });

  const upstream = await fetch(eng.url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + eng.key, 'Content-Type': 'application/json', 'X-Title': 'Towpath Studio' },
    body: JSON.stringify({
      model: eng.model,
      messages: [{ role: 'system', content: SYSTEM }, ...clean],
      stream: true,
      max_tokens: 8000,
      ...eng.extra
    })
  });
  if (!upstream.ok) return new Response('Model error ' + upstream.status + ': ' + (await upstream.text()).slice(0, 300), { status: 502 });
  return new Response(upstream.body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/chat' };
