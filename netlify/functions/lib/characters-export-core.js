// netlify/functions/lib/characters-export-core.js
// The character-sheet durability backstop — the twin of lib/export-core.js.
// Reads public.characters from Supabase (live truth) and commits each
// data/characters/<key>.json via the GitHub contents API, so git stays a
// faithful, version-controlled backup. Shared by the staff HTTP path
// (characters-export.js) and the nightly schedule (characters-export-nightly.js)
// so the two never drift.
//
// The written JSON keeps the LEGACY keys the old sheet reads (combat, inventory,
// currency, bio, notes) so nothing breaks during the transition, and adds the
// full `structural` + `equipment` so the file is a COMPLETE backup of the row.
// `vitals` maps back to the legacy `combat` key. Per-file "unchanged"
// short-circuit means quiet nights commit nothing.
//
// Env (Netlify): GITHUB_TOKEN + SUPABASE_SERVICE_ROLE_KEY (same as the feed
// export — already configured). In lib/ so Netlify does not register it as an
// endpoint.

const OWNER  = 'Manik-Khan';
const REPO   = 'trials-of-kirtas';
const BRANCH = 'main';
const DIR    = 'data/characters';

const SUPABASE_URL = 'https://cfthwspwpcfamgbfqzuq.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ghHeaders = {
  'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
  'Accept':        'application/vnd.github.v3+json',
  'Content-Type':  'application/json',
};

// characters row → on-disk JSON shape. Legacy keys preserved for the old sheet;
// structural + equipment added so the file fully reflects the row. The fixed key
// order keeps JSON.stringify deterministic, which the "unchanged" check relies on.
function rowToFile(r) {
  return {
    key:         r.key,
    structural:  r.structural || {},
    combat:      r.vitals     || {},   // legacy key the old sheet reads
    inventory:   r.inventory  || [],
    equipment:   r.equipment  || {},
    currency:    r.currency   || {},
    bio:         r.bio        || {},
    notes:       (r.notes == null ? '' : r.notes),
    lastUpdated: r.updated_at,
  };
}

// GET (for sha + current content) → compare → PUT. Mirrors the legacy pattern;
// tolerates a missing file (404 → create). Returns { key, unchanged } or
// { key, committed }.
async function commitFile(key, payload) {
  const FILE = `${DIR}/${key}.json`;
  const url  = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`;

  const getRes = await fetch(`${url}?ref=${BRANCH}`, { headers: ghHeaders });
  let sha = null, prev = null;
  if (getRes.ok) {
    const g = await getRes.json();
    sha  = g.sha;
    prev = Buffer.from(g.content, 'base64').toString('utf8');
  } else if (getRes.status !== 404) {
    throw new Error(`GitHub GET ${key} ${getRes.status}`);
  }

  const next = JSON.stringify(payload, null, 2);
  if (prev === next) return { key, unchanged: true };

  const putRes = await fetch(url, {
    method:  'PUT',
    headers: ghHeaders,
    body: JSON.stringify({
      message: `Characters: backup export (${key})`,
      content: Buffer.from(next).toString('base64'),
      ...(sha && { sha }),
      branch:  BRANCH,
    }),
  });
  if (!putRes.ok) {
    const err = await putRes.json();
    throw new Error(err.message || `GitHub PUT ${key} ${putRes.status}`);
  }
  return { key, committed: true };
}

// Runs the export across all character rows. Returns
// { success, committed, unchanged, files: [...] }; throws on failure.
async function runCharactersExport() {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/characters` +
    `?select=key,structural,vitals,inventory,equipment,currency,bio,notes,updated_at` +
    `&order=key.asc`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } });
  if (!res.ok) throw new Error(`Characters read ${res.status}`);
  const rows = await res.json();

  const files = [];
  for (const r of rows) files.push(await commitFile(r.key, rowToFile(r)));

  const committed = files.filter(f => f.committed).length;
  return { success: true, committed, unchanged: committed === 0, files };
}

module.exports = { runCharactersExport, SUPABASE_URL, SERVICE_KEY };
