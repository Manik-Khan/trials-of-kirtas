// netlify/functions/portrait-upload-sign.js
// Signs a Cloudinary upload for the portrait library — ACCESS-GATED.
//
// The browser can't hold the Cloudinary API secret, and we only want okayed accounts
// writing images. So the browser asks here for a one-time signature; we verify the
// caller's Supabase session and their allow-listed status, then return a signature the
// browser uses to POST the file straight to Cloudinary. The file never passes through
// this function.
//
// Allowed = the caller's profile role is 'overseer', OR the verified account email is in
// PORTRAIT_UPLOADERS (comma-separated, set in Netlify). The upload folder is fixed here,
// server-side — the client only supplies a name, which we sanitise.
//
// Env (Netlify): SUPABASE_SERVICE_ROLE_KEY, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET,
//                PORTRAIT_UPLOADERS (comma-separated emails; optional if you rely on role).

const crypto = require('crypto');

const SUPABASE_URL = 'https://cfthwspwpcfamgbfqzuq.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLOUD_NAME   = 'df0tgoiyb';
const API_KEY      = process.env.CLOUDINARY_API_KEY;
const API_SECRET   = process.env.CLOUDINARY_API_SECRET;
const FOLDER       = 'kirtas/portraits';

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const respond = (statusCode, body) => ({ statusCode, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function svcHeaders() {
  const h = { 'apikey': SERVICE_KEY };
  if ((SERVICE_KEY || '').startsWith('eyJ')) h['Authorization'] = `Bearer ${SERVICE_KEY}`;
  return h;
}

// ── pure helpers (also exported for the smoke) ──
function parseUploaders(raw) {
  return String(raw || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}
function sanitizeName(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')        // drop extension
    .replace(/[^a-z0-9_-]+/g, '-')      // safe chars only
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || ('portrait-' + Date.now());
}
// Cloudinary signature: sorted `k=v&k=v` of the signed params, + the secret, SHA-1 hex.
function sign(params, secret) {
  const keys = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== '').sort();
  const toSign = keys.map(k => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(toSign + secret).digest('hex');
}

// verify the caller is signed in AND allowed to upload
async function verifyUploader(authHeader) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` },
  });
  if (!uRes.ok) return null;
  const user = await uRes.json();
  if (!user || !user.id) return null;

  const email = String(user.email || '').toLowerCase();
  if (email && parseUploaders(process.env.PORTRAIT_UPLOADERS).includes(email)) return user;

  // fall back to the overseer role (same check the admin functions use)
  const pRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${user.id}&select=role`, { headers: svcHeaders() });
  if (pRes.ok) { const rows = await pRes.json(); if (rows && rows[0] && rows[0].role === 'overseer') return user; }
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST')    return respond(405, { error: 'Method not allowed' });
  if (!API_KEY || !API_SECRET)        return respond(500, { error: 'Cloudinary credentials not configured' });

  const user = await verifyUploader(event.headers.authorization || event.headers.Authorization);
  if (!user) return respond(403, { error: 'Your account is not approved to upload portraits.' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (_) { /* ignore */ }
  const publicId  = sanitizeName(body.name || body.filename);
  const timestamp = Math.floor(Date.now() / 1000);

  // folder is fixed server-side (never client-controlled); public_id is sanitised
  const signature = sign({ folder: FOLDER, public_id: publicId, timestamp }, API_SECRET);

  return respond(200, {
    cloudName: CLOUD_NAME,
    apiKey: API_KEY,
    timestamp, signature,
    folder: FOLDER,
    publicId,
    uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
  });
};

// exported for the smoke (pure, no I/O)
exports._test = { sign, sanitizeName, parseUploaders };
