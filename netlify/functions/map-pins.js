// netlify/functions/map-pins.js
// Reads and writes data/map-pins.json in the GitHub repo.
// Mirrors the pattern used by chronicle.js and character.js.
//
// GET  /.netlify/functions/map-pins           → { pins: [...], sha }
// POST /.netlify/functions/map-pins           → save full pins array
//   body: { pins: [...], message: "..." }

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO  = process.env.GITHUB_REPO || 'Manik-Khan/trials-of-kirtas';
const FILE_PATH    = 'data/map-pins.json';
const BRANCH       = 'main';

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const respond = (statusCode, body) => ({
  statusCode,
  headers: { ...cors, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const API = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;

async function getFile() {
  const res = await fetch(API, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });
  if (res.status === 404) return { pins: [], sha: null };
  if (!res.ok) throw new Error(`GitHub GET ${res.status}`);
  const data = await res.json();
  const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  return { pins: content.pins || [], sha: data.sha };
}

async function putFile(pins, sha, message) {
  const content = Buffer.from(JSON.stringify({ pins }, null, 2)).toString('base64');
  const body = {
    message: message || 'Map pins update',
    content,
    branch: BRANCH,
    ...(sha && { sha }),
  };
  const res = await fetch(API, {
    method:  'PUT',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept':        'application/vnd.github.v3+json',
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub PUT ${res.status}`);
  }
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }

  if (!GITHUB_TOKEN) {
    return respond(500, { error: 'GITHUB_TOKEN not configured' });
  }

  // ── GET ──
  if (event.httpMethod === 'GET') {
    try {
      const { pins, sha } = await getFile();
      return respond(200, { pins, sha });
    } catch(e) {
      return respond(500, { error: e.message });
    }
  }

  // ── POST ──
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      if (!Array.isArray(body.pins)) {
        return respond(400, { error: 'pins array required' });
      }
      // Get current SHA for the update
      const { sha } = await getFile();
      await putFile(body.pins, sha, body.message || 'Map: pins updated');
      return respond(200, { ok: true });
    } catch(e) {
      return respond(500, { error: e.message });
    }
  }

  return respond(405, { error: 'Method not allowed' });
};
