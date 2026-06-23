/* ════════════════════════════════════════════════════════════════════
   RAIL-V1 — the universal right-side slide-out.  Productionizes
   mock-right-rail-v1.html.  PHASE 1 ships the shell + the live Feed tab;
   Sheet / Codex / Settings are placeholder tabs wired in later phases.

   Mounted once on every authenticated page (nav.js injects this script
   after the session resolves — see mountRail() there).  Like the HUD, it
   rides along everywhere and defaults COLLAPSED to a handle on the right
   edge; the user's open/closed state + active tab persist.

   REUSE, not reinvention:
     • window.__tok.sb / .session / .ready / .profile  ← nav.js (the ONE
       authenticated Supabase client — never construct a second).
     • feed-render.js (FEED-RENDER-V1)  ← the shared row renderer combat.html
       and chronicle already use; we self-inject it if a page lacks it.
     • the `feed` / `campaign` / `encounters` tables  ← the same rows the
       battle map streams; this is just a third reader/writer of them.
     • window.__battle RS seam (toggleRS/getRS/onRSChange)  ← battle.js, on
       the play pages.  Absent (e.g. a sheet-only page) → the mod pills mute
       and the rest of the feed still works.

   The feed LOGIC below mirrors combat.html's proven implementation,
   trimmed of the dock/ticker/encounter-scoped machinery the rail doesn't
   have.  Deliberately a self-contained copy so combat.html stays UNTOUCHED
   this phase; phase 3 (combat.html migrates onto the rail) is the natural
   point to extract one shared feed-core both consume.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__tokRail) return;                 // once per page
  var RAIL = window.__tokRail = { open: false, tab: 'feed', built: false };

  var LS_KEY = 'tok.rail.v1';
  var RAIL_W = 384;

  // ── dependency bootstrap (idempotent) ──────────────────────────────
  function linkOnce(id, attrs) {
    if (document.getElementById(id)) return;
    var l = document.createElement('link');
    l.id = id; Object.keys(attrs).forEach(function (k) { l.setAttribute(k, attrs[k]); });
    document.head.appendChild(l);
  }
  function ensureDeps(after) {
    // Fonts the v11 look needs (the Phantom pages don't load Playfair/Oswald).
    linkOnce('tok-rail-fonts-pre1', { rel: 'preconnect', href: 'https://fonts.googleapis.com' });
    linkOnce('tok-rail-fonts-pre2', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' });
    linkOnce('tok-rail-fonts', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;0,900;1,600&family=EB+Garamond:ital@0;1&family=Oswald:wght@300;400;500;600&display=swap' });
    linkOnce('tok-rail-css', { rel: 'stylesheet', href: 'rail.css' });
    if (window.FeedRender) { after(); return; }
    var s = document.createElement('script');
    s.src = 'feed-render.js';
    s.onload = after;
    s.onerror = function () { console.warn('[rail] feed-render.js failed to load — feed disabled'); after(); };
    document.head.appendChild(s);
  }

  // ── wait for nav's authenticated client ────────────────────────────
  function whenReady(cb) {
    if (window.__tok && window.__tok.sb) { cb(); return; }
    document.addEventListener('nav:ready', function once() {
      document.removeEventListener('nav:ready', once);
      if (window.__tok && window.__tok.sb) cb();
    });
  }

  whenReady(function () { ensureDeps(function () { boot(); }); });

  // ════════════════════════════════════════════════════════════════════
  function boot() {
    var SB = window.__tok.sb;
    var ME = { userId: null, characterKey: null, role: null };
    var IS_STAFF = false;

    // ── feed state ──
    var FEED = [], feedListEl = null, feedTab = 'combat', feedPostHidden = false;
    var CTX = { session: 0, encId: null, encName: '', at: 0 };
    var FR = null, FEEDRT = null;

    var esc = window.FeedRender ? window.FeedRender.escapeHtml : function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var strip = window.FeedRender ? window.FeedRender.stripTags : function (s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, ''); };

    function feedActor() {
      var key = ME.characterKey || null;
      var name = (key && typeof CHARACTERS !== 'undefined' && CHARACTERS[key] && CHARACTERS[key].name)
        || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Dungeon Master');
      return { key: key, name: name };
    }
    // Mirror the feed RLS so the ✕ only shows where a delete will succeed:
    // staff anything; authors their own (non-hidden) chronicle rows.
    function canDeleteRow(row) {
      if (IS_STAFF) return true;
      return !!(ME.userId && row.author_id === ME.userId && row.channel === 'chronicle' && !row.hidden);
    }
    function feedDelete(id) {
      if (!confirm('Delete this feed entry? This cannot be undone.')) return;
      SB.from('feed').delete().eq('id', id).then(function (r) {
        if (r && r.error) { alert('Delete failed: ' + r.error.message); return; }
        onFeedDelete(id);
      });
    }
    function renderFeed() {
      if (!feedListEl || !FR) return;
      var rows = FEED.filter(function (r) { return IS_STAFF || !r.hidden; });
      rows = rows.filter(function (r) { return (r.channel || 'combat') === feedTab; });
      rows = rows.slice().sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
      feedListEl.innerHTML = rows.length
        ? rows.map(FR.rowHtml).join('')
        : '<div class="feed-empty">No ' + feedTab + ' entries yet.</div>';
      feedListEl.scrollTop = feedListEl.scrollHeight;
    }
    function onFeedInsert(row) {
      if (!row || row.kind === 'event' || FEED.some(function (r) { return r.id === row.id; })) return;
      FEED.push(row);
      if (FEED.length > 250) FEED.shift();
      renderFeed();
      if (!RAIL.open || RAIL.tab !== 'feed') flagUnread(true);
    }
    function onFeedUpdate(row) {
      if (!row) return;
      var i = FEED.findIndex(function (r) { return r.id === row.id; });
      if (i >= 0) { FEED[i] = row; renderFeed(); }
    }
    function onFeedDelete(id) {
      var n = FEED.length;
      FEED = FEED.filter(function (r) { return r.id !== id; });
      if (FEED.length !== n) renderFeed();
    }

    // session + active encounter — stamped onto inserts, shown in the header.
    function loadContext() {
      if (Date.now() - CTX.at < 30000) return Promise.resolve(CTX);
      return Promise.all([
        SB.from('campaign').select('current_session').eq('id', 1).maybeSingle(),
        SB.from('encounters').select('id, name').eq('status', 'active').maybeSingle()
      ]).then(function (res) {
        if (res[0] && res[0].data) CTX.session = res[0].data.current_session;
        if (res[1] && res[1].data) { CTX.encId = res[1].data.id; CTX.encName = res[1].data.name || ''; }
        else { CTX.encId = null; CTX.encName = ''; }
        CTX.at = Date.now();
        paintHeader();
        return CTX;
      }).catch(function () { CTX.at = Date.now(); return CTX; });
    }
    function initFeedRealtime() {
      // Distinct channel name from combat.html's 'feed-live' so the two never
      // collide if both ever live on one page.
      FEEDRT = SB.channel('rail-feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed' }, function (p) { if (p.new) onFeedInsert(p.new); })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'feed' }, function (p) { if (p.new) onFeedUpdate(p.new); })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'feed' }, function (p) { if (p.old && p.old.id != null) onFeedDelete(p.old.id); })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign' }, function (p) { if (p.new) { CTX.session = p.new.current_session; paintHeader(); } })
        .subscribe();
    }
    function loadFeed() {
      SB.from('feed').select('*').neq('kind', 'event').order('created_at', { ascending: false }).limit(120).then(function (r) {
        if (r && r.error) { console.warn('[rail] feed load failed:', r.error.message); return; }
        (r.data || []).forEach(function (row) { if (!FEED.some(function (x) { return x.id === row.id; })) FEED.push(row); });
        renderFeed();
      });
    }
    function feedInsert(partial) {
      var a = feedActor();
      loadContext().then(function (c) {
        var row = Object.assign(
          { actor_key: a.key, actor_name: a.name, channel: 'combat', kind: 'roll', hidden: false,
            encounter_id: c.encId, session: c.session },
          partial);
        return SB.from('feed').insert(row);
      }).then(function (r) { if (r && r.error) console.warn('[rail] feed insert failed:', r.error.message); });
    }

    // ── dice (NdM, +K, multiple terms, khN/klN) — combat.html's parser ──
    function parseDice(expr) {
      var clean = String(expr || '').trim().replace(/\s+/g, '');
      if (!clean || !/^[0-9dk hl+\-]+$/i.test(clean)) return null;
      var re = /([+-]?)(\d*)d(\d+)(k[hl]\d+)?|([+-]?\d+)/gi;
      var m, total = 0, parts = [], anyDice = false, consumed = 0;
      while ((m = re.exec(clean)) !== null) {
        consumed += m[0].length;
        if (m[3] === undefined) { var f = parseInt(m[5], 10); total += f; parts.push({ flat: f }); continue; }
        anyDice = true;
        var sign = m[1] === '-' ? -1 : 1;
        var n = m[2] ? parseInt(m[2], 10) : 1, sides = parseInt(m[3], 10);
        if (n < 1 || n > 100 || sides < 2 || sides > 1000) return null;
        var rolls = Array.from({ length: n }, function () { return Math.floor(Math.random() * sides) + 1; });
        var kept = rolls.slice();
        if (m[4]) {
          var keepN = Math.max(1, parseInt(m[4].slice(2), 10));
          var sorted = rolls.slice().sort(function (a, b) { return b - a; });
          kept = m[4][1].toLowerCase() === 'h' ? sorted.slice(0, keepN) : sorted.slice(-keepN);
        }
        total += kept.reduce(function (a, b) { return a + b; }, 0) * sign;
        parts.push({ sides: sides, rolls: rolls, kept: kept, sign: sign });
      }
      if (!anyDice || consumed !== clean.length) return null;
      return { total: total, parts: parts, formula: clean };
    }
    function dicePieces(parsed) {
      return parsed.parts.map(function (p) {
        if (p.flat !== undefined) return (p.flat >= 0 ? '+ ' : '− ') + Math.abs(p.flat);
        var keptCopy = p.kept.slice();
        var shown = p.rolls.map(function (r) { var i = keptCopy.indexOf(r); if (i >= 0) { keptCopy.splice(i, 1); return '<span class="ft-die">' + r + '</span>'; } return '<span class="ft-drop">' + r + '</span>'; }).join(' ');
        return (p.sign < 0 ? '− ' : '') + '[' + shown + ']';
      }).join(' ');
    }
    function diceBody(parsed) {
      return esc(parsed.formula) + ' → ' + dicePieces(parsed) + ' = <span class="ft-tot">' + parsed.total + '</span>';
    }
    function getRS() { return (window.__battle && window.__battle.getRS) ? window.__battle.getRS() : null; }
    function feedRollWithMods(n, d) {
      var rs = getRS();
      var formula = n + 'd' + d;
      if (rs && d === 20 && n === 1 && (rs.advantage || rs.disadvantage)) formula = rs.advantage ? '2d20kh1' : '2d20kl1';
      var parsed = parseDice(formula);
      if (!parsed) return;
      var total = parsed.total, extra = '', dbFormula = formula;
      if (rs && d === 20) {
        if (rs.bless) { var b = Math.floor(Math.random() * 4) + 1; total += b; extra += ' + [<span class="ft-die">' + b + '</span>]🙏'; dbFormula += '+1d4'; }
        if (rs.guidance) { var g = Math.floor(Math.random() * 4) + 1; total += g; extra += ' + [<span class="ft-die">' + g + '</span>]✦'; dbFormula += '+1d4'; }
      }
      var body = esc(formula) + ' → ' + dicePieces(parsed) + extra + ' = <span class="ft-tot">' + total + '</span>';
      feedInsert({ channel: 'combat', kind: 'roll', formula: dbFormula, result: { total: total }, body: body, hidden: feedPostHidden && IS_STAFF });
    }
    function feedSubmit(raw) {
      var t = String(raw || '').trim(); if (!t) return;
      var staffHide = feedPostHidden && IS_STAFF;
      var cmd = t.match(/^\/(roll|r)\s+(.+)$/i);
      if (cmd) {
        var parsed = parseDice(cmd[2]);
        if (parsed) { feedInsert({ channel: 'combat', kind: 'roll', formula: parsed.formula, result: { total: parsed.total }, body: diceBody(parsed), hidden: staffHide }); return; }
      }
      feedInsert({ channel: 'chronicle', kind: 'message', body: esc(t), hidden: staffHide });
    }

    // ════════════════════════════════════════════════════════════════
    // DOM
    var root, handle, lightbox, lbImg, headTitleEl;

    function svg(paths, extra) { return '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.3"' + (extra || '') + '>' + paths + '</svg>'; }

    function buildRail() {
      root = document.createElement('aside');
      root.id = 'tok-rail';
      root.className = 'tr-collapsed';
      var hasRS = !!getRS();
      if (!hasRS) root.classList.add('tr-no-rs');

      var hideBtn = IS_STAFF ? '<button class="tr-hide" title="Post hidden (DM only)">hide</button>' : '';

      root.innerHTML =
        '<div class="tr-head">'
          + '<div class="tr-ses"><div class="k">Session ' + (CTX.session || '—') + '</div><div class="t" data-rail="title">The Chronicle</div></div>'
          + '<div class="tr-ico"><button data-rail="collapse" title="Collapse">' + svg('<path d="M10 3 L6 9 L10 15"/>', ' viewBox="0 0 18 18"') + '</button></div>'
        + '</div>'
        + '<div class="tr-tabs">'
          + '<button class="tr-tab on" data-rail-tab="feed">' + svg('<path d="M3 4h12M3 8h12M3 12h8"/>') + '<span>Feed</span></button>'
          + '<button class="tr-tab" data-rail-tab="sheet">' + svg('<rect x="4" y="2.5" width="10" height="13"/><path d="M6.5 6h5M6.5 9h5M6.5 12h3"/>') + '<span>Sheet</span></button>'
          + '<button class="tr-tab future" title="Coming later">' + svg('<path d="M4 3.5h8l2 2v9H4z"/><path d="M4 3.5v11"/>') + '<span>Codex</span></button>'
          + '<button class="tr-tab future" title="Coming later">' + svg('<circle cx="9" cy="9" r="2.4"/><path d="M9 2.5v2M9 13.5v2M2.5 9h2M13.5 9h2"/>') + '<span>Settings</span></button>'
        + '</div>'
        + '<div class="tr-panes">'
          + '<section class="tr-pane on" data-rail-pane="feed">'
            + '<div class="tr-chan"><button class="on" data-rail-chan="combat">Combat</button><button data-rail-chan="chronicle">Chronicle</button></div>'
            + '<div class="tr-mods">'
              + '<button class="tr-mod" data-m="advantage">Advantage</button>'
              + '<button class="tr-mod" data-m="disadvantage">Disadvantage</button>'
              + '<button class="tr-mod" data-m="bless">Bless</button>'
              + '<button class="tr-mod" data-m="guidance">Guidance</button>'
            + '</div>'
            + '<div class="tr-feed" data-rail="feedlist"></div>'
            + '<div class="tr-composer">' + hideBtn
              + '<input type="text" maxlength="300" placeholder="/roll 2d20kh1+5 or say something…">'
              + '<button class="tr-send" data-rail="dicebtn" title="Roll dice"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><circle cx="5.5" cy="5.5" r=".9" fill="currentColor"/><circle cx="10.5" cy="5.5" r=".9" fill="currentColor"/><circle cx="8" cy="8" r=".9" fill="currentColor"/><circle cx="5.5" cy="10.5" r=".9" fill="currentColor"/><circle cx="10.5" cy="10.5" r=".9" fill="currentColor"/></svg></button>'
              + '<button class="tr-send" data-rail="sendbtn" title="Send"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 8l12-5-5 12-2-5z"/></svg></button>'
            + '</div>'
          + '</section>'
          + '<section class="tr-pane" data-rail-pane="sheet">'
            + '<div class="tr-soon">' + svg('<rect x="4" y="2.5" width="10" height="13"/><path d="M6.5 6h5M6.5 9h5M6.5 12h3"/>', ' width="30" height="30"')
              + '<div class="h">Your character, on call</div>'
              + '<div class="p">The at-a-glance sheet mounts here next — the same one the standalone page and the combat float use, reflowed to the rail.</div></div>'
          + '</section>'
          + '<section class="tr-pane" data-rail-pane="codex"><div class="tr-soon"><div class="h">Codex</div><div class="p">Lore, rules, and references — coming in a later pass.</div></div></section>'
          + '<section class="tr-pane" data-rail-pane="settings"><div class="tr-soon"><div class="h">Settings</div><div class="p">Appearance and preferences — coming in a later pass.</div></div></section>'
        + '</div>';
      document.body.appendChild(root);

      handle = document.createElement('div');
      handle.className = 'tr-handle';
      handle.title = 'Feed & sheet';
      handle.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2 L4 6 L8 10"/></svg>';
      document.body.appendChild(handle);

      lightbox = document.createElement('div');
      lightbox.className = 'tr-lightbox';
      lightbox.innerHTML = '<img alt="">';
      document.body.appendChild(lightbox);
      lbImg = lightbox.querySelector('img');

      feedListEl = root.querySelector('[data-rail="feedlist"]');
      headTitleEl = root.querySelector('[data-rail="title"]');
    }

    function flagUnread(on) {
      if (handle) handle.classList.toggle('tr-unread', on);
    }
    function paintHeader() {
      if (!root) return;
      var kEl = root.querySelector('.tr-ses .k');
      if (kEl) kEl.textContent = 'Session ' + (CTX.session || '—');
      if (headTitleEl) headTitleEl.textContent = CTX.encName || 'The Chronicle';
    }

    // ── open/collapse + tabs + persistence ──
    function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify({ open: RAIL.open, tab: RAIL.tab })); } catch (e) {} }
    function restore() { try { var s = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); if (typeof s.open === 'boolean') RAIL.open = s.open; if (s.tab) RAIL.tab = s.tab; } catch (e) {} }
    function applyOpen() {
      root.classList.toggle('tr-collapsed', !RAIL.open);
      handle.classList.toggle('tr-open', RAIL.open);
      if (RAIL.open) flagUnread(false);
    }
    function setOpen(v) { RAIL.open = v; applyOpen(); persist(); }
    function setTab(name) {
      RAIL.tab = name;
      root.querySelectorAll('.tr-tab[data-rail-tab]').forEach(function (t) { t.classList.toggle('on', t.dataset.railTab === name); });
      root.querySelectorAll('.tr-pane[data-rail-pane]').forEach(function (p) { p.classList.toggle('on', p.dataset.railPane === name); });
      if (name === 'feed') { flagUnread(false); renderFeed(); }
      persist();
    }

    function wireShell() {
      handle.addEventListener('click', function () { setOpen(!RAIL.open); });
      root.querySelector('[data-rail="collapse"]').addEventListener('click', function () { setOpen(false); });
      root.querySelectorAll('.tr-tab[data-rail-tab]').forEach(function (t) {
        t.addEventListener('click', function () { if (!t.classList.contains('future')) setTab(t.dataset.railTab); });
      });
    }

    function wireFeed() {
      // mods → battle.js RS seam; repaint on any toggle source.
      function paintMods(rs) {
        if (!rs) return;
        root.querySelectorAll('.tr-mod').forEach(function (b) { b.classList.toggle('on', !!rs[b.dataset.m]); });
      }
      root.querySelectorAll('.tr-mod').forEach(function (b) {
        b.addEventListener('click', function () {
          if (window.__battle && window.__battle.toggleRS) window.__battle.toggleRS(b.dataset.m);
        });
      });
      window.__battle = window.__battle || {};
      var prevRS = window.__battle.onRSChange;
      window.__battle.onRSChange = function (rs) { paintMods(rs); if (typeof prevRS === 'function') prevRS(rs); };
      if (getRS()) paintMods(getRS());

      // channel toggle (Combat / Chronicle)
      root.querySelectorAll('[data-rail-chan]').forEach(function (b) {
        b.addEventListener('click', function () {
          feedTab = b.dataset.railChan;
          root.querySelectorAll('[data-rail-chan]').forEach(function (x) { x.classList.toggle('on', x === b); });
          renderFeed();
        });
      });

      // composer: enter, send button, dice button (prefill /roll), hide toggle
      var inp = root.querySelector('.tr-composer input');
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); feedSubmit(inp.value); inp.value = ''; } });
      root.querySelector('[data-rail="sendbtn"]').addEventListener('click', function () { feedSubmit(inp.value); inp.value = ''; inp.focus(); });
      root.querySelector('[data-rail="dicebtn"]').addEventListener('click', function () {
        if (!/^\/(roll|r)\b/i.test(inp.value)) inp.value = '/roll ' + inp.value.trim() + (inp.value.trim() ? '' : '1d20');
        inp.focus();
      });
      var hide = root.querySelector('.tr-hide');
      if (hide) hide.addEventListener('click', function () { feedPostHidden = !feedPostHidden; hide.classList.toggle('on', feedPostHidden); });

      // delegated: row delete + image lightbox (rows re-render constantly)
      function closeLb() { lightbox.classList.remove('open'); setTimeout(function () { lbImg.src = ''; }, 200); document.removeEventListener('keydown', lbKey); }
      function lbKey(e) { if (e.key === 'Escape') closeLb(); }
      lightbox.addEventListener('click', function (e) { if (e.target !== lbImg) closeLb(); });
      feedListEl.addEventListener('click', function (e) {
        var del = e.target.closest('.feed-del');
        if (del) { feedDelete(Number(del.dataset.del)); return; }
        var img = e.target.closest('.feed-text img');
        if (img && img.src) { lbImg.src = img.src; lightbox.classList.add('open'); document.addEventListener('keydown', lbKey); }
      });
    }

    // ════════════════════════════════════════════════════════════════
    Promise.resolve(window.__tok.ready).then(function (profile) {
      if (profile) { ME.userId = profile.userId; ME.characterKey = profile.characterKey; ME.role = profile.role; }
      IS_STAFF = ME.role === 'overseer' || ME.role === 'dm';

      FR = window.FeedRender ? window.FeedRender.create({
        characters: typeof CHARACTERS !== 'undefined' ? CHARACTERS : {},
        canDelete: canDeleteRow
      }) : null;

      restore();
      buildRail();
      applyOpen();
      setTab(RAIL.tab);
      wireShell();
      wireFeed();
      RAIL.built = true;

      loadContext();
      loadFeed();
      initFeedRealtime();

      // expose a tiny API (parity with CombatSheets/AppearanceUI conventions)
      window.TokRail = {
        open: function () { setOpen(true); },
        close: function () { setOpen(false); },
        toggle: function () { setOpen(!RAIL.open); },
        show: function (tab) { if (tab) setTab(tab); setOpen(true); }
      };
    });
  }
})();
