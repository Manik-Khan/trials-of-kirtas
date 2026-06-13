// netlify/functions/characters-export.js
// Character backstop — HTTP path (staff-triggered manual export / future button).
// The export itself lives in lib/characters-export-core.js, shared with the
// nightly schedule (characters-export-nightly.js) so the two never drift.
//
// Why: Supabase is live truth; the git-committed data/characters/<key>.json is
// the version-controlled backup. Caller must be staff — we verify the bearer
// token against Supabase auth and check the profiles role before writing.
//
// Env (Netlify): GITHUB_TOKEN + SUPABASE_SERVICE_ROLE_KEY (the new sb_secret_ key).

const { runCharactersExport, SUPABASE_URL, SERVICE_KEY } = require('./lib/characters-export-core');

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
  // The user's access token IS a JWT, so it belongs on Authorization: Bearer.
  const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` },
  });
  if (!uRes.ok) return null;
  const user = await uRes.json();
  if (!user || !user.id) return null;
  // The secret key is NOT a JWT — it goes in apikey only (sending it as
  // Authorization: Bearer is rejected as non-JWT and drops to a role RLS blocks).
  const pRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${user.id}&select=role`,
    { headers: { 'apikey': SERVICE_KEY } });
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

    const result = await runCharactersExport();
    return respond(200, result);
  } catch (e) {
    return respond(500, { error: e.message });
  }
};
