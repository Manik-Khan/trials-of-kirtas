// netlify/functions/characters-export-nightly.js
// The scheduled durability backstop for character sheets. Same export as the
// staff HTTP path (shared core in lib/characters-export-core.js), fired by
// Netlify's scheduler instead of a request.
//
// 10:30 UTC ≈ 4:30am Mountain — quiet hours, staggered 30 min after the feed
// export (0 10) so the two don't hit GitHub in the same minute. Scheduled
// functions are NOT publicly routable, so no auth gate is needed here (the
// staff-checked HTTP path lives in characters-export.js).
//
// Env (Netlify): GITHUB_TOKEN + SUPABASE_SERVICE_ROLE_KEY (same as the feed export).
// The per-file "unchanged" short-circuit means quiet nights commit nothing.

const { runCharactersExport } = require('./lib/characters-export-core');

exports.handler = async () => {
  try {
    const result = await runCharactersExport();
    console.log('[nightly characters export]', JSON.stringify(result));
    return { statusCode: 200 };
  } catch (e) {
    console.error('[nightly characters export] failed:', e.message);
    return { statusCode: 500 };
  }
};

exports.config = { schedule: '30 10 * * *' };
