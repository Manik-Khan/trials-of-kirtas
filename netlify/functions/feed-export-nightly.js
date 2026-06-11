// netlify/functions/feed-export-nightly.js
// Phase 2 cleanup — the scheduled durability backstop. Same export as the
// staff Export button (shared core in lib/export-core.js), fired by Netlify's
// scheduler instead of a click.
//
// 10:00 UTC ≈ 4am Mountain — quiet hours, never mid-session. Scheduled
// functions are NOT publicly routable over HTTP, so no auth gate is needed
// here (the HTTP path with the staff check lives in feed-export.js).
//
// Env (Netlify): GITHUB_TOKEN + SUPABASE_SERVICE_ROLE_KEY (same as the button).
// The "unchanged" short-circuit in the core means quiet nights commit nothing.

const { runExport } = require('./lib/export-core');

exports.handler = async () => {
  try {
    const result = await runExport();
    console.log('[nightly export]', JSON.stringify(result));
    return { statusCode: 200 };
  } catch (e) {
    // Surface the failure in the function logs; Netlify retries are not
    // automatic, but the next night's run (or the button) covers the gap.
    console.error('[nightly export] failed:', e.message);
    return { statusCode: 500 };
  }
};

exports.config = { schedule: '0 10 * * *' };
