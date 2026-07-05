// ============================================================
// netlify/functions/time.js
// GET — the shared clock for Bardic radio sync (wave B, July 5).
// Returns server time; every device (engine + listeners) estimates
// its offset against THIS clock, so nobody syncs to anybody's
// wall clock. Pure Date.now() — no GitHub API, no env vars.
// Follows the same handler pattern as tracks.js.
// ============================================================

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'GET')     return { statusCode: 405, headers, body: JSON.stringify({ error: 'GET only' }) };
  return { statusCode: 200, headers, body: JSON.stringify({ now: Date.now() }) };
};
