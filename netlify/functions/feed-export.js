// netlify/functions/feed-export.js
// Phase 2 — the durability backstop, HTTP path (the chronicle page's Export
// archive button). The export itself lives in lib/export-core.js, shared with
// the nightly schedule (feed-export-nightly.js) so the two paths never drift.
//
// Why: Supabase is live truth; the git-committed JSON is the version-controlled
// archive. The repo is PUBLIC, so hidden rows are NEVER exported, and only the
// chronicle channel is — dice rolls stay Supabase-only by design.
//
// Env (Netlify): GITHUB_TOKEN (existing) + SUPABASE_SERVICE_ROLE_KEY (new).
// Caller must be staff: we verify the bearer token against Supabase auth and
// check the profiles role before writing anything.

const { runExport, SUPABASE_URL, SERVICE_KEY } = require('./lib/export-core');

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

    const result = await runExport();
    return respond(200, result);
  } catch (e) {
    return respond(500, { error: e.message });
  }
};
