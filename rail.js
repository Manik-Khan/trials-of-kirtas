/* ════════════════════════════════════════════════════════════════════
   RAIL-V1 — the universal right-side slide-out.  Productionizes
   mock-right-rail-v1.html.  PHASE 1 ships the shell + the live Feed tab;
   Codex remains a placeholder; Settings is a live device-preferences pane.

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
       Table chat seeds an entity stub only after the writer explicitly picks
       a Create row and the feed post succeeds; plain text never seeds one.
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
  var RAIL_ASSET_V = 'quest2';

  function readPreferences() {
    return (window.TokPreferences && window.TokPreferences.get) ? window.TokPreferences.get() : {};
  }

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
    linkOnce('tok-tooltip-css', { rel: 'stylesheet', href: 'tooltips.css?v=qt1' });
    // Characters roster tab — registers itself against the seam on tok-rail:ready.
    // Loaded non-blocking (boot doesn't wait on it); it handles either load order.
    if (!window.__tokCharactersTab && !document.querySelector('script[src*="characters-tab.js"]')) {
      var ct = document.createElement('script'); ct.src = 'characters-tab.js?v=src1';
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
    function ensureFeed() {
      if (window.FeedRender) { after(); return; }
      var s = document.createElement('script');
      s.src = 'feed-render.js';
      s.onload = after;
      s.onerror = function () { console.warn('[rail] feed-render.js failed to load — feed disabled'); after(); };
      document.head.appendChild(s);
    }
    function ensureQuest() {
      if (window.QuestFeedCapture) { ensureFeed(); return; }
      var q = document.createElement('script');
      q.src = 'quest-feed-capture.js?v=qfc3';
      q.onload = ensureFeed;
      q.onerror = function () { console.warn('[rail] quest capture helper failed to load — /quest disabled'); ensureFeed(); };
      document.head.appendChild(q);
    }
    // Device preferences must arrive before restore() chooses startup state.
    if (window.TokPreferences) { ensureQuest(); return; }
    var existing = document.querySelector('script[src*="rail-settings.js"]');
    if (existing) {
      existing.addEventListener('load', ensureQuest, { once: true });
      existing.addEventListener('error', ensureQuest, { once: true });
      return;
    }
    var ps = document.createElement('script'); ps.src = 'rail-settings.js?v=alerts1';
    ps.onload = ensureQuest;
    ps.onerror = function () { console.warn('[rail] rail-settings.js failed to load — using house defaults'); ensureQuest(); };
    document.head.appendChild(ps);
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
    var CTX = { session: 0, sessionTitle: '', encId: null, encName: '', encRound: 1, activeCombatantId: null, at: 0 };
    var FR = null, FEEDRT = null;
    var alertHost = null, alertSeen = {}, alertSeenOrder = [], lastTurnToken = null, alertAudio = null;
    var QUEST_CAPTURE_ENABLED = !!(window.QuestFeedCapture && window.QuestFeedCapture.isRailEnabled(location.search));

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
      var pref = readPreferences();
      function displayRow(row) {
        if (pref.rollCards !== 'totals' || row.kind !== 'roll' || !row.result || row.result.total == null) return row;
        return Object.assign({}, row, { body: esc(row.formula || 'Roll') + ' = <span class="ft-tot">' + esc(row.result.total) + '</span>' });
      }
      feedListEl.innerHTML = rows.length
        ? rows.map(function (row) { return FR.rowHtml(displayRow(row)); }).join('')
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
      routeFeedAlert(row);
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

    // ── alerts: one router for turn, mention, and Chronicle events ─────
    // The rail already owns the universal Realtime subscription and the signed-in
    // profile, so alert delivery lives here instead of adding a second client.
    function alertPermission() {
      return ('Notification' in window) ? window.Notification.permission : 'unsupported';
    }
    function requestBrowserAlerts() {
      if (!('Notification' in window) || typeof window.Notification.requestPermission !== 'function') return Promise.resolve('unsupported');
      if (window.Notification.permission !== 'default') return Promise.resolve(window.Notification.permission);
      return window.Notification.requestPermission();
    }
    function plainBody(body) {
      var box = document.createElement('div'); box.innerHTML = String(body || '');
      return (box.textContent || '').replace(/\s+/g, ' ').trim();
    }
    function mentionedCharacterKeys(body) {
      var box = document.createElement('div'); box.innerHTML = String(body || '');
      return Array.prototype.map.call(
        box.querySelectorAll('[data-mention-type="character"][data-mention-key]'),
        function (node) { return node.getAttribute('data-mention-key'); }
      );
    }
    function rememberAlert(id) {
      if (!id || alertSeen[id]) return false;
      alertSeen[id] = true; alertSeenOrder.push(id);
      if (alertSeenOrder.length > 200) delete alertSeen[alertSeenOrder.shift()];
      return true;
    }
    function unlockAlertSound() {
      if (!readPreferences().alertSound) return;
      var AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      try {
        if (!alertAudio) alertAudio = new AudioCtor();
        if (alertAudio.state === 'suspended') alertAudio.resume();
      } catch (e) {}
    }
    function playAlertSound(kind) {
      if (!readPreferences().alertSound || (kind !== 'turn' && kind !== 'mention')) return;
      unlockAlertSound();
      if (!alertAudio || alertAudio.state !== 'running') return;
      try {
        var oscillator = alertAudio.createOscillator(), gain = alertAudio.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = kind === 'turn' ? 523.25 : 659.25;
        gain.gain.setValueAtTime(0.0001, alertAudio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.055, alertAudio.currentTime + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, alertAudio.currentTime + 0.42);
        oscillator.connect(gain); gain.connect(alertAudio.destination);
        oscillator.start(); oscillator.stop(alertAudio.currentTime + 0.44);
      } catch (e) {}
    }
    function showFeedChannel(channel) {
      feedTab = channel || 'chronicle';
      if (root) {
        root.querySelectorAll('[data-rail-chan]').forEach(function (button) { button.classList.toggle('on', button.dataset.railChan === feedTab); });
        var control = root.querySelector('.tr-section-control');
        if (control) control.classList.toggle('on', IS_STAFF && feedTab === 'chronicle');
      }
      renderFeed(); setTab('feed'); setOpen(true); flagUnread(false); flagAlertUnread(false);
    }
    function routeAlert(route) {
      if (route === 'feed') { showFeedChannel('chronicle'); return; }
      if (route === 'combat') {
        if (/\/combat\.html$/.test(window.location.pathname)) { setOpen(false); return; }
        window.location.href = 'combat.html';
      }
    }
    function showBrowserAlert(spec) {
      var pref = readPreferences();
      if (!document.hidden || !pref.alertBrowser || alertPermission() !== 'granted') return;
      try {
        var note = new window.Notification(spec.title, { body: spec.body, tag: 'tok-' + spec.id });
        note.onclick = function () {
          try { window.focus(); } catch (e) {}
          routeAlert(spec.route); note.close();
        };
      } catch (e) {}
    }
    function notifyAlert(spec) {
      if (!spec || !rememberAlert(spec.id)) return null;
      if (!alertHost) return null;
      var card = document.createElement('article');
      card.className = 'tr-alert tr-alert-' + spec.kind;
      card.setAttribute('data-alert-id', spec.id);
      var top = document.createElement('div'); top.className = 'tr-alert-top';
      var kind = document.createElement('span'); kind.textContent = spec.kicker;
      var close = document.createElement('button'); close.type = 'button'; close.className = 'tr-alert-close'; close.setAttribute('aria-label', 'Dismiss alert'); close.textContent = '×';
      top.appendChild(kind); top.appendChild(close);
      var title = document.createElement('div'); title.className = 'tr-alert-title'; title.textContent = spec.title;
      var body = document.createElement('div'); body.className = 'tr-alert-body'; body.textContent = spec.body;
      var action = document.createElement('button'); action.type = 'button'; action.className = 'tr-alert-action'; action.textContent = spec.action; action.setAttribute('data-alert-route', spec.route);
      card.appendChild(top); card.appendChild(title); card.appendChild(body); card.appendChild(action);
      alertHost.insertBefore(card, alertHost.firstChild);
      while (alertHost.children.length > 3) alertHost.removeChild(alertHost.lastChild);
      if (!RAIL.open) flagAlertUnread(true);
      playAlertSound(spec.kind); showBrowserAlert(spec);
      document.dispatchEvent(new CustomEvent('tok:alert', { detail: spec }));
      return card;
    }
    function previewAlert(kind) {
      var stamp = Date.now();
      var mine = (ME.characterKey && typeof CHARACTERS !== 'undefined' && CHARACTERS[ME.characterKey] && CHARACTERS[ME.characterKey].name) || 'Your character';
      if (kind === 'mention') return notifyAlert({ id: 'preview-mention-' + stamp, kind: 'mention', kicker: 'Mention in the feed', title: 'Líadan mentioned ' + mine, body: '“The rift answers @' + mine + '…”', action: 'Open Feed', route: 'feed' });
      if (kind === 'chronicle') return notifyAlert({ id: 'preview-chronicle-' + stamp, kind: 'chronicle', kicker: 'Chronicle activity', title: 'A new section was added', body: 'Session ' + (CTX.session || '—') + ' · ' + (CTX.sessionTitle || 'The Chronicle'), action: 'Open Chronicle', route: 'feed' });
      return notifyAlert({ id: 'preview-turn-' + stamp, kind: 'turn', kicker: 'Combat alert', title: 'Your turn · ' + mine, body: 'Round ' + (CTX.encRound || 1) + ' in ' + (CTX.encName || 'the active encounter'), action: 'Open Combat', route: 'combat' });
    }
    function routeFeedAlert(row) {
      if (!row || row.hidden || row.author_id === ME.userId) return;
      var pref = readPreferences();
      var directMention = !!(ME.characterKey && mentionedCharacterKeys(row.body).indexOf(ME.characterKey) >= 0);
      var mine = (ME.characterKey && typeof CHARACTERS !== 'undefined' && CHARACTERS[ME.characterKey] && CHARACTERS[ME.characterKey].name) || 'you';
      if (directMention && pref.alertMentions) {
        notifyAlert({ id: 'feed-mention-' + row.id, kind: 'mention', kicker: 'Mention in the feed', title: (row.actor_name || 'Someone') + ' mentioned ' + mine, body: plainBody(row.body).slice(0, 140), action: 'Open Feed', route: 'feed' });
        return;
      }
      if (row.channel === 'chronicle' && pref.alertChronicle === 'all') {
        var section = row.meta && row.meta.section;
        notifyAlert({ id: 'feed-chronicle-' + row.id, kind: 'chronicle', kicker: 'Chronicle activity', title: section ? 'New section · ' + section : 'New Chronicle entry', body: section ? 'Session ' + (row.session || CTX.session || '—') : (row.actor_name || 'Someone') + ' · ' + plainBody(row.body).slice(0, 120), action: 'Open Chronicle', route: 'feed' });
      }
    }
    function turnToken(row) {
      if (!row) return null;
      return String(row.id || CTX.encId || '') + ':' + String(row.round || 1) + ':' + String(row.active_combatant_id || 'none');
    }
    function onEncounterUpdate(row) {
      if (!row || (row.status && row.status !== 'active')) return;
      if (!row.status && CTX.encId && row.id !== CTX.encId) return;
      CTX.encId = row.id || CTX.encId; CTX.encName = row.name || CTX.encName;
      CTX.encRound = row.round || 1; CTX.activeCombatantId = row.active_combatant_id || null; paintHeader();
      var token = turnToken(row);
      if (lastTurnToken === null) { lastTurnToken = token; return; }
      if (token === lastTurnToken) return;
      lastTurnToken = token;
      if (!CTX.activeCombatantId || !ME.characterKey || !readPreferences().alertTurns) return;
      SB.from('combatants').select('id, source_key, name, side').eq('id', CTX.activeCombatantId).maybeSingle().then(function (res) {
        var combatant = res && res.data;
        if (!combatant || combatant.source_key !== ME.characterKey) return;
        var name = combatant.name || (typeof CHARACTERS !== 'undefined' && CHARACTERS[ME.characterKey] && CHARACTERS[ME.characterKey].name) || ME.characterKey;
        notifyAlert({ id: 'turn-' + token, kind: 'turn', kicker: 'Combat alert', title: 'Your turn · ' + name, body: 'Round ' + CTX.encRound + ' in ' + (CTX.encName || 'the active encounter'), action: 'Open Combat', route: 'combat' });
      }).catch(function () {});
    }

    // session + active encounter — stamped onto inserts, shown in the header.
    function loadContext() {
      if (Date.now() - CTX.at < 30000) return Promise.resolve(CTX);
      return Promise.all([
        SB.from('campaign').select('current_session').eq('id', 1).maybeSingle(),
        SB.from('encounters').select('id, name, round, active_combatant_id').eq('status', 'active').maybeSingle(),
        SB.from('session_titles').select('session, title')
      ]).then(function (res) {
        if (res[0] && res[0].data) CTX.session = res[0].data.current_session;
        if (res[1] && res[1].data) {
          CTX.encId = res[1].data.id; CTX.encName = res[1].data.name || '';
          CTX.encRound = res[1].data.round || 1; CTX.activeCombatantId = res[1].data.active_combatant_id || null;
          if (lastTurnToken === null) lastTurnToken = turnToken(res[1].data);
        } else { CTX.encId = null; CTX.encName = ''; CTX.encRound = 1; CTX.activeCombatantId = null; }
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
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'encounters' }, function (p) {
          if (p.new) onEncounterUpdate(p.new);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'encounters' }, function (p) {
          if (p.new) onEncounterUpdate(p.new);
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
      if (window.TokPreferences) window.TokPreferences.consumeRoll();
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
      var questDialog = '<div class="tr-quest-veil" data-rail="questveil">'
          + '<section class="tr-quest-dialog" role="dialog" aria-modal="true" aria-labelledby="tr-quest-title">'
            + '<div class="tr-quest-head"><div><div class="k" data-rail="questkicker">Quest capture · 1 of 4</div><h2 id="tr-quest-title" data-rail="questheading">What happened?</h2></div><button type="button" class="tr-quest-x" data-rail="questclose" aria-label="Close quest capture">×</button></div>'
            + '<div class="tr-quest-progress" data-rail="questprogress"><span></span><span></span><span></span><span></span></div>'
            + '<div class="tr-quest-body">'
              + '<div class="tr-quest-step" data-quest-step="0"><label>Description<div class="tr-quest-description-host" data-rail="questdescriptionhost"><textarea data-rail="questdescription" rows="5" maxlength="5000" placeholder="The moment that made this a quest…"></textarea></div></label><p class="tr-quest-note" data-rail="questdescriptionnote">Type @ to link a person or place. The Feed entry remains the full story.</p></div>'
              + '<div class="tr-quest-step" data-quest-step="1" hidden><label>Quest Giver <em>optional</em><select data-rail="questgiver"><option value="">No quest giver</option></select></label><label>Location <em>optional</em><select data-rail="questlocation"><option value="">No location yet</option></select></label><p class="tr-quest-note">These connect to the same people and places used across the world.</p></div>'
              + '<div class="tr-quest-step" data-quest-step="2" hidden><label>Objective<textarea data-rail="questobjective" rows="3" maxlength="500" placeholder="What needs to be done?"></textarea></label><label>Quest title <em>optional</em><input data-rail="questtitle" maxlength="160" placeholder="Uses the objective if blank"></label></div>'
              + '<div class="tr-quest-step" data-quest-step="3" hidden><div class="tr-quest-preview"><div class="k">Quest begun</div><h3 data-rail="questpreviewtitle">Untitled quest</h3><p class="objective" data-rail="questpreviewobjective"></p><p data-rail="questpreviewdescription"></p><dl data-rail="questpreviewlinks"></dl><small data-rail="questpreviewsource"></small></div></div>'
              + '<p class="tr-quest-error" data-rail="questerror" role="alert"></p>'
              + '<div class="tr-quest-actions"><button type="button" data-rail="questback">Cancel</button><button type="button" class="primary" data-rail="questnext">Continue</button></div>'
            + '</div>'
          + '</section>'
        + '</div>';

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
      root.innerHTML += sectionDialog + questDialog;
      document.body.appendChild(root);

      handle = document.createElement('div');
      handle.className = 'tr-handle';
      handle.title = 'Feed & sheet';
      handle.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2 L4 6 L8 10"/></svg>';
      document.body.appendChild(handle);

      alertHost = document.createElement('div');
      alertHost.id = 'tok-alerts'; alertHost.className = 'tr-alert-stack';
      alertHost.setAttribute('aria-live', 'polite'); alertHost.setAttribute('aria-label', 'Kirtas alerts');
      alertHost.addEventListener('click', function (e) {
        var card = e.target.closest('.tr-alert'); if (!card) return;
        if (e.target.closest('.tr-alert-close')) { card.remove(); return; }
        var action = e.target.closest('.tr-alert-action');
        if (action) { routeAlert(action.getAttribute('data-alert-route')); card.remove(); }
      });
      document.body.appendChild(alertHost);

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
    function flagAlertUnread(on) {
      if (handle) handle.classList.toggle('tr-alert-unread', on);
    }
    function paintHeader() {
      if (!root) return;
      var kEl = root.querySelector('.tr-ses .k');
      if (kEl) kEl.textContent = 'Session ' + (CTX.session || '—');
      if (headTitleEl) headTitleEl.textContent = CTX.encName || 'The Chronicle';
    }

    // ── open/collapse + tabs + persistence ──
    function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify({ open: RAIL.open, tab: RAIL.tab })); } catch (e) {} }
    function restore() {
      try { var s = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); if (typeof s.open === 'boolean') RAIL.open = s.open; if (s.tab) RAIL.tab = s.tab; } catch (e) {}
      var p = readPreferences();
      if (p.railOpen === 'closed') RAIL.open = false;
      else if (p.railOpen === 'open') RAIL.open = true;
      if (p.railTab && p.railTab !== 'last') RAIL.tab = p.railTab;
    }
    function applyOpen() {
      root.classList.toggle('tr-collapsed', !RAIL.open);
      handle.classList.toggle('tr-open', RAIL.open);
      if (alertHost) alertHost.classList.toggle('tr-rail-open', RAIL.open);
      if (RAIL.open) { flagUnread(false); flagAlertUnread(false); }
    }
    function setOpen(v) {
      if (v && window.TokSettings && window.TokSettings.close) window.TokSettings.close();
      RAIL.open = v; applyOpen(); persist();
    }

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
      var questVeil = root.querySelector('[data-rail="questveil"]');
      var questState = null;
      var questDescriptionSurface = null;
      var QUEST_STEPS = ['What happened?', 'Who and where?', 'What needs doing?', 'Share'];

      function questEl(name) { return root.querySelector('[data-rail="' + name + '"]'); }
      function fillQuestSelect(name, items, blank) {
        var select = questEl(name), selected = select.value, seen = {};
        select.innerHTML = '<option value="">' + esc(blank) + '</option>';
        (items || []).slice().sort(function (a,b) { return String(a.label).localeCompare(String(b.label)); }).forEach(function (item) {
          if (!item.id || seen[item.id]) return;
          seen[item.id] = true;
          var option = document.createElement('option'); option.value = item.id; option.textContent = item.label;
          select.appendChild(option);
        });
        if (seen[selected]) select.value = selected;
      }
      function populateQuestSelects() {
        if (!questVeil || !questVeil.classList.contains('on') || typeof MC === 'undefined') return;
        fillQuestSelect('questgiver', MC.pool.npcs, 'No quest giver');
        fillQuestSelect('questlocation', MC.pool.locations, 'No location yet');
        updateQuestPreview();
      }
      function questDetails() {
        var giverId = questEl('questgiver').value, locationId = questEl('questlocation').value;
        var giver = (MC.pool.npcs || []).find(function (item) { return String(item.id) === String(giverId); });
        var place = (MC.pool.locations || []).find(function (item) { return String(item.id) === String(locationId); });
        var objective = questEl('questobjective').value.trim();
        var descriptionText = questDescriptionSurface
          ? questDescriptionSurface.text().trim()
          : questEl('questdescription').value.trim();
        var description = questDescriptionSurface
          ? questDescriptionSurface.encoded()
          : window.QuestFeedCapture.encodeDescription(questEl('questdescription').value);
        return {
          title: window.QuestFeedCapture.questTitle(questEl('questtitle').value, objective),
          description: description, descriptionText: descriptionText, objective: objective,
          giverId: giver ? giver.id : null, giverLabel: giver ? giver.label : null,
          locationId: place ? place.id : null, locationLabel: place ? place.label : null,
        };
      }
      function updateQuestPreview() {
        if (!questState) return;
        var details = questDetails();
        questEl('questpreviewtitle').textContent = details.title || 'Untitled quest';
        questEl('questpreviewobjective').textContent = details.objective;
        questEl('questpreviewdescription').innerHTML = window.QuestFeedCapture.descriptionHTML(details.description);
        var links = questEl('questpreviewlinks'); links.innerHTML = '';
        [['Quest Giver', details.giverLabel, details.giverId, 'npc'], ['Location', details.locationLabel, details.locationId, 'location']].forEach(function (pair) {
          if (!pair[1]) return;
          var dt = document.createElement('dt'); dt.textContent = pair[0];
          var dd = document.createElement('dd'); dd.textContent = pair[1];
          dd.className = pair[3] + '-link'; dd.setAttribute('data-' + pair[3], pair[2]); dd.tabIndex = 0;
          links.appendChild(dt); links.appendChild(dd);
        });
        questEl('questpreviewsource').textContent = 'Begun from this Session ' + (CTX.session || '—') + ' Feed entry · visible to the party';
        if (window.attachTooltips) { try { window.attachTooltips(questEl('questpreviewdescription').parentNode); } catch (e) {} }
      }
      function renderQuestCapture() {
        var step = questState ? questState.step : 0;
        questEl('questkicker').textContent = 'Quest capture · ' + (step + 1) + ' of ' + QUEST_STEPS.length;
        questEl('questheading').textContent = QUEST_STEPS[step];
        root.querySelectorAll('[data-quest-step]').forEach(function (el) { el.hidden = Number(el.dataset.questStep) !== step; });
        questEl('questprogress').querySelectorAll('span').forEach(function (el, i) { el.classList.toggle('on', i <= step); });
        questEl('questback').textContent = step ? 'Back' : 'Cancel';
        questEl('questnext').textContent = step === 3 ? (questState.busy ? 'Sharing…' : 'Begin quest') : 'Continue';
        questEl('questback').disabled = !!questState.busy;
        questEl('questnext').disabled = !!questState.busy;
        questEl('questclose').disabled = !!questState.busy;
        updateQuestPreview();
        var focus = [questDescriptionSurface ? questDescriptionSurface.el : questEl('questdescription'), questEl('questgiver'), questEl('questobjective'), null][step];
        if (focus) setTimeout(function () { focus.focus(); }, 0);
      }
      function openQuestCapture(seed) {
        if (!QUEST_CAPTURE_ENABLED) return;
        if (!questState) {
          questState = { step: 0, requestId: window.QuestFeedCapture.requestId(window.crypto), sourceFeedPostId: null, busy: false };
          if (questDescriptionSurface) questDescriptionSurface.setText(seed || '');
          else questEl('questdescription').value = seed || '';
          questEl('questgiver').value = ''; questEl('questlocation').value = '';
          questEl('questobjective').value = ''; questEl('questtitle').value = '';
        } else if (!(questDescriptionSurface ? questDescriptionSurface.text() : questEl('questdescription').value).trim() && seed) {
          if (questDescriptionSurface) questDescriptionSurface.setText(seed);
          else questEl('questdescription').value = seed;
        }
        questEl('questerror').textContent = '';
        questVeil.classList.add('on');
        populateQuestSelects();
        if (!MC.loaded) loadMentionData(SURF && SURF.el);
        renderQuestCapture();
      }
      function closeQuestCapture() {
        if (questState && questState.busy) return;
        questVeil.classList.remove('on');
        if (SURF) setTimeout(function () { SURF.focus(); }, 0);
      }
      function commitNewEntities(newEntities) {
        newEntities = newEntities || MC.newEntities.splice(0);
        newEntities.forEach(function (item) {
          SB.from('entities').insert({ id: item.id, type: item.type, name: item.label }).then(function (er) {
            if (er && er.error && !/duplicate|unique/i.test(er.error.message || '')) {
              console.warn('[rail] entity stub failed:', er.error.message);
              toast(item.label + ' was posted, but could not enter the Codex queue');
              return;
            }
            var list = item.type === 'npc' ? MC.pool.npcs : MC.pool.locations;
            if (!list.some(function (e) { return e.id === item.id; })) list.push({ id: item.id, type: item.type, label: item.label, hint: 'pending curation', curated: false });
          });
        });
      }
      function insertQuestSource(details) {
        var actor = feedActor();
        var newEntities = MC.newEntities.splice(0);
        return loadContext().then(function (c) {
          var body = SURF && SURF.body().trim();
          if (!body) body = window.QuestFeedCapture.descriptionHTML(details.description);
          return SB.from('feed').insert({
            actor_key: actor.key, actor_name: actor.name, channel: 'chronicle', kind: 'message', hidden: false,
            encounter_id: c.encId, session: c.session, body: body,
          }).select().single();
        }).then(function (result) {
          if (result && result.error) throw new Error('Feed entry: ' + result.error.message);
          if (!result || !result.data || result.data.id == null) throw new Error('Feed entry did not return its identity.');
          onFeedInsert(result.data); commitNewEntities(newEntities);
          return result.data.id;
        });
      }
      function submitQuestCapture() {
        var details = questDetails(), errorEl = questEl('questerror');
        if (!details.descriptionText) { errorEl.textContent = 'Add the moment that made this a quest.'; return; }
        if (details.description.length > 5000) { errorEl.textContent = 'This description is a little too long. Shorten it before beginning the quest.'; return; }
        if (!details.objective) { errorEl.textContent = 'Add one clear thing that needs to be done.'; return; }
        questState.busy = true; errorEl.textContent = ''; renderQuestCapture();
        var source = questState.sourceFeedPostId ? Promise.resolve(questState.sourceFeedPostId) : insertQuestSource(details);
        source.then(function (feedId) {
          questState.sourceFeedPostId = feedId;
          return SB.rpc('create_quest', window.QuestFeedCapture.rpcPayload(Object.assign({}, details, {
            requestId: questState.requestId, sourceFeedPostId: feedId,
          })));
        }).then(function (result) {
          if (result && result.error) throw new Error('Quest: ' + result.error.message);
          var name = details.title;
          questState = null; questVeil.classList.remove('on');
          if (SURF) { SURF.clear(); updateCount(); }
          toast('Quest begun · ' + name);
        }).catch(function (error) {
          var sourceSaved = !!questState.sourceFeedPostId;
          questState.busy = false;
          errorEl.textContent = (sourceSaved ? 'The Feed entry was saved, but the quest did not begin. ' : '') + (error.message || error) + ' Your details are still here; try again.';
          renderQuestCapture();
        });
      }
      function moveQuestCapture(direction) {
        if (!questState || questState.busy) return;
        var errorEl = questEl('questerror'); errorEl.textContent = '';
        if (direction < 0) {
          if (!questState.step) closeQuestCapture(); else { questState.step -= 1; renderQuestCapture(); }
          return;
        }
        var details = questDetails();
        if (questState.step === 0 && !details.descriptionText) { errorEl.textContent = 'Add the moment that made this a quest.'; return; }
        if (questState.step === 0 && details.description.length > 5000) { errorEl.textContent = 'This description is a little too long. Shorten it before continuing.'; return; }
        if (questState.step === 2 && !details.objective) { errorEl.textContent = 'Add one clear thing that needs to be done.'; return; }
        if (questState.step < 3) { questState.step += 1; renderQuestCapture(); return; }
        submitQuestCapture();
      }

      questEl('questclose').addEventListener('click', closeQuestCapture);
      questEl('questback').addEventListener('click', function () { moveQuestCapture(-1); });
      questEl('questnext').addEventListener('click', function () { moveQuestCapture(1); });
      ['questdescription','questgiver','questlocation','questobjective','questtitle'].forEach(function (name) { questEl(name).addEventListener('input', updateQuestPreview); });
      questVeil.addEventListener('mousedown', function (e) { if (e.target === questVeil) closeQuestCapture(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && questVeil.classList.contains('on')) closeQuestCapture(); });

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
        if (QUEST_CAPTURE_ENABLED) {
          var questCommand = window.QuestFeedCapture.commandQuery(t, t.length);
          if (questCommand && questCommand.exact) {
            var seed = window.QuestFeedCapture.descriptionSeed(t, questCommand.index);
            SURF.setText(t.slice(0, questCommand.index).trimEnd()); updateCount();
            openQuestCapture(seed); return;
          }
        }
        var staffHide = feedPostHidden && IS_STAFF;
        var cmd = t.match(/^\/(roll|r)\s+(.+)$/i);
        if (cmd) {
          var parsed = parseDice(cmd[2]);
          if (parsed) {
            feedInsert({ channel: 'combat', kind: 'roll', formula: parsed.formula, result: { total: parsed.total }, body: diceBody(parsed), hidden: staffHide });
            if (window.TokPreferences) window.TokPreferences.consumeRoll();
            SURF.clear(); updateCount(); return;
          }
        }
        var newEntities = MC.newEntities.splice(0);
        feedInsert({ channel: 'chronicle', kind: 'message', body: SURF.body(), hidden: staffHide }).then(function (r) {
          if (r && r.error) return;
          commitNewEntities(newEntities);
        });
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
        inp.placeholder = '/quest, /roll, or say something…';
        host.insertBefore(inp, countEl);
        SURF = {
          text: function () { return inp.value; },
          body: function () { return esc(inp.value.trim()); },
          setText: function (t) { inp.value = t; },
          clear: function () { inp.value = ''; },
          focus: function () { inp.focus(); },
          shake: function () {},
          el: inp,
        };
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submitSurface(); } });
        inp.addEventListener('input', function () {
          updateCount();
          if (!QUEST_CAPTURE_ENABLED) return;
          var command = window.QuestFeedCapture.commandQuery(inp.value, inp.value.length);
          if (!command || !command.exact) return;
          var seed = window.QuestFeedCapture.descriptionSeed(inp.value, command.index);
          inp.value = inp.value.slice(0, command.index).trimEnd(); updateCount(); openQuestCapture(seed);
        });
      }

      // ── the mention pool: lazy — nothing loads until the first focus ──
      // canon (tooltips.js via ensureCanon) + entities + journal pages; the
      // [[ picker gets two tabs: My notes (your seat) / All (party-readable).
      var MC = { mod: null, mine: [], all: [], mySlugs: {}, pool: { characters: [], npcs: [], locations: [] }, newEntities: [], loaded: false, loading: false };
      function mountQuestDescription(mod) {
        if (questDescriptionSurface) return;
        MC.mod = mod;
        var fallback = questEl('questdescription');
        var hostEl = questEl('questdescriptionhost');
        var composer = mod.createComposer(hostEl, {
          placeholder: 'The moment that made this a quest… Type @ to link a person or place.',
          pool: function () { return { characters: [], npcs: MC.pool.npcs, locations: MC.pool.locations }; },
          onNewEntity: function (item) {
            if (!MC.newEntities.some(function (e) { return e.id === item.id && e.type === item.type; })) {
              MC.newEntities.push({ id: item.id, type: item.type, label: item.label });
            }
          },
        });
        var initial = fallback.value;
        fallback.hidden = true;
        questDescriptionSurface = {
          text: function () { return window.QuestFeedCapture.descriptionText(composer.getDoc()); },
          encoded: function () { return window.QuestFeedCapture.encodeDescription(composer.getDoc()); },
          setText: function (text) { composer.clear(); composer.el.textContent = text || ''; updateQuestPreview(); },
          el: composer.el,
        };
        if (initial) questDescriptionSurface.setText(initial);
        composer.el.addEventListener('input', updateQuestPreview);
        composer.el.addEventListener('focus', function () { loadMentionData(composer.el); }, true);
      }
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
          SB.from('characters').select('key, structural, delete_marked').order('key'),
          SB.from('journal_pages').select('author_id, character_key, title, slug, folder, updated_at')
            .order('updated_at', { ascending: false }).limit(500)
        ]).then(function (res) {
          var canon = res[0];
          var entities = (res[1] && !res[1].error && res[1].data) || [];
          var characters = (res[2] && !res[2].error && res[2].data) || [];
          var pages = (res[3] && !res[3].error && res[3].data) || [];
          MC.pool = MC.mod.buildPool(canon, entities, characters);
          MC.all = pages.map(function (p) { return { id: p.slug, type: 'page', label: p.title, hint: seatName(p.character_key) }; });
          MC.mine = pages.filter(function (p) {
            return p.author_id === ME.userId && (p.character_key || null) === (ME.characterKey || null);
          }).map(function (p) { MC.mySlugs[p.slug] = true; return { id: p.slug, type: 'page', label: p.title, hint: p.folder || 'Unsorted' }; });
          MC.loaded = true; MC.loading = false;
          populateQuestSelects();
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
      import('./mention-composer.js?v=mc5').then(function (mod) {
        mountQuestDescription(mod);
        if (SURF) { console.warn('[rail] mention-composer arrived after fallback — keeping the input'); return; }
        MC.mod = mod;
        var composer = mod.createComposer(host, {
          placeholder: '/quest, /roll, @ a name, [[ a page…',
          pool: function () { return MC.pool; },
          pageTabs: function () { return [ { id: 'mine', label: 'My notes', items: MC.mine }, { id: 'all', label: 'All', items: MC.all } ]; },
          onNewEntity: function (item) {
            if (!MC.newEntities.some(function (e) { return e.id === item.id && e.type === item.type; })) {
              MC.newEntities.push({ id: item.id, type: item.type, label: item.label });
            }
          },
          onQuest: QUEST_CAPTURE_ENABLED ? function (event) { openQuestCapture(event && event.seed); } : null,
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
          el: composer.el,
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
        questEl('questdescriptionnote').textContent = 'Linked names are unavailable right now; you can still write the quest. The Feed entry remains the full story.';
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
        Promise.all([import('./mention-composer.js?v=mc5'), import('./journal-capture.js?v=jc4')]).then(function (mods) {
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
        applyPreferences: function () { if (window.TokPreferences) window.TokPreferences.apply(); renderFeed(); },
        ready: true
      };
      window.TokAlerts = {
        notify: notifyAlert,
        preview: previewAlert,
        permission: alertPermission,
        requestBrowser: requestBrowserAlerts,
      };
      document.addEventListener('tok:preferences', function () { renderFeed(); unlockAlertSound(); });
      document.dispatchEvent(new CustomEvent('tok:alerts-ready'));
      // Pages register their contextual tabs in response to this (or by checking
      // window.TokRail.ready if they loaded after it fired).
      document.dispatchEvent(new CustomEvent('tok-rail:ready'));
    });
  }
})();
