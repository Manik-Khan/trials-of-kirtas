// netlify/functions/list-portraits.js
// Lists the portrait library so the sheet can show a picker grid. Read-only;
// requires a valid Supabase session (any signed-in user may browse to pick —
// *uploading* is separately gated in portrait-upload-sign). The Cloudinary Admin
// API needs the secret, which can't live in the browser, so it runs here.
//
// History left portraits split across two Cloudinary folders — most characters
// live under kirtas/characters/, a few under kirtas/portraits/ — so we list both
// and de-duplicate by name (newest wins). New uploads all land in kirtas/portraits/.
//
// Env (Netlify): SUPABASE_SERVICE_ROLE_KEY, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.

const SUPABASE_URL = 'https://cfthwspwpcfamgbfqzuq.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLOUD_NAME   = 'df0tgoiyb';
const API_KEY      = process.env.CLOUDINARY_API_KEY;
const API_SECRET   = process.env.CLOUDINARY_API_SECRET;
const PREFIXES     = ['kirtas/portraits', 'kirtas/characters'];

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const respond = (statusCode, body) => ({ statusCode, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function verifyLogin(authHeader) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` },
  });
  if (!uRes.ok) return null;
  const user = await uRes.json();
  return (user && user.id) ? user : null;
}

function deliveryUrls(r) {
  const base = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;
  const fmt  = r.format || 'png';
  return {
    // version-pinned so it never serves a stale cache after a re-upload
    url:   `${base}/v${r.version}/${r.public_id}.${fmt}`,
    // square, face-aware thumbnail for the grid
    thumb: `${base}/w_240,h_240,c_fill,g_face,q_auto,f_auto/v${r.version}/${r.public_id}.${fmt}`,
  };
}

async function listFolder(prefix, auth) {
  // path form (resource_type/type) is the documented way to filter by prefix
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image/upload?prefix=${encodeURIComponent(prefix)}&max_results=500`;
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) throw new Error(`cloudinary ${res.status}`);
  const data = await res.json();
  return data.resources || [];
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'GET')     return respond(405, { error: 'Method not allowed' });
  if (!API_KEY || !API_SECRET)        return respond(500, { error: 'Cloudinary credentials not configured' });

  const user = await verifyLogin(event.headers.authorization || event.headers.Authorization);
  if (!user) return respond(401, { error: 'Sign in to browse portraits.' });

  const auth = 'Basic ' + Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
  let resources = [];
  try {
    const groups = await Promise.all(PREFIXES.map((p) => listFolder(p, auth)));
    resources = [].concat.apply([], groups);
  } catch (e) {
    return respond(502, { error: 'Could not list portraits from Cloudinary.' });
  }

  // de-dupe by display name; the most recently created asset wins
  const byName = {};
  resources.forEach((r) => {
    const name = String(r.public_id).split('/').pop();
    const prev = byName[name];
    if (!prev || String(r.created_at || '') > String(prev.created_at || '')) {
      const u = deliveryUrls(r);
      byName[name] = { publicId: r.public_id, name, url: u.url, thumb: u.thumb, width: r.width, height: r.height, createdAt: r.created_at };
    }
  });
  const portraits = Object.keys(byName).map((k) => byName[k])
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  return respond(200, { portraits });
};
