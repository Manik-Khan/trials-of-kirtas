// netlify/functions/characters-export.js
// ⚠ TEMP DIAGNOSTIC+FIX BUILD (marker keyauth-2). Confirms the live build and the
// staff-check outcome. Revert to the clean version once we see a 200.

const { runCharactersExport, SUPABASE_URL, SERVICE_KEY } = require('./lib/characters-export-core');

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const respond = (statusCode, body) => ({
  statusCode, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

// service_role auth headers, robust to both key formats (see core for the why).
function svcHeaders() {
  const h = { 'apikey': SERVICE_KEY };
  if ((SERVICE_KEY || '').startsWith('eyJ')) h['Authorization'] = `Bearer ${SERVICE_KEY}`;
  return h;
}

async function verifyStaff(authHeader) {
  const dbg = { build: 'keyauth-2' };
  const token = (authHeader || '').replace(/^Bearer\s+/i, '');
  dbg.hasToken = !!token;
  dbg.serviceKeyLen = (SERVICE_KEY || '').length;
  dbg.keyKind = (SERVICE_KEY || '').startsWith('eyJ') ? 'legacy-jwt'
              : (SERVICE_KEY || '').startsWith('sb_secret_') ? 'sb-secret'
              : (SERVICE_KEY || '').startsWith('sb_publishable_') ? 'sb-PUBLISHABLE'
              : 'unknown';
  if (!token) return { ok: false, dbg };

  const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` },  // user JWT — correct as Bearer
  });
  dbg.authUserStatus = uRes.status;
  if (!uRes.ok) return { ok: false, dbg };
  const user = await uRes.json();
  dbg.userId = (user && user.id) ? user.id : null;
  if (!user || !user.id) return { ok: false, dbg };

  const pRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${user.id}&select=role`,
    { headers: svcHeaders() });
  dbg.profilesStatus = pRes.status;
  const rows = pRes.ok ? await pRes.json() : null;
  dbg.profileCount = Array.isArray(rows) ? rows.length : null;
  const role = rows && rows[0] && rows[0].role;
  dbg.role = role || null;

  return { ok: (role === 'overseer' || role === 'dm'), user, dbg };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST')   return respond(405, { error: 'Method not allowed' });
  if (!SERVICE_KEY)                  return respond(500, { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });

  try {
    const res = await verifyStaff(event.headers.authorization || event.headers.Authorization);
    if (!res.ok) return respond(403, { error: 'Staff only', debug: res.dbg });
    const result = await runCharactersExport();
    return respond(200, { ...result, build: 'keyauth-2' });
  } catch (e) {
    return respond(500, { error: e.message, build: 'keyauth-2' });
  }
};
