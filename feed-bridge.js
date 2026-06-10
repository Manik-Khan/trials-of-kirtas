// feed-bridge.js — cross-page roll logging into the shared game feed.
//
// battle.js's HUD mounts on every page, but its logRoll seam was only wired on
// combat.html (whose combatants backend provides it). This bridge gives every
// OTHER page a lite hook: HUD rolls post into the Supabase `feed` (combat
// channel), stamped with the current session and the active encounter — so a
// roll made from the character sheet or the world map lands in the same live
// log everyone sees on the battle map.
//
// Load AFTER battle.js on every page EXCEPT combat.html. (Even if combat.html
// loaded it by mistake, nothing breaks: battle.js checks the backend's own
// logRoll first, and that wins.)
//
// Requires nav.js (the authenticated Supabase client at window.__tok.sb).

(function () {
  'use strict';

  function ready(cb) {
    if (window.__tok && window.__tok.sb) { cb(); return; }
    document.addEventListener('nav:ready', function once() {
      document.removeEventListener('nav:ready', once);
      cb();
    });
  }

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var strip = function (s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, ''); };

  ready(function () {
    var sb = window.__tok.sb;

    // Session + active encounter, cached briefly so each roll is stamped with
    // fresh context (an encounter can start mid-browse) without querying twice
    // per click.
    var ctx = { session: 0, encId: null, at: 0 };
    function freshCtx() {
      if (Date.now() - ctx.at < 30000) return Promise.resolve(ctx);
      return Promise.all([
        sb.from('campaign').select('current_session').eq('id', 1).maybeSingle(),
        sb.from('encounters').select('id').eq('status', 'active').maybeSingle(),
      ]).then(function (res) {
        if (res[0].data) ctx.session = res[0].data.current_session;
        ctx.encId = res[1].data ? res[1].data.id : null;
        ctx.at = Date.now();
        return ctx;
      }).catch(function (err) {
        console.warn('[feed-bridge] context load failed:', err);
        ctx.at = Date.now();   // don't hammer on repeated failures
        return ctx;
      });
    }
    freshCtx();   // warm the cache at page load

    window.__battle = window.__battle || {};
    window.__battle.onLogRoll = function (o) {
      var key = (o && o.actorKey !== undefined) ? o.actorKey : null;
      var name = (key && typeof CHARACTERS !== 'undefined' && CHARACTERS[key] && CHARACTERS[key].name)
        || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Dungeon Master');
      // Same body format combat.html's feedLogRoll produces, so the feed
      // renders these rows identically wherever they were rolled from.
      var body = esc(strip((o && o.name) || 'Roll')) + ': ' + strip((o && o.main) || '')
        + (o && o.dmg ? ' · ' + strip(o.dmg) : '');
      freshCtx().then(function (c) {
        return sb.from('feed').insert({
          channel: 'combat', kind: 'roll',
          actor_key: key, actor_name: name,
          body: body, hidden: false,
          session: c.session, encounter_id: c.encId,
        });
      }).then(function (res) {
        if (res && res.error) console.warn('[feed-bridge] insert failed:', res.error.message);
      });
    };
  });
})();
