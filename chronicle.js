// netlify/functions/chronicle.js
// Handles all chronicle operations via GitHub API
// GITHUB_TOKEN is set in Netlify environment variables — never in code

const OWNER  = 'Manik-Khan';
const REPO   = 'trials-of-kirtas';
const FILE   = 'data/chronicle.json';
const BRANCH = 'main';

const ghHeaders = {
  'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
  'Accept':        'application/vnd.github.v3+json',
  'Content-Type':  'application/json',
};

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

const respond = (statusCode, body) => ({
  statusCode,
  headers: { ...cors, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function fetchFile() {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}?ref=${BRANCH}`,
    { headers: ghHeaders }
  );
  if (!res.ok) throw new Error(`GitHub GET ${res.status}`);
  const data    = await res.json();
  const parsed  = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  return { parsed, sha: data.sha };
}

async function writeFile(data, sha, message) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`,
    {
      method:  'PUT',
      headers: ghHeaders,
      body: JSON.stringify({
        message,
        content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
        sha,
        branch:  BRANCH,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || `GitHub PUT ${res.status}`);
  }
  return res.json();
}

function normalise(parsed) {
  // Support legacy array format and new {entries, config} format
  if (Array.isArray(parsed)) return { entries: parsed, config: {} };
  return { entries: parsed.entries || [], config: parsed.config || {} };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }

  // ── GET — return entries and config ──
  if (event.httpMethod === 'GET') {
    try {
      const { parsed, sha } = await fetchFile();
      const { entries, config } = normalise(parsed);
      return respond(200, { entries, config, sha });
    } catch(e) {
      return respond(500, { error: e.message });
    }
  }

  // ── POST — new entry / edit / bulk replace / config update ──
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { parsed, sha } = await fetchFile();
      const store = normalise(parsed);

      // Config update (session bump etc.)
      if (body.configUpdate) {
        store.config = { ...store.config, ...body.configUpdate };
        await writeFile(store, sha, 'Chronicle: config update');
        return respond(200, { success: true });
      }

      // Bulk replace (for edit/delete)
      if (body._replaceAll) {
        store.entries = body.entries;
        await writeFile(store, sha, body.message || 'Chronicle: update');
        return respond(200, { success: true });
      }

      // New entry or edit
      if (!body.text || !body.author) {
        return respond(400, { error: 'Missing required fields: text, author' });
      }

      body.id        = body.id        || Date.now().toString();
      body.timestamp = body.timestamp || new Date().toISOString();

      const idx = store.entries.findIndex(e => e.id === body.id);
      if (idx >= 0) {
        store.entries[idx] = body;
        await writeFile(store, sha, `Chronicle: ${body.author} edited entry`);
      } else {
        store.entries = [body, ...store.entries];
        await writeFile(store, sha, `Chronicle: ${body.author} — Session ${body.session || '?'}`);
      }

      return respond(200, { success: true, entry: body });
    } catch(e) {
      return respond(500, { error: e.message });
    }
  }

  return respond(405, { error: 'Method not allowed' });
};
