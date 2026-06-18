// netlify/functions/member-invite.js
// Admit a new person from inside the site — keeps the front door locked.
//
// login.html signs in with { shouldCreateUser: false }, so a stranger can't OTP
// their way in. This endpoint is how the OVERSEER lets someone in: it asks
// GoTrue to invite the email (creating the auth user + emailing a magic link via
// your SMTP). The invitee, now an existing user, can then log in normally.
//   action 'invite'  → POST /auth/v1/invite        (send the email)
//   action 'revoke'  → DELETE /auth/v1/admin/users  (undo a bad invite; the
//                      profile, if any, cascades via the FK on delete)
// Overseer-gated. Writes nothing the browser couldn't be tricked into.
//
// Env (Netlify): SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = 'https://cfthwspwpcfamgbfqzuq.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const respond = (statusCode, body) => ({
  statusCode, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

function svcHeaders() {
  const h = { 'apikey': SERVICE_KEY, 'Content-Type': 'application/json' };
  if ((SERVICE_KEY || '').startsWith('eyJ')) h['Authorization'] = `Bearer ${SERVICE_KEY}`;
  return h;
}

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
    `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${user.id}&select=role`, { headers: svcHeaders() });
  if (!pRes.ok) return null;
  const rows = await pRes.json();
  return (rows && rows[0] && rows[0].role === 'overseer') ? user : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST')   return respond(405, { error: 'Method not allowed' });
  if (!SERVICE_KEY)                  return respond(500, { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return respond(400, { error: 'Bad JSON' }); }

  const overseer = await verifyOverseer(event.headers.authorization || event.headers.Authorization);
  if (!overseer) return respond(403, { error: 'Overseer only' });

  const action = body.action || 'invite';

  try {
    if (action === 'invite') {
      const email = (body.email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return respond(400, { error: 'Enter a valid email' });

      // bounce the magic link back to the site that asked (falls back to netlify)
      const origin = event.headers.origin || event.headers.Origin ||
        'https://trials-of-kirtas.netlify.app';
      const url = `${SUPABASE_URL}/auth/v1/invite?redirect_to=${encodeURIComponent(origin + '/')}`;
      const res = await fetch(url, { method: 'POST', headers: svcHeaders(), body: JSON.stringify({ email }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (data && (data.msg || data.error_description || data.error || data.message)) || `invite failed (${res.status})`;
        // already-registered is a common, friendly case
        const code = /already|registered|exists/i.test(msg) ? 409 : res.status;
        return respond(code, { error: msg });
      }
      return respond(200, { ok: true, userId: data.id || null, email });
    }

    if (action === 'revoke') {
      const userId = body.userId;
      if (!userId) return respond(400, { error: 'Missing userId' });
      if (userId === overseer.id) return respond(400, { error: "You can't remove your own account" });
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE', headers: svcHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return respond(res.status, { error: (data && (data.msg || data.error)) || `revoke failed (${res.status})` });
      }
      return respond(200, { ok: true });
    }

    return respond(400, { error: 'Unknown action' });
  } catch (e) {
    return respond(500, { error: e.message });
  }
};
