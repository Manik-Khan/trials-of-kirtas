// ============================================================
// netlify/functions/tracks.js
// GET  — fetch the full tracks library
// POST — write the full tracks library (replaces file)
//
// Follows the exact same pattern as character.js and chronicle.js.
// Requires NETLIFY_TOKEN env var (set in Netlify dashboard).
// ============================================================

const GITHUB_OWNER = 'Manik-Khan';
const GITHUB_REPO  = 'trials-of-kirtas';
const FILE_PATH    = 'data/tracks.json';
const BRANCH       = 'main';

const BASE_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;

// Empty library — created on first POST if the file doesn't exist yet
const EMPTY_LIBRARY = {
  moods: [],
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const token = process.env.NETLIFY_TOKEN;
  if (!token) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'NETLIFY_TOKEN not set' }) };
  }

  const ghHeaders = {
    Authorization: `token ${token}`,
    Accept:        'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  // ── GET ──────────────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const res = await fetch(`${BASE_URL}?ref=${BRANCH}`, { headers: ghHeaders });

    if (res.status === 404) {
      // File doesn't exist yet — return empty library
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(EMPTY_LIBRARY),
      };
    }

    if (!res.ok) {
      const err = await res.text();
      return { statusCode: res.status, headers, body: JSON.stringify({ error: err }) };
    }

    const data = await res.json();
    const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
    };
  }

  // ── POST ─────────────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    // Get current SHA (needed for GitHub update — null if file doesn't exist yet)
    let sha = null;
    const existing = await fetch(`${BASE_URL}?ref=${BRANCH}`, { headers: ghHeaders });
    if (existing.ok) {
      const d = await existing.json();
      sha = d.sha;
    }

    const encoded = Buffer.from(JSON.stringify(body, null, 2)).toString('base64');

    const payload = {
      message: 'update tracks library',
      content: encoded,
      branch:  BRANCH,
      ...(sha ? { sha } : {}),
    };

    const write = await fetch(BASE_URL, {
      method:  'PUT',
      headers: ghHeaders,
      body:    JSON.stringify(payload),
    });

    if (!write.ok) {
      const err = await write.text();
      return { statusCode: write.status, headers, body: JSON.stringify({ error: err }) };
    }

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
