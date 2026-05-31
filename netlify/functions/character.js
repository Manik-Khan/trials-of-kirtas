// netlify/functions/character.js
// Handles mutable character data (inventory, currency, notes, bio)
// Static data (abilities, features, class) stays in characters.js
// GITHUB_TOKEN is set in Netlify environment variables — never in code

const OWNER  = 'Manik-Khan';
const REPO   = 'trials-of-kirtas';
const BRANCH = 'main';

const ghHeaders = {
  'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
  'Accept':        'application/vnd.github.v3+json',
  'Content-Type':  'application/json',
};

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

// Each character has its own file: data/characters/caim.json etc.
// KEY_FILE maps a key to its data filename where the two differ (e.g. during a key rename).
const KEY_FILE = { cosmere: 'tyros' }; // cosmere data lives in tyros.json until the file is renamed
function filePath(key) {
  return `data/characters/${KEY_FILE[key] || key}.json`;
}

// Valid character keys — guards against path traversal
const VALID_KEYS = ['cosmere', 'caim', 'liadan', 'vesperian'];

async function fetchCharacterFile(key) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath(key)}?ref=${BRANCH}`,
    { headers: ghHeaders }
  );
  // 404 is fine — file doesn't exist yet, return empty data
  if (res.status === 404) return { parsed: defaultData(key), sha: null };
  if (!res.ok) throw new Error(`GitHub GET ${res.status}`);
  const data   = await res.json();
  const parsed = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  return { parsed, sha: data.sha };
}

async function writeCharacterFile(key, data, sha, message) {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
    branch:  BRANCH,
  };
  // sha required for updates, omitted for creates
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath(key)}`,
    { method: 'PUT', headers: ghHeaders, body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || `GitHub PUT ${res.status}`);
  }
  return res.json();
}

function defaultData(key) {
  return {
    key,
    inventory: [],
    currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    notes: '',
    bio: {
      personality: '',
      ideals: '',
      bonds: '',
      flaws: '',
      backstory: '',
    },
    combat: {
      hp: null,
      hpTemp: 0,
      hpBonus: 0,
      pipState: {},
      concentration: null,
    },
    lastUpdated: null,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }

  // Character key comes from query string: ?character=caim
  const key = event.queryStringParameters?.character?.toLowerCase();
  if (!key || !VALID_KEYS.includes(key)) {
    return respond(400, { error: `Invalid character key. Must be one of: ${VALID_KEYS.join(', ')}` });
  }

  // ── GET — return mutable character data ──
  if (event.httpMethod === 'GET') {
    try {
      const { parsed, sha } = await fetchCharacterFile(key);
      return respond(200, { data: parsed, sha });
    } catch (e) {
      return respond(500, { error: e.message });
    }
  }

  // ── POST — update one or more fields ──
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { parsed, sha } = await fetchCharacterFile(key);

      // Merge — only update fields that were sent
      // Supported fields: inventory, currency, notes, bio
      // Each is replaced wholesale (client sends full array/object)
      const updated = { ...parsed };

      if (body.inventory  !== undefined) updated.inventory  = body.inventory;
      if (body.currency   !== undefined) updated.currency   = body.currency;
      if (body.notes      !== undefined) updated.notes      = body.notes;
      if (body.bio        !== undefined) updated.bio        = { ...updated.bio, ...body.bio };
      if (body.combat     !== undefined) updated.combat     = { ...(updated.combat || {}), ...body.combat };
      updated.lastUpdated = new Date().toISOString();

      const authorLabel = body._author || key;
      await writeCharacterFile(
        key, updated, sha,
        `Character: ${authorLabel} updated ${Object.keys(body).filter(k => k !== '_author').join(', ')}`
      );

      return respond(200, { success: true, data: updated });
    } catch (e) {
      return respond(500, { error: e.message });
    }
  }

  return respond(405, { error: 'Method not allowed' });
};
