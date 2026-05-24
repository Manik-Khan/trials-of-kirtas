// ============================================================
// netlify/functions/audio-proxy.js
// GET ?url=<encoded-dropbox-url>
//
// Resolves the Dropbox redirect chain server-side (no CORS
// restriction on server-to-server requests) and returns a 302
// to the final dropboxusercontent.com URL with a permissive
// Access-Control-Allow-Origin header added.
//
// The browser then streams audio directly from Dropbox's CDN —
// no audio bytes pass through this function, so there is no
// Netlify bandwidth cost or 10s timeout risk.
//
// This gives the browser a same-origin-equivalent CORS response,
// allowing createMediaElementSource → Web Audio graph routing,
// which is the only way to control per-channel volume on iOS
// (iOS ignores audio.volume set via JavaScript).
// ============================================================

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const raw = event.queryStringParameters?.url;
  if (!raw) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing ?url= parameter' }) };
  }

  let url;
  try {
    url = decodeURIComponent(raw);
    // Basic sanity check — only proxy Dropbox URLs
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('dropbox.com') && !parsed.hostname.endsWith('dropboxusercontent.com')) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only Dropbox URLs are supported' }) };
    }
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL' }) };
  }

  try {
    // Chase the redirect chain without downloading the body.
    // Dropbox typically does: dropbox.com → dropboxusercontent.com (1–2 hops).
    // We follow up to 5 redirects manually so we can inspect each Location header.
    let current = url;
    let finalUrl = url;

    for (let i = 0; i < 5; i++) {
      const res = await fetch(current, {
        method:   'HEAD',
        redirect: 'manual',   // don't auto-follow — we want the Location header
        headers: {
          // Mimic a browser range request so Dropbox serves the audio URL
          'User-Agent': 'Mozilla/5.0',
          'Range':      'bytes=0-0',
        },
      });

      if (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308) {
        const location = res.headers.get('location');
        if (!location) break;
        // Resolve relative redirects
        current = new URL(location, current).toString();
        finalUrl = current;
      } else {
        // Not a redirect — this is the final URL
        finalUrl = current;
        break;
      }
    }

    // Redirect the browser to the resolved CDN URL, injecting CORS header.
    // The browser streams audio directly from there.
    return {
      statusCode: 302,
      headers: {
        ...headers,
        'Location':      finalUrl,
        'Cache-Control': 'public, max-age=300', // cache the resolved URL for 5 min
      },
      body: '',
    };

  } catch (e) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Failed to resolve URL', detail: e.message }),
    };
  }
};
