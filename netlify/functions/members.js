// netlify/functions/members.js
// Members & Access — the READ the browser can't do.
//
// The admin page needs every login's email + last-seen to make sense of who's
// who. auth.users lives in the `auth` schema, which is NOT exposed to the
// `authenticated` client — so this function reads it with the service key and
// joins it to public.profiles. Overseer-gated: we verify the caller's bearer
// token against Supabase auth and check role='overseer' before returning a thing.
//
// WRITES do not come here — set_membership() / request_access() are SECURITY
// DEFINER RPCs the browser calls directly with its own session. This endpoint
// is read-only.
//
// Env (Netlify): SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = 'https://cfthwspwpcfamgbfqzuq.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const respond = (statusCode, body) => ({
  statusCode,
  headers: { ...cors, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// service_role auth headers, robust to both key formats (legacy JWT vs sb_secret_)
function svcHeaders() {
  const h = { 'apikey': SERVICE_KEY };
  if ((SERVICE_KEY || '').startsWith('eyJ')) h['Authorization'] = `Bearer ${SERVICE_KEY}`;
  return h;
}

// caller must be the OVERSEER (assigning access is an admin-only view)
async function verifyOverseer(authHeader) {
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
    { headers: svcHeaders() });
  if (!pRes.ok) return null;
  const rows = await pRes.json();
  return (rows && rows[0] && rows[0].role === 'overseer') ? user : null;
}

// page through the GoTrue admin users list (small group, but don't assume one page)
async function listAuthUsers() {
  const perPage = 200, maxPages = 10;
  let users = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { headers: svcHeaders() });
    if (!res.ok) throw new Error(`auth users ${res.status}`);
    const body = await res.json();
    const batch = Array.isArray(body) ? body : (body.users || []);
    users = users.concat(batch);
    if (batch.length < perPage) break;
  }
  return users;
}

async function listProfiles() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=user_id,username,role,character_key,grants`,
    { headers: svcHeaders() });
  if (!res.ok) throw new Error(`profiles ${res.status}`);
  return res.json();
}

// pure join — every auth login with its profile (or null = never provisioned).
// Exported for unit testing.
const ROLE_RANK = { overseer: 0, dm: 1, player: 2, pending: 3 };
function joinUsersProfiles(users, profiles) {
  const byId = new Map((profiles || []).map(p => [p.user_id, p]));
  const rows = (users || []).map(u => {
    const p = byId.get(u.id) || null;
    const role = p ? p.role : null;
    return {
      userId:       u.id,
      email:        u.email || null,
      lastSignInAt: u.last_sign_in_at || null,
      createdAt:    u.created_at || null,
      username:     p ? (p.username || null) : null,
      role,                                  // null = authenticated but never provisioned
      characterKey: p ? (p.character_key || null) : null,
      grants:       p ? (p.grants || []) : [],
      pending:      !role || role === 'pending',
    };
  });
  rows.sort((a, b) => {
    const pa = a.pending ? 0 : 1, pb = b.pending ? 0 : 1; // pending first (the queue)
    if (pa !== pb) return pa - pb;
    const ra = ROLE_RANK[a.role] ?? 4, rb = ROLE_RANK[b.role] ?? 4;
    if (ra !== rb) return ra - rb;
    return (a.email || '').localeCompare(b.email || '');
  });
  return rows;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'GET')    return respond(405, { error: 'Method not allowed' });
  if (!SERVICE_KEY)                  return respond(500, { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });

  try {
    const overseer = await verifyOverseer(event.headers.authorization || event.headers.Authorization);
    if (!overseer) return respond(403, { error: 'Overseer only' });

    const [users, profiles] = await Promise.all([listAuthUsers(), listProfiles()]);
    return respond(200, { members: joinUsersProfiles(users, profiles) });
  } catch (e) {
    return respond(500, { error: e.message });
  }
};

// expose the pure helper for tests without affecting the Netlify handler
module.exports.joinUsersProfiles = joinUsersProfiles;
