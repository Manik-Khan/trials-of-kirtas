// netlify/functions/feed-export.js
// Phase 2 — the durability backstop. Regenerates data/chronicle.json from the
// Supabase feed (chronicle channel, public rows only) and commits it via the
// GitHub contents API, exactly like the legacy chronicle function did.
//
// Why: Supabase is live truth; the git-committed JSON is the version-controlled
// archive. The repo is PUBLIC, so hidden rows are NEVER exported, and only the
// chronicle channel is — dice rolls stay Supabase-only by design.
//
// Env (Netlify): GITHUB_TOKEN (existing) + SUPABASE_SERVICE_ROLE_KEY (new).
// Caller must be staff: we verify the bearer token against Supabase auth and
// check the profiles role before writing anything.

const OWNER  = 'Manik-Khan';
const REPO   = 'trials-of-kirtas';
const FILE   = 'data/chronicle.json';
const BRANCH = 'main';

const SUPABASE_URL = 'https://cfthwspwpcfamgbfqzuq.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ghHeaders = {
  'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
  'Accept':        'application/vnd.github.v3+json',
  'Content-Type':  'application/json',
};

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const respond = (statusCode, body) => ({
  statusCode,
  headers: { ...cors, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// ── caller must be staff (overseer/dm) ──
async function verifyStaff(authHeader) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` },
  });
  if (!uRes.ok) return null;
  const user = await uRes.json();
  if (!user || !user.id) return null;
  const pRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${user.id}&select=role`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } });
  if (!pRes.ok) return null;
  const rows = await pRes.json();
  const role = rows && rows[0] && rows[0].role;
  return (role === 'overseer' || role === 'dm') ? user : null;
}

// ── feed row → the legacy chronicle.json entry shape (export round-trips
// migrated ids via meta.legacy_id, so existing entries keep stable ids) ──
function rowToEntry(r) {
  const m = r.meta || {};
  return {
    id:        m.legacy_id || String(r.id),
    session:   r.session == null ? 0 : r.session,
    ...(m.sessionTitle && { sessionTitle: m.sessionTitle }),
    ...(m.location     && { location: m.location }),
    author:    r.actor_name,
    ...(m.character && { character: m.character }),
    ...(m.color     && { color: m.color }),
    timestamp: r.created_at,
    text:      r.body,
    ...(r.tags && r.tags.length && { tags: r.tags }),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }
  if (!SERVICE_KEY) {
    return respond(500, { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  }

  try {
    const staff = await verifyStaff(event.headers.authorization || event.headers.Authorization);
    if (!staff) return respond(403, { error: 'Staff only' });

    // Public chronicle rows only — the repo is public; hidden never leaves Supabase.
    const fRes = await fetch(
      `${SUPABASE_URL}/rest/v1/feed?channel=eq.chronicle&hidden=is.false` +
      `&select=id,created_at,session,actor_name,body,tags,meta&order=created_at.desc`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } });
    if (!fRes.ok) throw new Error(`Feed read ${fRes.status}`);
    const rows = await fRes.json();

    const cRes = await fetch(
      `${SUPABASE_URL}/rest/v1/campaign?id=eq.1&select=current_session`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } });
    const camp = cRes.ok ? await cRes.json() : [];
    const currentSession = (camp && camp[0] && camp[0].current_session) || 0;

    const payload = { entries: rows.map(rowToEntry), config: { currentSession } };

    // Read for the SHA, then commit — the legacy function's exact pattern.
    const getRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}?ref=${BRANCH}`,
      { headers: ghHeaders });
    if (!getRes.ok) throw new Error(`GitHub GET ${getRes.status}`);
    const { sha, content } = await getRes.json();

    const next = JSON.stringify(payload, null, 2);
    const prev = Buffer.from(content, 'base64').toString('utf8');
    if (prev === next) {
      return respond(200, { success: true, count: payload.entries.length, unchanged: true });
    }

    const putRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`,
      {
        method:  'PUT',
        headers: ghHeaders,
        body: JSON.stringify({
          message: `Chronicle: archive export (${payload.entries.length} entries)`,
          content: Buffer.from(next).toString('base64'),
          sha,
          branch:  BRANCH,
        }),
      });
    if (!putRes.ok) {
      const err = await putRes.json();
      throw new Error(err.message || `GitHub PUT ${putRes.status}`);
    }

    return respond(200, { success: true, count: payload.entries.length });
  } catch (e) {
    return respond(500, { error: e.message });
  }
};
