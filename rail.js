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
     • mention-composer.js (dynamic import)  ← the shared writing surface:
       live @ mentions + tabbed [[wikilinks]] (My notes / All), body via
       docToFeedBody.  Import failure → plain-input fallback (the pre-swap
       composer, verbatim).  Pool/canon load LAZILY on first editor focus.
       Table chat never seeds entity stubs (typo guard) — chips render,
       the curation queue stays clean.
     • journal-capture.js insertPage/insertRefs/freeSlug  ← the row menu's
       "Send to my journal" (click a feed name/avatar): any row becomes a
       Field Notes page in YOUR vault, attributed when it isn't yours.

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
  var RAIL_ASSET_V = 'section1';

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
    linkOnce('tok-rail-css', { rel: 'stylesheet', href: 'rail.css?v=' + RAIL_ASSET_V });
    // Characters roster tab — registers itself against the seam on tok-rail:ready.
    // Loaded non-blocking (boot doesn't wait on it); it handles either load order.
    if (!window.__tokCharactersTab && !document.querySelector('script[src*="characters-tab.js"]')) {
      var ct = document.createElement('script'); ct.src = 'characters-tab.js?v=touch2';
      ct.onerror = function () { console.warn('[rail] characters-tab.js failed to load'); };
      document.head.appendChild(ct);
    }
    // Bardic remote tab + corner chip — registers itself against the seam on
    // tok-rail:ready (same rider pattern as characters-tab.js). Non-blocking.
    if (!window.__tokBardicTab && !document.querySelector('script[src$="bardic-tab.js"]')) {
      var bt = document.createElement('script'); bt.src = 'bardic-tab.js';
      bt.onerror = function () { console.warn('[rail] bardic-tab.js failed to load'); };
      document.head.appendChild(bt);
    }
    // Appearance customizer — fills the built-in Settings pane on tok-rail:ready and
    // routes its live preview onto the floating sheet. ES module; non-blocking.
    if (!window.AppearanceSettings && !document.querySelector('script[src$="appearance-settings.js"]')) {
      var ap = document.createElement('script'); ap.type = 'module'; ap.src = 'appearance-settings.js';
      ap.onerror = function () { console.warn('[rail] appearance-settings.js failed to load'); };
      document.head.appendChild(ap);
    }
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
    var CTX = { session: 0, sessionTitle: '', encId: null, encName: '', at: 0 };
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
      // stamp ids for the row menu (render order === rows order)
      if (rows.length) {
        var kids = feedListEl.querySelectorAll('.feed-row');
        rows.forEach(function (r, i) { if (kids[i]) kids[i].setAttribute('data-row-id', r.id); });
      }
      // mention chips in message bodies get hover cards once tooltips.js is up
      if (window.attachTooltips) { try { window.attachTooltips(feedListEl); } catch (e) {} }
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
        SB.from('encounters').select('id, name').eq('status', 'active').maybeSingle(),
        SB.from('session_titles').select('session, title')
      ]).then(function (res) {
        if (res[0] && res[0].data) CTX.session = res[0].data.current_session;
        if (res[1] && res[1].data) { CTX.encId = res[1].data.id; CTX.encName = res[1].data.name || ''; }
        else { CTX.encId = null; CTX.encName = ''; }
        CTX.sessionTitle = '';
        if (res[2] && !res[2].error) {
          var titleRow = (res[2].data || []).find(function (r) { return r.session == CTX.session; });
          if (titleRow) CTX.sessionTitle = titleRow.title || '';
        }
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
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign' }, function (p) {
          if (p.new) { CTX.session = p.new.current_session; CTX.at = 0; loadContext(); }
        })
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
      return loadContext().then(function (c) {
        var row = Object.assign(
          { actor_key: a.key, actor_name: a.name, channel: 'combat', kind: 'roll', hidden: false,
            encounter_id: c.encId, session: c.session },
          partial);
        return SB.from('feed').insert(row);
      }).then(function (r) {
        if (r && r.error) console.warn('[rail] feed insert failed:', r.error.message);
        return r;
      }).catch(function (e) {
        console.warn('[rail] feed insert failed:', e && e.message);
        return { error: e || new Error('Feed insert failed') };
      });
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
    // (feedSubmit lives in wireFeed's submitSurface now — one routing path
    // for both the composer and the fallback input.)

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
      var sectionControl = IS_STAFF
        ? '<div class="tr-section-control"><button type="button" data-rail="newsection">+ New Section</button><span>Adds an outline marker</span></div>'
        : '';
      var sectionDialog = IS_STAFF
        ? '<div class="tr-section-veil" data-rail="sectionveil">'
            + '<section class="tr-section-dialog" role="dialog" aria-modal="true" aria-labelledby="tr-section-title">'
              + '<div class="tr-section-head"><div class="k">Chronicle structure</div><h2 id="tr-section-title">Mark a new section</h2><p>Adds a shared heading at this point in the current session and to the Chronicle book’s outline.</p></div>'
              + '<form class="tr-section-body" data-rail="sectionform">'
                + '<span class="tr-section-chip" data-rail="sectionchip">Session —</span>'
                + '<label for="tr-section-input">Section heading</label>'
                + '<input id="tr-section-input" data-rail="sectioninput" maxlength="80" autocomplete="off" placeholder="The Parlay">'
                + '<div class="tr-section-note" data-rail="sectionnote">Keep it brief—this becomes an outline label.</div>'
                + '<div class="tr-section-preview"><div class="l">How it will read</div><div class="v" data-rail="sectionpreview">Section heading</div></div>'
                + '<div class="tr-section-actions"><button type="button" data-rail="sectioncancel">Cancel</button><button class="primary" type="submit" data-rail="sectioninsert">Insert section</button></div>'
              + '</form>'
            + '</section>'
          + '</div>'
        : '';

      root.innerHTML =
        '<div class="tr-head">'
          + '<div class="tr-ses"><div class="k">Session ' + (CTX.session || '—') + '</div><div class="t" data-rail="title">The Chronicle</div></div>'
          + '<div class="tr-ico"><button data-rail="collapse" title="Collapse">' + svg('<path d="M10 3 L6 9 L10 15"/>', ' viewBox="0 0 18 18"') + '</button></div>'
        + '</div>'
        + '<div class="tr-tabs">'
          + '<button class="tr-tab on" data-rail-tab="feed" data-order="10">' + svg('<path d="M3 4h12M3 8h12M3 12h8"/>') + '<span>Feed</span></button>'
          + '<button class="tr-tab future" data-order="80" title="Coming later">' + svg('<path d="M4 3.5h8l2 2v9H4z"/><path d="M4 3.5v11"/>') + '<span>Codex</span></button>'
          + '<button class="tr-tab" data-rail-tab="settings" data-order="90">' + svg('<circle cx="9" cy="9" r="2.4"/><path d="M9 2.5v2M9 13.5v2M2.5 9h2M13.5 9h2"/>') + '<span>Settings</span></button>'
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
            + sectionControl
            + '<div class="tr-composer">' + hideBtn
              + '<div class="tr-mc-host" data-rail="mchost"><div class="mc-count" data-rail="mccount"></div></div>'
              + '<button class="tr-send" data-rail="dicebtn" title="Roll dice"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><circle cx="5.5" cy="5.5" r=".9" fill="currentColor"/><circle cx="10.5" cy="5.5" r=".9" fill="currentColor"/><circle cx="8" cy="8" r=".9" fill="currentColor"/><circle cx="5.5" cy="10.5" r=".9" fill="currentColor"/><circle cx="10.5" cy="10.5" r=".9" fill="currentColor"/></svg></button>'
              + '<button class="tr-send" data-rail="sendbtn" title="Send"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 8l12-5-5 12-2-5z"/></svg></button>'
            + '</div>'
          + '</section>'
          + '<section class="tr-pane" data-rail-pane="codex"><div class="tr-soon"><div class="h">Codex</div><div class="p">Lore, rules, and references — coming in a later pass.</div></div></section>'
          + '<section class="tr-pane" data-rail-pane="settings"><div class="tr-soon"><div class="h">Settings</div><div class="p">Appearance and preferences — coming in a later pass.</div></div></section>'
        + '</div>';
      root.innerHTML += sectionDialog;
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

    // ── tabs: built-in (feed/sheet/…) + page-registered contextual ──
    var contextTabs = {};   // id → spec
    function applyTab(name) {
      root.querySelectorAll('.tr-tab[data-rail-tab]').forEach(function (t) { t.classList.toggle('on', t.dataset.railTab === name); });
      root.querySelectorAll('.tr-pane[data-rail-pane]').forEach(function (p) { p.classList.toggle('on', p.dataset.railPane === name); });
      if (name === 'feed') { flagUnread(false); renderFeed(); }
    }
    function setTab(name) {
      var prev = RAIL.tab;
      if (prev !== name && contextTabs[prev] && typeof contextTabs[prev].onHide === 'function') { try { contextTabs[prev].onHide(); } catch (e) {} }
      RAIL.tab = name;
      applyTab(name);
      if (contextTabs[name] && typeof contextTabs[name].onShow === 'function') { try { contextTabs[name].onShow(); } catch (e) {} }
      persist();
    }

    // Register a page-specific tab. Pages call this once window.TokRail.ready
    // (or in response to the `tok-rail:ready` event). spec:
    //   { id, label, icon(svgString), order=50, onMount(paneEl), onShow?(), onHide?() }
    // The rail owns the tab button, the pane slot, and show/hide; the PAGE owns
    // the pane's contents (it fills paneEl in onMount). Re-registering an id
    // replaces it. This is the same seam the combat tabs (Tracker / Bestiary /
    // Scenes) and the global Compendium will ride on — Marks is just the first.
    function registerTab(spec) {
      if (!spec || !spec.id || !root) return null;
      var id = spec.id;
      spec.order = (typeof spec.order === 'number') ? spec.order : 50;
      contextTabs[id] = spec;

      var prevBtn = root.querySelector('.tr-tab[data-rail-tab="' + id + '"]'); if (prevBtn) prevBtn.remove();
      var prevPane = root.querySelector('.tr-pane[data-rail-pane="' + id + '"]'); if (prevPane) prevPane.remove();

      var tabs = root.querySelector('.tr-tabs');
      var btn = document.createElement('button');
      btn.className = 'tr-tab';
      btn.setAttribute('data-rail-tab', id);
      btn.setAttribute('data-order', spec.order);
      btn.innerHTML = (spec.icon || svg('<circle cx="9" cy="9" r="5"/>')) + '<span>' + esc(spec.label || id) + '</span>';
      var after = Array.prototype.find.call(tabs.children, function (c) { return Number(c.dataset.order || 50) > spec.order; });
      tabs.insertBefore(btn, after || null);
      btn.addEventListener('click', function () { setTab(id); });

      var pane = document.createElement('section');
      pane.className = 'tr-pane';
      pane.setAttribute('data-rail-pane', id);
      root.querySelector('.tr-panes').appendChild(pane);

      if (typeof spec.onMount === 'function') { try { spec.onMount(pane); } catch (e) { console.warn('[rail] tab onMount failed:', id, e); } }
      if (RAIL.tab === id) setTab(id);   // restore a persisted contextual tab on reload
      return { pane: pane, button: btn };
    }
    function unregisterTab(id) {
      delete contextTabs[id];
      var b = root.querySelector('.tr-tab[data-rail-tab="' + id + '"]'); if (b) b.remove();
      var p = root.querySelector('.tr-pane[data-rail-pane="' + id + '"]'); if (p) p.remove();
      if (RAIL.tab === id) setTab('feed');
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
          paintSectionControl();
          renderFeed();
        });
      });

      // Staff can mark structural beats from the shared Chronicle composer.
      // The target is always the campaign's current session, narrated in the
      // display-only chip. Section rows are deliberately not encounter-bound.
      var sectionControl = root.querySelector('.tr-section-control');
      var sectionVeil = root.querySelector('[data-rail="sectionveil"]');
      var sectionInput = root.querySelector('[data-rail="sectioninput"]');
      var sectionNote = root.querySelector('[data-rail="sectionnote"]');
      var sectionPreview = root.querySelector('[data-rail="sectionpreview"]');
      var sectionInsert = root.querySelector('[data-rail="sectioninsert"]');
      var sectionCancel = root.querySelector('[data-rail="sectioncancel"]');

      function paintSectionControl() {
        if (sectionControl) sectionControl.classList.toggle('on', IS_STAFF && feedTab === 'chronicle');
      }
      function resetSectionNote() {
        if (!sectionNote) return;
        sectionNote.textContent = 'Keep it brief—this becomes an outline label.';
        sectionNote.classList.remove('error');
      }
      function updateSectionPreview() {
        if (!sectionPreview || !sectionInput) return;
        sectionPreview.textContent = sectionInput.value.trim() || 'Section heading';
        resetSectionNote();
      }
      function closeSectionDialog() {
        if (sectionVeil) sectionVeil.classList.remove('on');
      }
      function openSectionDialog() {
        if (!sectionVeil || !sectionInput) return;
        loadContext().then(function (c) {
          var chip = root.querySelector('[data-rail="sectionchip"]');
          if (chip) chip.textContent = 'Session ' + c.session + (c.sessionTitle ? ' · ' + c.sessionTitle : '');
          sectionInput.value = '';
          updateSectionPreview();
          sectionVeil.classList.add('on');
          setTimeout(function () { sectionInput.focus(); }, 0);
        });
      }
      function submitSection(event) {
        event.preventDefault();
        var title = sectionInput ? sectionInput.value.trim() : '';
        if (!title) {
          sectionNote.textContent = 'Give this section a heading before inserting it.';
          sectionNote.classList.add('error');
          sectionInput.focus();
          return;
        }
        sectionInsert.disabled = true;
        sectionCancel.disabled = true;
        sectionInsert.textContent = 'Inserting…';
        sectionNote.textContent = 'Adding this heading to the Chronicle…';
        sectionNote.classList.remove('error');
        feedInsert({
          channel: 'chronicle', kind: 'message', encounter_id: null, hidden: false,
          body: '<p><strong>' + esc(title) + '</strong></p>', meta: { section: title }
        }).then(function (r) {
          sectionInsert.disabled = false;
          sectionCancel.disabled = false;
          sectionInsert.textContent = 'Insert section';
          if (r && r.error) {
            sectionNote.textContent = 'Could not add section: ' + (r.error.message || 'write blocked');
            sectionNote.classList.add('error');
            sectionInput.focus();
            return;
          }
          closeSectionDialog();
          toast('Section added · visible in the Chronicle outline');
        });
      }

      paintSectionControl();
      if (sectionControl) sectionControl.querySelector('button').addEventListener('click', openSectionDialog);
      if (sectionInput) sectionInput.addEventListener('input', updateSectionPreview);
      if (sectionCancel) sectionCancel.addEventListener('click', closeSectionDialog);
      if (sectionVeil) sectionVeil.addEventListener('mousedown', function (e) { if (e.target === sectionVeil) closeSectionDialog(); });
      var sectionForm = root.querySelector('[data-rail="sectionform"]');
      if (sectionForm) sectionForm.addEventListener('submit', submitSection);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && sectionVeil && sectionVeil.classList.contains('on')) closeSectionDialog();
      });

      // ── the writing surface (MENTION-COMPOSER swap, with fallback) ──
      // SURF abstracts "whatever the user types into": the shared
      // mention-composer (chips, [[ tabs) when its module loads, or a plain
      // <input> — the pre-swap composer, verbatim — if the import fails.
      // Submit routing is unchanged either way: /roll → combat/roll via
      // parseDice; words → chronicle/message. The composer body is ALREADY
      // escaped html (docToFeedBody), so it skips the esc() the input needs.
      var host = root.querySelector('[data-rail="mchost"]');
      var countEl = root.querySelector('[data-rail="mccount"]');
      var SURF = null;

      function updateCount() {
        if (!countEl || !SURF) return;
        var n = SURF.text().trim().length;
        countEl.textContent = n + ' / 300';
        countEl.className = 'mc-count' + (n > 300 ? ' over' : (n > 250 ? ' warn' : ''));
      }
      function submitSurface() {
        if (!SURF) return;
        var t = SURF.text().trim();
        if (!t) return;
        if (t.length > 300) { updateCount(); SURF.shake(); return; }
        var staffHide = feedPostHidden && IS_STAFF;
        var cmd = t.match(/^\/(roll|r)\s+(.+)$/i);
        if (cmd) {
          var parsed = parseDice(cmd[2]);
          if (parsed) {
            feedInsert({ channel: 'combat', kind: 'roll', formula: parsed.formula, result: { total: parsed.total }, body: diceBody(parsed), hidden: staffHide });
            SURF.clear(); updateCount(); return;
          }
        }
        feedInsert({ channel: 'chronicle', kind: 'message', body: SURF.body(), hidden: staffHide });
        SURF.clear(); updateCount();
      }

      root.querySelector('[data-rail="sendbtn"]').addEventListener('click', function () { submitSurface(); if (SURF) SURF.focus(); });
      root.querySelector('[data-rail="dicebtn"]').addEventListener('click', function () {
        if (!SURF) return;
        var t = SURF.text();
        if (!/^\/(roll|r)\b/i.test(t)) SURF.setText('/roll ' + t.trim() + (t.trim() ? '' : '1d20'));
        SURF.focus();
      });
      var hide = root.querySelector('.tr-hide');
      if (hide) hide.addEventListener('click', function () { feedPostHidden = !feedPostHidden; hide.classList.toggle('on', feedPostHidden); });

      function mountFallbackInput() {
        var inp = document.createElement('input');
        inp.type = 'text'; inp.maxLength = 300;
        inp.placeholder = '/roll 2d20kh1+5 or say something…';
        host.insertBefore(inp, countEl);
        SURF = {
          text: function () { return inp.value; },
          body: function () { return esc(inp.value.trim()); },
          setText: function (t) { inp.value = t; },
          clear: function () { inp.value = ''; },
          focus: function () { inp.focus(); },
          shake: function () {},
        };
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submitSurface(); } });
      }

      // ── the mention pool: lazy — nothing loads until the first focus ──
      // canon (tooltips.js via ensureCanon) + entities + journal pages; the
      // [[ picker gets two tabs: My notes (your seat) / All (party-readable).
      var MC = { mod: null, mine: [], all: [], mySlugs: {}, pool: { npcs: [], locations: [] }, loaded: false, loading: false };
      function seatName(key) {
        if (!key) return 'Narrator';
        return (typeof CHARACTERS !== 'undefined' && CHARACTERS[key] && CHARACTERS[key].name) || key;
      }
      function loadMentionData(edEl) {
        if (MC.loaded || MC.loading || !MC.mod) return;
        MC.loading = true;
        Promise.all([
          MC.mod.ensureCanon(document),
          SB.from('entities').select('id, type, name, curated'),
          SB.from('journal_pages').select('author_id, character_key, title, slug, folder, updated_at')
            .order('updated_at', { ascending: false }).limit(500)
        ]).then(function (res) {
          var canon = res[0];
          var entities = (res[1] && !res[1].error && res[1].data) || [];
          var pages = (res[2] && !res[2].error && res[2].data) || [];
          MC.pool = MC.mod.buildPool(canon, entities);
          MC.all = pages.map(function (p) { return { id: p.slug, type: 'page', label: p.title, hint: seatName(p.character_key) }; });
          MC.mine = pages.filter(function (p) {
            return p.author_id === ME.userId && (p.character_key || null) === (ME.characterKey || null);
          }).map(function (p) { MC.mySlugs[p.slug] = true; return { id: p.slug, type: 'page', label: p.title, hint: p.folder || 'Unsorted' }; });
          MC.loaded = true; MC.loading = false;
          if (window.attachTooltips) { try { window.attachTooltips(feedListEl); } catch (e) {} }
          if (edEl) edEl.dispatchEvent(new Event('input', { bubbles: false }));  // repaint an open picker
        }).catch(function (e) { MC.loading = false; console.warn('[rail] mention pool load failed:', e && e.message); });
      }

      // Kill switch (window.__railPlainComposer) forces the plain input —
      // the harness uses it (jsdom can't resolve dynamic imports), and it's
      // a live escape hatch if the composer ever misbehaves in the field.
      // The timeout is patience, not failure: if the module hasn't arrived
      // in 1.5s, mount the input so the table can type; a late module is
      // then skipped (no mid-typing surface swap).
      if (window.__railPlainComposer) {
        mountFallbackInput();
      } else {
      setTimeout(function () { if (!SURF) mountFallbackInput(); }, 1500);
      import('./mention-composer.js').then(function (mod) {
        if (SURF) { console.warn('[rail] mention-composer arrived after fallback — keeping the input'); return; }
        MC.mod = mod;
        var composer = mod.createComposer(host, {
          placeholder: '/roll 2d20kh1+5, @ a name, [[ a page…',
          pool: function () { return MC.pool; },
          pageTabs: function () { return [ { id: 'mine', label: 'My notes', items: MC.mine }, { id: 'all', label: 'All', items: MC.all } ]; },
          // no onNewEntity — table chat NEVER seeds entity stubs (typo guard);
          // unresolved chips still render dashed.
        });
        host.insertBefore(countEl, null);              // keep the counter after the editor
        SURF = {
          text: function () { return composer.el.textContent.replace(/\u00a0/g, ' '); },
          body: function () { return mod.docToFeedBody(composer.getDoc()); },
          setText: function (t) {
            composer.clear(); composer.el.textContent = t;
            var r = document.createRange(); r.selectNodeContents(composer.el); r.collapse(false);
            var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
          },
          clear: function () { composer.clear(); },
          focus: function () { composer.focus(); },
          shake: function () {
            composer.el.classList.remove('mc-shake'); void composer.el.offsetWidth;
            composer.el.classList.add('mc-shake');
          },
        };
        // Enter sends; Shift+Enter is a line break (docToFeedBody joins <br>).
        // Attached AFTER the composer's own keydown, so a picker chip-insert
        // arrives here with defaultPrevented — the picker wins, no send.
        composer.el.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter' || e.defaultPrevented || e.shiftKey) return;
          e.preventDefault();
          submitSurface();
        });
        composer.el.addEventListener('input', updateCount);
        composer.el.addEventListener('focus', function () { loadMentionData(composer.el); }, true);
      }).catch(function (e) {
        console.warn('[rail] mention-composer unavailable — plain input fallback:', e && e.message);
        if (!SURF) mountFallbackInput();
      });
      }

      // ── row menu: click a name/avatar → View sheet / Open journal /
      //    Send to my journal (post-hoc capture: any row, YOUR vault) ──
      var menuEl = document.createElement('div');
      menuEl.className = 'tr-rowmenu';
      root.appendChild(menuEl);
      var toastEl = document.createElement('div');
      toastEl.className = 'tr-toast';
      root.appendChild(toastEl);
      function toast(msg) {
        toastEl.textContent = msg; toastEl.classList.add('on');
        clearTimeout(toastEl.__t); toastEl.__t = setTimeout(function () { toastEl.classList.remove('on'); }, 2600);
      }
      function closeMenu() { menuEl.classList.remove('on'); menuEl.innerHTML = ''; }
      document.addEventListener('click', function (e) { if (menuEl.classList.contains('on') && !menuEl.contains(e.target)) closeMenu(); }, true);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

      function autoTitle(text) {
        var words = String(text || '').trim().split(/\s+/).filter(Boolean);
        if (!words.length) return 'Table note';
        var t = words.slice(0, 6).join(' ');
        return words.length > 6 ? t + '…' : t;
      }
      function sendRowToJournal(row) {
        Promise.all([import('./mention-composer.js'), import('./journal-capture.js')]).then(function (mods) {
          var mc = mods[0], jc = mods[1];
          if (!MC.mod) MC.mod = mc;
          var ensureSlugs = MC.loaded ? Promise.resolve()
            : SB.from('journal_pages').select('slug').eq('author_id', ME.userId).then(function (r) {
                ((r && !r.error && r.data) || []).forEach(function (p) { MC.mySlugs[p.slug] = true; });
              });
          return ensureSlugs.then(function () {
            // feed body html → doc: the locked chip spans parse back as nodes,
            // everything else flattens to plain text. <br> is the feed's
            // paragraph separator (docToFeedBody) — pre-split it into blocks,
            // or serializeDoc reads a lone <br> as a blank line.
            var box = document.createElement('div');
            box.innerHTML = '<div>' + String(row.body || '').split(/<br\s*\/?>/i).join('</div><div>') + '</div>';
            var docJson = mc.serializeDoc(box);
            if (row.author_id !== ME.userId) {
              docJson.content.unshift({ type: 'paragraph', content: [{ type: 'text',
                text: 'Captured from ' + (row.actor_name || 'the table') + (row.session != null ? ' · Session ' + row.session : '') }] });
            }
            var title = autoTitle(strip(row.body));
            var slugSet = { has: function (s) { return !!MC.mySlugs[s]; } };
            var pageSlug = jc.freeSlug(title, slugSet);
            return jc.insertPage(SB, {
              author_id: ME.userId, character_key: ME.characterKey || null,
              folder: 'Field Notes', title: title, slug: pageSlug,
              doc: docJson, html: mc.docToHTML(docJson),
              session: row.session != null ? row.session : (CTX.session || null),
            }).then(function (page) {
              MC.mySlugs[pageSlug] = true;
              MC.mine.unshift({ id: pageSlug, type: 'page', label: title, hint: 'Field Notes' });
              return jc.insertRefs(SB, page.id, mc.docToRefs(docJson));
            }).then(function () { toast('\u2712 saved to your journal \u00b7 \u201c' + title + '\u201d'); });
          });
        }).catch(function (e) {
          console.warn('[rail] send-to-journal failed:', e && e.message);
          toast('couldn\u2019t save \u2014 ' + ((e && e.message) || 'journal unavailable'));
        });
      }
      function openRowMenu(row, anchor) {
        var isParty = row.actor_key && typeof CHARACTERS !== 'undefined' && CHARACTERS[row.actor_key];
        var html = '';
        if (isParty) html += '<button data-act="sheet">View sheet</button>';
        html += '<button data-act="journal">Open journal</button>';
        html += '<button data-act="capture">\u2712 Send to my journal</button>';
        menuEl.innerHTML = html;
        var rr = root.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
        menuEl.style.left = Math.max(8, ar.left - rr.left) + 'px';
        menuEl.style.top = (ar.bottom - rr.top + 4) + 'px';
        menuEl.classList.add('on');
        menuEl.onclick = function (e) {
          var b = e.target.closest('button'); if (!b) return;
          var act = b.dataset.act;
          closeMenu();
          if (act === 'sheet') {
            if (window.CombatSheets && typeof window.CombatSheets.open === 'function') window.CombatSheets.open(row.actor_key);
            else window.location.href = 'sheet-v2.html?character=' + encodeURIComponent(row.actor_key);
          } else if (act === 'journal') {
            window.location.href = 'journal.html' + (row.actor_key ? '?character=' + encodeURIComponent(row.actor_key) : '');
          } else if (act === 'capture') {
            sendRowToJournal(row);
          }
        };
      }

      // delegated: row menu + row delete + image lightbox (rows re-render constantly)
      function closeLb() { lightbox.classList.remove('open'); setTimeout(function () { lbImg.src = ''; }, 200); document.removeEventListener('keydown', lbKey); }
      function lbKey(e) { if (e.key === 'Escape') closeLb(); }
      lightbox.addEventListener('click', function (e) { if (e.target !== lbImg) closeLb(); });
      feedListEl.addEventListener('click', function (e) {
        var del = e.target.closest('.feed-del');
        if (del) { feedDelete(Number(del.dataset.del)); return; }
        var who = e.target.closest('.feed-av, .feed-name');
        if (who) {
          var rowEl = e.target.closest('.feed-row');
          var id = rowEl && rowEl.getAttribute('data-row-id');
          var row = id != null ? FEED.filter(function (r) { return String(r.id) === String(id); })[0] : null;
          if (row) { openRowMenu(row, who); return; }
        }
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
      // Built-in panes exist now; a persisted *contextual* tab activates when its
      // page registers it (below), so just show the feed until then.
      if (RAIL.tab === 'feed') setTab(RAIL.tab);
      else applyTab('feed');
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
        show: function (tab) { if (tab) setTab(tab); setOpen(true); },
        registerTab: registerTab,
        unregisterTab: unregisterTab,
        ready: true
      };
      // Pages register their contextual tabs in response to this (or by checking
      // window.TokRail.ready if they loaded after it fired).
      document.dispatchEvent(new CustomEvent('tok-rail:ready'));
    });
  }
})();
