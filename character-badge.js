// ============================================================
// character-badge.js — identity in the top-left
// The Trials of Kirtas
// ============================================================
//
// July 4, mock approved: the portrait medallion beside KIRTAS. The
// organizing principle it establishes: ◐ = preferences (how things
// look), THE BADGE = identity (who you are). The menu:
//   header (portrait · name · epithet · class) → vitals glance →
//   Character sheet · Journal → Player color →
//   [DM tools, role-gated] → Your characters → seat + sign out.
//
// Ownership contract (no clobbers):
//   settings-flyout.js OWNS profiles.appearance. The badge never writes
//   the profile. Changing your Player color here dispatches
//   CustomEvent('tok:accent', { detail:{ accent } }) — the flyout's
//   listener adopts it into its closure copy, persists via the
//   replace-not-merge idiom, and re-announces tok:look (whose
//   detail.appearance now carries accent). The badge repaints from
//   tok:look. One writer, many readers.
//
// Data:
//   window.__tok.ready → profile { role, characterKey, displayName }
//   characters row (lazy, on menu open):
//     structural.portrait / .classLabel / .background|.race / .combat.hpMax
//     vitals.hp / .hpBonus / .hpTemp / .concentration
//   V1 is single-character (profiles carry ONE character_key); the
//   "Your characters" section renders the pinned row. The switcher slot
//   exists in code and lights up the day the model grows.
//
// Armor (inherited from the July 3/4 lessons): every selector is
// #tok-badge-prefixed; every derived tone is a JS literal; outside-click
// uses composedPath() (re-renders detach mid-bubble targets; contains()
// lies about them); injected by nav.js stamped with SETTINGS_V.
// ============================================================

(function () {
  'use strict';

  var FALLBACK_ACCENTS = ['#6f9fc9', '#9d7bd8', '#6faf7e', '#c96f6f', '#b8952a', '#d98ba8', '#5e8f8a', '#c9a227'];
  var CACHE_KEY = 'tok-look-cache';   // the flyout's mirror; accent rides it

  var open = false;
  var badge = null, menu = null;
  var profile = null;                 // __tok profile
  var charRow = null;                 // { structural, vitals } for the bound character
  var accent = '#6f9fc9';

  function accents() {
    return (window.TokSettings && window.TokSettings.ACCENTS) || FALLBACK_ACCENTS;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function readCachedAccent() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
      if (c.accent) accent = c.accent;
    } catch (e) { /* default stands */ }
  }

  // the nav's static catalog is authoritative for display names
  function navChar(key) {
    var list = (typeof CHARACTERS_NAV !== 'undefined' && CHARACTERS_NAV) || (window.CHARACTERS_NAV || []);
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
    return null;
  }

  // ── styles: ID-armored, literals only ──
  function injectStyles() {
    if (document.getElementById('tok-badge-styles')) return;
    var s = document.createElement('style');
    s.id = 'tok-badge-styles';
    s.textContent = [
      '#tok-badge{width:32px;height:32px;border-radius:50%;padding:0;cursor:pointer;flex:0 0 auto;',
      'border:2px solid var(--tb-seat,#6f9fc9);background:#26231E center/cover no-repeat;position:relative;',
      'display:inline-flex;align-items:center;justify-content:center;margin-left:12px;vertical-align:middle;',
      "font-family:'Cinzel',serif;font-weight:700;font-size:14px;color:#e9e4d6;transition:box-shadow .15s ease}",
      '#tok-badge:hover{box-shadow:0 0 0 3px rgba(233,228,214,.18)}',
      '#tok-badge[aria-expanded="true"]{box-shadow:0 0 0 3px var(--tb-seat,#6f9fc9)}',
      '#tok-badge .tb-dot{position:absolute;right:-2px;bottom:-2px;width:9px;height:9px;border-radius:50%;',
      'background:var(--tb-seat,#6f9fc9);border:2px solid #1a1a1a}',
      '#tok-badge-menu{position:fixed;top:58px;left:12px;z-index:1200;width:min(300px,92vw);max-height:calc(100vh - 74px);overflow-y:auto;',
      'background:#14120F;color:#c9c2b0;border:1px solid #3a352b;box-shadow:0 18px 48px rgba(10,8,4,.5);',
      "font-family:'Barlow Condensed','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.4;",
      'letter-spacing:normal;text-transform:none;transform:translateY(-8px);opacity:0;pointer-events:none;',
      'transition:transform .22s cubic-bezier(.2,.8,.2,1),opacity .18s ease}',
      '#tok-badge-menu.is-open{transform:translateY(0);opacity:1;pointer-events:auto}',
      '#tok-badge-menu *{box-sizing:border-box;margin:0}',
      '#tok-badge-menu button{font-family:inherit;font-size:inherit;color:inherit;background:none;border:0;cursor:pointer;text-align:left;padding:0}',
      '#tok-badge-menu a{color:inherit;text-decoration:none}',
      '#tok-badge-menu .tb-head{display:flex;gap:12px;align-items:center;padding:14px 14px 12px;border-bottom:1px solid #2e2a22}',
      '#tok-badge-menu .tb-port{width:52px;height:52px;border-radius:50%;flex:0 0 auto;border:2px solid var(--tb-seat,#6f9fc9);',
      "background:#26231E center/cover no-repeat;display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-weight:700;font-size:22px;color:#e9e4d6}",
      "#tok-badge-menu .tb-name{font-family:'Cinzel',serif;font-weight:700;font-size:15px;color:#e9e4d6;letter-spacing:.04em}",
      "#tok-badge-menu .tb-epi{font-family:'EB Garamond',Georgia,serif;font-style:italic;font-size:12.5px;color:#9c9482;margin-top:1px}",
      '#tok-badge-menu .tb-cls{font-size:10px;letter-spacing:.2em;font-weight:700;color:#7a7260;margin-top:4px;text-transform:uppercase}',
      '#tok-badge-menu .tb-vitals{padding:10px 14px 12px;border-bottom:1px solid #2e2a22}',
      '#tok-badge-menu .tb-hp-row{display:flex;align-items:center;gap:10px}',
      '#tok-badge-menu .tb-hp-track{flex:1;height:8px;background:rgba(0,0,0,.5);border:1px solid #3a352b;overflow:hidden}',
      '#tok-badge-menu .tb-hp-seg{height:100%;transition:width .3s ease}',
      '#tok-badge-menu .tb-hp-nums{font-size:12px;font-weight:600;letter-spacing:.08em;color:#c9c2b0;flex:0 0 auto}',
      '#tok-badge-menu .tb-conds{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}',
      '#tok-badge-menu .tb-cond{font-size:8.5px;letter-spacing:.14em;font-weight:700;text-transform:uppercase;border:1px solid #3a352b;color:#9c9482;padding:2px 7px}',
      '#tok-badge-menu .tb-item{display:flex;align-items:center;justify-content:space-between;width:100%;',
      'padding:10px 14px;font-size:12px;letter-spacing:.1em;font-weight:600;text-transform:uppercase;',
      'border-bottom:1px solid #221f19;transition:background .12s}',
      '#tok-badge-menu .tb-item:hover{background:rgba(233,228,214,.05);color:#e9e4d6}',
      '#tok-badge-menu .tb-item .car{color:#55503f}',
      '#tok-badge-menu .tb-sub{padding:10px 14px 12px;border-bottom:1px solid #221f19}',
      '#tok-badge-menu .tb-lbl{font-size:9px;letter-spacing:.28em;font-weight:700;color:#7a7260;text-transform:uppercase}',
      "#tok-badge-menu .tb-hint{font-family:'EB Garamond',Georgia,serif;font-style:italic;font-size:11.5px;color:#7a7260;margin-top:2px}",
      '#tok-badge-menu .tb-accents{display:flex;gap:8px;margin-top:9px;flex-wrap:wrap}',
      '#tok-badge-menu .tb-acc{width:18px;height:18px;border-radius:50%;border:1px solid #3a352b;padding:0;position:relative;transition:transform .12s}',
      '#tok-badge-menu .tb-acc:hover{transform:scale(1.15)}',
      "#tok-badge-menu .tb-acc.sel::after{content:'';position:absolute;inset:-4px;border:1px solid #e9e4d6;border-radius:50%}",
      '#tok-badge-menu .tb-dm{border-bottom:1px solid #221f19}',
      '#tok-badge-menu .tb-dm .tb-lbl{display:block;padding:10px 14px 0;color:#c0641a}',
      '#tok-badge-menu .tb-dm .tb-item{border-bottom:0;padding-top:8px;padding-bottom:8px}',
      '#tok-badge-menu .tb-dm .tb-item:last-child{padding-bottom:12px}',
      '#tok-badge-menu .tb-chars{padding:10px 14px 12px;border-bottom:1px solid #221f19}',
      '#tok-badge-menu .tb-pinned{display:flex;align-items:center;gap:10px;padding:6px 0;color:#9c9482;font-size:12px;letter-spacing:.08em;font-weight:600}',
      '#tok-badge-menu .tb-cp{width:28px;height:28px;border-radius:50%;flex:0 0 auto;border:1px solid var(--tb-seat,#6f9fc9);',
      "background:#26231E center/cover no-repeat;display:inline-flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-weight:700;font-size:12px;color:#e9e4d6}",
      '#tok-badge-menu .tb-now{margin-left:auto;font-size:8.5px;letter-spacing:.16em;color:#7a7260}',
      '#tok-badge-menu .tb-foot{display:flex;align-items:center;justify-content:space-between;padding:10px 14px}',
      '#tok-badge-menu .tb-seatchip{font-size:9px;letter-spacing:.18em;font-weight:700;text-transform:uppercase;border:1px solid #3a352b;color:#9c9482;padding:3px 8px}',
      '#tok-badge-menu .tb-out{font-size:11px;letter-spacing:.12em;font-weight:600;color:#7a7260;text-transform:uppercase}',
      '#tok-badge-menu .tb-out:hover{color:#c0001a}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── tolerant field extraction (schemas drift; the badge never throws) ──
  function hpOf(row) {
    var st = (row && row.structural) || {}, v = (row && row.vitals) || {};
    var cmb = st.combat || {};
    var max = (cmb.hpMax || 0) + (v.hpBonus || 0);
    var cur = (v.hp != null) ? v.hp : (cmb.hp || 0);
    return { cur: cur, max: max };
  }
  function hpColor(cur, max) {
    if (!max) return '#7a7260';
    var r = cur / max;
    if (r < 0.2) return '#c8432a';
    if (r < 0.5) return '#d4821a';
    return '#5a9a6a';
  }
  function condsOf(row) {
    var v = (row && row.vitals) || {};
    var out = [];
    if (v.concentration) out.push('Concentration');
    if (v.hpTemp > 0) out.push('+' + v.hpTemp + ' temp');
    return out;
  }

  // ── render ──
  function paintSeat() {
    if (badge) badge.style.setProperty('--tb-seat', accent);
    if (menu) menu.style.setProperty('--tb-seat', accent);
  }
  function portraitCss(el, url, initial) {
    if (url) { el.style.backgroundImage = "url('" + url + "')"; el.textContent = ''; }
    else { el.style.backgroundImage = 'none'; el.textContent = initial; }
  }

  function render() {
    if (!menu) return;
    var key = profile && profile.characterKey;
    var nav = key ? navChar(key) : null;
    var st = (charRow && charRow.structural) || {};
    var name = (nav && (nav.full || nav.label)) || (profile && profile.displayName) || 'Member';
    var initial = name.charAt(0).toUpperCase();
    var epi = st.background || st.race || '';
    var cls = st.classLabel || '';
    var hp = hpOf(charRow);
    var isDM = profile && (profile.role === 'dm' || profile.role === 'overseer');

    portraitCss(badge.querySelector('.tb-init'), st.portrait, initial);
    portraitCss(menu.querySelector('.tb-port'), st.portrait, initial);
    menu.querySelector('.tb-name').textContent = name;
    var epiEl = menu.querySelector('.tb-epi');
    epiEl.textContent = epi; epiEl.style.display = epi ? '' : 'none';
    var clsEl = menu.querySelector('.tb-cls');
    clsEl.textContent = cls; clsEl.style.display = cls ? '' : 'none';

    var vit = menu.querySelector('.tb-vitals');
    if (key && hp.max) {
      vit.style.display = '';
      var seg = menu.querySelector('.tb-hp-seg');
      seg.style.width = Math.max(0, Math.min(100, Math.round(hp.cur / hp.max * 100))) + '%';
      seg.style.background = hpColor(hp.cur, hp.max);
      menu.querySelector('.tb-hp-nums').textContent = hp.cur + ' / ' + hp.max;
      menu.querySelector('.tb-conds').innerHTML = condsOf(charRow)
        .map(function (x) { return '<span class="tb-cond">' + esc(x) + '</span>'; }).join('');
    } else {
      vit.style.display = 'none';
    }

    var sheetA = menu.querySelector('#tb-sheet');
    sheetA.style.display = key ? '' : 'none';
    if (key) sheetA.setAttribute('href', 'sheet-v2.html?character=' + encodeURIComponent(key));

    menu.querySelector('.tb-accents').innerHTML = accents().map(function (hex) {
      return '<button type="button" class="tb-acc' + (hex.toLowerCase() === accent.toLowerCase() ? ' sel' : '')
        + '" data-hex="' + hex + '" style="background:' + hex + '" aria-label="Player color ' + hex + '"></button>';
    }).join('');

    menu.querySelector('.tb-dm').hidden = !isDM;
    menu.querySelector('.tb-seatchip').textContent = (profile && profile.role ? profile.role : 'member').toUpperCase();

    // your characters: V1 pinned single; the switcher slot lights when >1
    var chars = key ? [{ key: key, name: name, portrait: st.portrait }] : [];
    var list = menu.querySelector('#tb-charlist');
    if (!chars.length) {
      list.innerHTML = '<div class="tb-pinned">No character bound to this seat.</div>';
    } else if (chars.length === 1) {
      var c = chars[0];
      list.innerHTML = '<div class="tb-pinned"><span class="tb-cp">'
        + (c.portrait ? '' : esc(c.name.charAt(0))) + '</span>'
        + '<span>' + esc(c.name) + '</span><span class="tb-now">YOUR CHARACTER</span></div>';
      if (c.portrait) list.querySelector('.tb-cp').style.backgroundImage = "url('" + c.portrait + "')";
    }
    // (chars.length > 1: the switcher renders here the day profiles carry more)

    paintSeat();
  }

  // ── data ──
  var fetching = null;
  function fetchCharacter() {
    var key = profile && profile.characterKey;
    var sb = window.__tok && window.__tok.sb;
    if (!key || !sb) return Promise.resolve(null);
    if (fetching) return fetching;
    fetching = sb.from('characters').select('key,structural,vitals').eq('key', key).maybeSingle()
      .then(function (res) {
        fetching = null;
        if (!res.error && res.data) { charRow = res.data; render(); }
        return charRow;
      })
      .catch(function () { fetching = null; return null; });
    return fetching;
  }

  // ── open/close ──
  function setOpen(on) {
    open = on;
    menu.classList.toggle('is-open', on);
    badge.setAttribute('aria-expanded', String(on));
    if (on) fetchCharacter();       // vitals refresh on every open — live enough
  }

  // ── build ──
  function build() {
    if (badge) return;
    injectStyles();

    var brand = document.querySelector('.nav-brand');
    badge = document.createElement('button');
    badge.type = 'button';
    badge.id = 'tok-badge';
    badge.setAttribute('aria-expanded', 'false');
    badge.setAttribute('aria-label', 'Your character');
    badge.innerHTML = '<span class="tb-init"></span><span class="tb-dot"></span>';
    if (brand && brand.parentNode) brand.parentNode.insertBefore(badge, brand.nextSibling);
    else document.body.appendChild(badge);   // harness pages without a nav

    menu = document.createElement('div');
    menu.id = 'tok-badge-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Character menu');
    menu.innerHTML = [
      '<div class="tb-head"><div class="tb-port"></div><div>',
      '  <div class="tb-name"></div><div class="tb-epi"></div><div class="tb-cls"></div>',
      '</div></div>',
      '<div class="tb-vitals" style="display:none">',
      '  <div class="tb-hp-row"><div class="tb-hp-track"><div class="tb-hp-seg"></div></div><div class="tb-hp-nums"></div></div>',
      '  <div class="tb-conds"></div>',
      '</div>',
      '<a class="tb-item" id="tb-sheet" href="sheet-v2.html"><span>Character sheet</span><span class="car">▸</span></a>',
      '<a class="tb-item" id="tb-journal" href="journal.html"><span>Journal</span><span class="car">▸</span></a>',
      '<div class="tb-sub">',
      '  <span class="tb-lbl">Player color</span>',
      '  <div class="tb-hint">your color on rolls, comments &amp; cursors</div>',
      '  <div class="tb-accents"></div>',
      '</div>',
      '<div class="tb-dm" hidden>',
      '  <span class="tb-lbl">DM tools</span>',
      '  <a class="tb-item" href="combat.html"><span>Combat table</span><span class="car">▸</span></a>',
      '  <a class="tb-item" href="admin.html"><span>Members &amp; access</span><span class="car">▸</span></a>',
      '</div>',
      '<div class="tb-chars"><span class="tb-lbl">Your characters</span><div id="tb-charlist"></div></div>',
      '<div class="tb-foot"><span class="tb-seatchip">MEMBER</span><button type="button" class="tb-out" id="tb-out">Sign out</button></div>',
    ].join('\n');
    document.body.appendChild(menu);

    badge.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!open);
    });
    // composedPath, never contains: re-renders detach mid-bubble targets
    document.addEventListener('click', function (e) {
      if (!open) return;
      var path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(menu) !== -1 || path.indexOf(badge) !== -1) return;
      setOpen(false);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) setOpen(false); });

    // player color: dispatch, don't persist — the flyout owns appearance
    menu.addEventListener('click', function (e) {
      var acc = e.target.closest('.tb-acc');
      if (acc) {
        accent = acc.dataset.hex;
        render();
        document.dispatchEvent(new CustomEvent('tok:accent', { detail: { accent: accent } }));
      }
    });

    menu.querySelector('#tb-out').addEventListener('click', function () {
      var sb = window.__tok && window.__tok.sb;
      var done = function () { window.location.href = 'login.html'; };
      if (sb && sb.auth && sb.auth.signOut) sb.auth.signOut().then(done, done);
      else done();
    });

    // accent updates from anywhere (the flyout announces after owning a change)
    document.addEventListener('tok:look', function (e) {
      var a = e.detail && e.detail.appearance && e.detail.appearance.accent;
      if (a && a !== accent) { accent = a; render(); }
    });

    render();
  }

  // ── boot ──
  readCachedAccent();
  function whenBody(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }
  whenBody(function () {
    build();
    (async function () {
      try {
        if (window.__tok && window.__tok.ready) profile = await window.__tok.ready;
      } catch (e) { profile = null; }
      render();
      fetchCharacter();
    })();
  });

  window.TokBadge = {
    toggle: function () { setOpen(!open); },
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    isOpen: function () { return open; },
  };
})();
