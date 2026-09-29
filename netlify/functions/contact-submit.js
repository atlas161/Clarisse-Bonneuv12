// Vérifie le jeton Cloudflare Turnstile puis relaie la demande vers Netlify Forms.
// Requiert la variable d'environnement TURNSTILE_SECRET_KEY (clé privée Cloudflare).
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const secret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) {
    console.error('[contact-submit] TURNSTILE_SECRET_KEY is not configured.');
    return json(500, { error: 'not_configured' });
  }

  const params = new URLSearchParams(event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body || '');
  const token = params.get('cf-turnstile-response');
  params.delete('cf-turnstile-response');

  if (!token) {
    return json(400, { error: 'captcha_missing' });
  }

  try {
    const verification = new URLSearchParams({ secret, response: token });
    const clientIp = event.headers?.['x-nf-client-connection-ip'];
    if (clientIp) {
      verification.set('remoteip', clientIp);
    }

    const verifyResponse = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body: verification });
    const result = await verifyResponse.json();

    if (!result.success) {
      return json(403, { error: 'captcha_failed' });
    }

    const siteUrl = String(process.env.URL || 'https://clarisse-bonneu.fr').replace(/\/$/, '');
    const forwarded = await fetch(`${siteUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!forwarded.ok) {
      console.error('[contact-submit] Netlify Forms rejected the submission, status', forwarded.status);
      return json(502, { error: 'forward_failed' });
    }

    return json(200, { ok: true });
  } catch (error) {
    console.error('[contact-submit] Unexpected error', error);
    return json(500, { error: 'server_error' });
  }
};
