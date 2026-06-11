// netlify/functions/lib/export-core.js
// The chronicle export, factored out of feed-export.js so the button (HTTP,
// staff-gated) and the nightly schedule (feed-export-nightly.js) run the SAME
// code — no drift between the two paths.
//
// Reads public chronicle-channel feed rows from Supabase and commits
// data/chronicle.json via the GitHub contents API. The repo is PUBLIC, so
// hidden rows are NEVER exported, and only the chronicle channel is — dice
// rolls and kind:'event' replay rows stay Supabase-only by design.
//
// Env (Netlify): GITHUB_TOKEN + SUPABASE_SERVICE_ROLE_KEY.
//
// NOTE: this lives in lib/ so Netlify does not register it as a function
// (only files directly in netlify/functions, or dirs with a matching entry
// file, become endpoints).

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

// Runs the export. Returns { success, count, unchanged? }; throws on failure.
async function runExport() {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');

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
    return { success: true, count: payload.entries.length, unchanged: true };
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

  return { success: true, count: payload.entries.length };
}

module.exports = { runExport, SUPABASE_URL, SERVICE_KEY };
