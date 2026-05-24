// ============================================================
// netlify/functions/audio-proxy.js
// GET ?url=<encoded-dropbox-url>
//
// Resolves the Dropbox redirect chain server-side and returns
// a 302 to the final dropboxusercontent.com URL.
//
// The browser then streams audio directly from Dropbox's CDN —
// no audio bytes pass through this function.
//
// Why this works: Dropbox shared links redirect through 2-3 hops
// before landing on a dropboxusercontent.com CDN URL. The browser
// can't follow those redirects with crossOrigin='anonymous' set
// because the intermediate hops don't send CORS headers.
// This function chases the hops server-side (no CORS rules apply)
// and redirects the browser straight to the final CDN URL, which
// does send CORS headers — enabling createMediaElementSource and
// real Web Audio GainNode volume control on iOS.
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
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('dropbox.com') && !parsed.hostname.endsWith('dropboxusercontent.com')) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only Dropbox URLs are supported' }) };
    }
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL' }) };
  }

  try {
    // Chase the redirect chain using GET (not HEAD — Dropbox CDN rejects HEAD+Range).
    // redirect:'manual' lets us inspect each Location header without downloading the body.
    // We abort as soon as we have a non-redirect response or hit dropboxusercontent.com.
    let current = url;
    let finalUrl = url;

    for (let i = 0; i < 6; i++) {
      const res = await fetch(current, {
        method:   'GET',
        redirect: 'manual',
        headers:  { 'User-Agent': 'Mozilla/5.0' },
      });

      const location = res.headers.get('location');

      if ((res.status >= 301 && res.status <= 308) && location) {
        // Follow the redirect
        current = new URL(location, current).toString();
        finalUrl = current;

        // If we've landed on the CDN domain, no need to go further
        if (new URL(current).hostname.endsWith('dropboxusercontent.com')) {
          break;
        }
      } else {
        // Non-redirect response — this is the final URL
        finalUrl = current;
        break;
      }
    }

    return {
      statusCode: 302,
      headers: {
        ...headers,
        'Location':      finalUrl,
        'Cache-Control': 'public, max-age=300',
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
