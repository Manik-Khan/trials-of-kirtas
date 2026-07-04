// ============================================================
// settings-flyout.js — the ONE ◐ Settings flyout
// The Trials of Kirtas
// ============================================================
//
// The July 3 direction, built: themes demote to presets, the ⚙ cog retires
// into this flyout, and the READING LOOK (ink + paper, per-reader) becomes
// the site's customization spine. Sections:
//   LOOK    — ink/paper dot rows (both polarities), the computed contrast
//             floor (2.0), Everywhere / Only-this-page scope, override chips
//   PRESETS — yours (save current look as…), the house, the archived themes
//   SEAT    — your accent swatch (chips/dots/bylines everywhere)
//   SHEET   — the cog's territory, absorbed: Download character (sheet-v2)
//             and the appearance panel (AppearanceUI mounts into
//             #appearance-drawer, which now lives HERE)
//
// Persistence: profiles.appearance via set_my_appearance (replace-not-merge:
// read current, merge keys, write the WHOLE object — the saveMyLook idiom).
// The deployed flat shape is kept: { ink, paper, accent, … } and grows
// { pageLooks: {page:{ink,paper}}, lookPresets: [{name,ink,paper}] }.
// Signed-out (or pre-auth) falls back to a localStorage mirror; the mirror
// also gives the first paint before the profile round-trip lands.
//
// Consumers listen for the `tok:look` CustomEvent (detail: { page,
// appearance:{ink,paper,pageLooks}, effective:{ink,paper} }) — the journal
// repaints its .sh-scope from `effective`. nav.js knows its page; so do we.
//
// ⚠ SYNC CONTRACT: INKS / PAPERS / FLOOR / the resolution helpers are
// MIRRORED from journal/src/shelf/shelfTheme.js (an ES module this classic
// script cannot import). smoke-settings-flyout.mjs parses both files and
// fails if the catalogs drift. Change BOTH.
// ============================================================

(function () {
  'use strict';

  // ── the catalog (MIRROR of shelfTheme.js — see sync contract) ──
  var INKS = [
    { key: 'sumi',      name: 'Sumi',      ink: '#26231E', accent: '#A93A26' },
    { key: 'indigo',    name: 'Indigo',    ink: '#2B3A55', accent: '#B4652E' },
    { key: 'forest',    name: 'Forest',    ink: '#2E4A38', accent: '#A93A26' },
    { key: 'vermilion', name: 'Vermilion', ink: '#953122', accent: '#26231E' },
    { key: 'sepia',     name: 'Sepia',     ink: '#54402C', accent: '#8A2F3C' },
    { key: 'plum',      name: 'Plum',      ink: '#463049', accent: '#946A2D' },
    { key: 'rose',      name: 'Rose',      ink: '#D98BA8', accent: '#8A2F3C' },
    { key: 'gold',      name: 'Gold',      ink: '#C9A227', accent: '#953122' },
    { key: 'glacier',   name: 'Glacier',   ink: '#A9C4D6', accent: '#B4652E' },
    { key: 'bonewhite', name: 'Bone',      ink: '#E7E0CE', accent: '#C9A227' },
  ];
  var PAPERS = [
    { key: 'bone',     name: 'Bone',     paper: '#E9E4D6', polarity: 'light' },
    { key: 'celadon',  name: 'Celadon',  paper: '#DEE5D8', polarity: 'light' },
    { key: 'blush',    name: 'Blush',    paper: '#ECDCD2', polarity: 'light' },
    { key: 'mist',     name: 'Mist',     paper: '#DCE1E4', polarity: 'light' },
    { key: 'straw',    name: 'Straw',    paper: '#EBE2C6', polarity: 'light' },
    { key: 'lilac',    name: 'Lilac',    paper: '#E3DEE8', polarity: 'light' },
    { key: 'charcoal', name: 'Charcoal', paper: '#1C1A17', polarity: 'dark' },
    { key: 'slate',    name: 'Slate',    paper: '#262B31', polarity: 'dark' },
    { key: 'pine',     name: 'Pine',     paper: '#1D2822', polarity: 'dark' },
    { key: 'walnut',   name: 'Walnut',   paper: '#2B211A', polarity: 'dark' },
  ];
  var FLOOR = 2.0;
  var DEFAULT_LOOK = { ink: 'sumi', paper: 'bone' };

  // presets live ONLY here (the journal never needs them)
  var HOUSE = [
    { name: 'Dark Academia', ink: 'bonewhite', paper: 'walnut' },
    { name: 'Field Notes',   ink: 'sepia',     paper: 'straw' },
    { name: 'Midnight Rose', ink: 'rose',      paper: 'charcoal' },
  ];
  // the five retired themes, archived as ink+paper pairings
  var ARCHIVES = [
    { name: 'Parchment',     ink: 'sepia',     paper: 'straw' },
    { name: 'Elysian',       ink: 'indigo',    paper: 'mist' },
    { name: 'Disco',         ink: 'vermilion', paper: 'blush' },
    { name: 'Phantom',       ink: 'sumi',      paper: 'bone' },
    { name: 'Phantom Night', ink: 'bonewhite', paper: 'charcoal' },
  ];
  var ACCENTS = ['#6f9fc9', '#9d7bd8', '#6faf7e', '#c96f6f', '#b8952a', '#d98ba8', '#5e8f8a', '#c9a227'];

  function inkOf(k) { for (var i = 0; i < INKS.length; i++) if (INKS[i].key === k) return INKS[i]; return INKS[0]; }
  function paperOf(k) { for (var i = 0; i < PAPERS.length; i++) if (PAPERS[i].key === k) return PAPERS[i]; return PAPERS[0]; }

  function lum(hex) {
    var n = parseInt(String(hex).replace('#', ''), 16);
    var s = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(function (v) {
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  }
  function contrastRatio(a, b) {
    var la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function isFloored(inkKey, paperKey) {
    return contrastRatio(inkOf(inkKey).ink, paperOf(paperKey).paper) < FLOOR;
  }
  function nearestLegibleInk(paperKey) {
    var P = paperOf(paperKey), best = INKS[0], bestC = 0;
    for (var i = 0; i < INKS.length; i++) {
      var c = contrastRatio(INKS[i].ink, P.paper);
      if (c > bestC) { bestC = c; best = INKS[i]; }
    }
    return best;
  }
  function resolveLookFor(appearance, page) {
    var a = appearance || {};
    var base = { ink: a.ink || DEFAULT_LOOK.ink, paper: a.paper || DEFAULT_LOOK.paper };
    var o = a.pageLooks && page && a.pageLooks[page];
    if (o && (o.ink || o.paper)) return { ink: o.ink || base.ink, paper: o.paper || base.paper };
    return base;
  }

  // ── state ──
  var CACHE_KEY = 'tok-look-cache';
  var appearance = {};        // the WHOLE profiles.appearance object (all keys preserved)
  var scope = 'all';          // 'all' | 'page' — a UI mode, never persisted
  var open = false;
  var sb = null, uid = null;

  function pageKey() {
    var parts = window.location.pathname.split('/');
    var file = parts[parts.length - 1] || 'index.html';
    return file.replace(/\.html$/, '') || 'index';
  }
  var PAGE = pageKey();
  var PAGE_LABEL = PAGE.charAt(0).toUpperCase() + PAGE.slice(1);

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        ink: appearance.ink, paper: appearance.paper,
        pageLooks: appearance.pageLooks, lookPresets: appearance.lookPresets,
        accent: appearance.accent,
      }));
    } catch (e) { /* private mode etc. — the profile is still the truth */ }
  }

  // replace-not-merge: read current, merge keys, write the WHOLE object
  // (the saveMyLook idiom — unknown keys like backgrounds survive untouched)
  var saveTimer = null;
  function persist() {
    writeCache();
    if (!sb || !uid) return;                       // signed-out: mirror only
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      sb.from('profiles').select('appearance').eq('user_id', uid).maybeSingle()
        .then(function (cur) {
          if (cur.error) throw new Error(cur.error.message);
          var merged = Object.assign({}, (cur.data && cur.data.appearance) || {}, appearance);
          appearance = merged;                     // adopt server-side keys we didn't have
          return sb.rpc('set_my_appearance', { p_appearance: merged });
        })
        .then(function (res) { if (res && res.error) throw new Error(res.error.message); })
        .catch(function (e) { console.error('[settings] look save failed:', e); });
    }, 250);
  }

  function effective() { return resolveLookFor(appearance, PAGE); }

  function announce() {
    document.dispatchEvent(new CustomEvent('tok:look', {
      detail: {
        page: PAGE,
        appearance: { ink: appearance.ink, paper: appearance.paper, pageLooks: appearance.pageLooks || {} },
        effective: effective(),
      },
    }));
  }

  function writeLook(patch) {
    if (scope === 'page') {
      var pl = Object.assign({}, appearance.pageLooks || {});
      pl[PAGE] = Object.assign({}, pl[PAGE] || effective(), patch);
      appearance.pageLooks = pl;
    } else {
      Object.assign(appearance, patch);
    }
    persist(); announce(); render();
  }

  // ── styles (injected once, namespaced .tokset-*) ──
  function injectStyles() {
    if (document.getElementById('tokset-styles')) return;
    var s = document.createElement('style');
    s.id = 'tokset-styles';
    s.textContent = [
      '.tokset{position:fixed;top:58px;right:10px;z-index:1200;width:min(400px,94vw);max-height:calc(100vh - 74px);',
      'overflow-y:auto;overscroll-behavior:contain;background:var(--ts-paper,#E9E4D6);color:var(--ts-ink,#26231E);',
      'border:1px solid color-mix(in srgb,var(--ts-ink,#26231E) 26%,transparent);box-shadow:0 18px 48px rgba(10,8,4,.45);',
      'font-family:"Archivo","Helvetica Neue",sans-serif;-webkit-font-smoothing:antialiased;',
      'transform:translateY(-8px);opacity:0;pointer-events:none;transition:transform .25s cubic-bezier(.2,.8,.2,1),opacity .2s ease,background .4s ease,color .4s ease}',
      '.tokset.is-open{transform:translateY(0);opacity:1;pointer-events:auto}',
      '.tokset::-webkit-scrollbar{width:8px}.tokset::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--ts-ink) 26%,transparent)}',
      '.tokset *{box-sizing:border-box}',
      '.tokset button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;text-align:left;padding:0}',
      '.ts-head{display:flex;align-items:baseline;justify-content:space-between;padding:14px 16px 11px;border-bottom:1px solid color-mix(in srgb,var(--ts-ink) 26%,transparent)}',
      '.ts-title{font-size:15px;letter-spacing:.14em;text-transform:uppercase;font-weight:700}',
      '.ts-sub{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:600;opacity:.55}',
      '.ts-sec{padding:13px 16px 15px;border-bottom:1px solid color-mix(in srgb,var(--ts-ink) 26%,transparent)}',
      '.ts-sec:last-child{border-bottom:0}',
      '.ts-lbl{font-size:9.5px;letter-spacing:.24em;text-transform:uppercase;font-weight:700;color:var(--ts-accent,#A93A26);margin-bottom:10px}',
      '.ts-lbl .h{float:right;font-weight:600;letter-spacing:.12em;opacity:.55;color:var(--ts-ink)}',
      '.ts-row{display:flex;align-items:center;gap:8px;margin-bottom:9px;flex-wrap:wrap}',
      '.ts-axis{width:40px;flex:0 0 auto;font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;font-weight:600;opacity:.55}',
      '.ts-dot{width:18px;height:18px;border-radius:50%;border:1px solid color-mix(in srgb,var(--ts-ink) 26%,transparent);position:relative;transition:transform .15s ease,opacity .2s ease;flex:0 0 auto}',
      '.ts-dot:hover{transform:scale(1.2)}',
      '.ts-dot.is-active::after{content:"";position:absolute;inset:-4px;border:1px solid var(--ts-ink);border-radius:50%}',
      '.ts-dot.is-floored{opacity:.22;cursor:not-allowed}',
      '.ts-dot.is-floored::before{content:"";position:absolute;left:-3px;right:-3px;top:50%;border-top:1.5px solid color-mix(in srgb,var(--ts-ink) 45%,transparent);transform:rotate(-45deg)}',
      '.ts-dot.is-floored:hover{transform:none}',
      '.ts-gap{width:7px;border-left:1px solid color-mix(in srgb,var(--ts-ink) 26%,transparent);height:15px;margin:0 1px;flex:0 0 auto}',
      '.ts-scope{display:flex;gap:7px;align-items:center;margin-top:10px;flex-wrap:wrap}',
      '.ts-scope-btn{font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;padding:5px 9px 4px;border:1px solid color-mix(in srgb,var(--ts-ink) 26%,transparent);opacity:.65}',
      '.ts-scope-btn.is-on{background:var(--ts-ink);color:var(--ts-paper);border-color:var(--ts-ink);opacity:1}',
      '.ts-ochip{display:inline-flex;align-items:center;gap:5px;font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;border:1px dashed color-mix(in srgb,var(--ts-ink) 26%,transparent);padding:4px 7px;opacity:.8}',
      '.ts-ochip .sw{width:8px;height:8px;border-radius:50%;display:inline-block}',
      '.ts-ochip button{font-size:11px;opacity:.6}',
      '.ts-presets{display:flex;flex-wrap:wrap;gap:7px}',
      '.ts-preset{display:inline-flex;align-items:center;gap:6px;border:1px solid color-mix(in srgb,var(--ts-ink) 26%,transparent);padding:5px 9px 4px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;opacity:.85}',
      '.ts-preset:hover{background:color-mix(in srgb,var(--ts-ink) 7%,transparent)}',
      '.ts-preset .pair{display:inline-flex}',
      '.ts-preset .pair i{width:10px;height:10px;border-radius:50%;border:1px solid color-mix(in srgb,var(--ts-ink) 26%,transparent)}',
      '.ts-preset .pair i+i{margin-left:-4px}',
      '.ts-preset .del{font-style:normal;opacity:.55;margin-left:2px}',
      '.ts-kick{font-size:8px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;opacity:.5;margin:11px 0 6px}',
      '.ts-kick:first-child{margin-top:0}',
      '.ts-saveas{display:flex;gap:8px;margin-top:10px}',
      '.ts-saveas input{flex:1 1 auto;min-width:0;font-family:"EB Garamond",Georgia,serif;font-size:13.5px;background:none;color:var(--ts-ink);border:0;border-bottom:1px solid color-mix(in srgb,var(--ts-ink) 26%,transparent);padding:3px 2px;outline:none}',
      '.ts-saveas input:focus{border-bottom-color:var(--ts-accent)}',
      '.ts-saveas input::placeholder{color:var(--ts-ink);opacity:.4}',
      '.ts-saveas button{font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;border:1px solid var(--ts-ink);background:var(--ts-ink);color:var(--ts-paper);padding:5px 11px 4px}',
      '.ts-note{font-family:"EB Garamond",Georgia,serif;font-style:italic;font-size:12px;opacity:.55;margin-top:8px}',
      '.ts-mrow{display:flex;align-items:center;justify-content:space-between;width:100%;padding:7px 0;font-size:11px;letter-spacing:.06em;font-weight:600;opacity:.85}',
      '.ts-mrow .car{opacity:.5}',
      '.ts-sheet-drawer{margin-top:6px}',
      '.ts-sheet-drawer .appearance-drawer{position:static;display:block}',
      '.ts-sub-a{display:block;width:100%;padding:6px 0 6px 14px;font-size:10.5px;letter-spacing:.06em;opacity:.75}',
      '.ts-sub-a:hover{opacity:1;color:var(--ts-accent)}',
      '.ts-subacts{display:none}.ts-subacts.open{display:block}',
      '.ts-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(60px);background:#121009;color:#e9e4d6;font-size:10.5px;letter-spacing:.06em;padding:9px 15px;opacity:0;transition:transform .3s ease,opacity .3s ease;z-index:1300;max-width:92vw;text-align:center;font-family:"Archivo",sans-serif}',
      '.ts-toast.is-on{transform:translateX(-50%) translateY(0);opacity:1}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── render ──
  var root = null, toastEl = null, toastTimer = null;

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }

  function dot(color, title, active, floored, onclick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ts-dot' + (active ? ' is-active' : '') + (floored ? ' is-floored' : '');
    b.style.background = color;
    b.title = title; b.setAttribute('aria-label', title);
    if (floored) b.disabled = true;
    else if (onclick) b.addEventListener('click', onclick);
    return b;
  }

  function presetChip(p, mine) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'ts-preset';
    b.innerHTML = '<span class="pair"><i style="background:' + inkOf(p.ink).ink + '"></i><i style="background:'
      + paperOf(p.paper).paper + '"></i></span>' + p.name + (mine ? ' <i class="del" title="Delete">×</i>' : '');
    b.addEventListener('click', function (e) {
      if (mine && e.target.classList && e.target.classList.contains('del')) {
        appearance.lookPresets = (appearance.lookPresets || []).filter(function (x) { return x !== p; });
        persist(); render(); return;
      }
      writeLook({ ink: p.ink, paper: p.paper });
    });
    return b;
  }

  function render() {
    if (!root) return;
    var eff = effective();
    var I = inkOf(eff.ink), P = paperOf(eff.paper);
    root.style.setProperty('--ts-ink', I.ink);
    root.style.setProperty('--ts-accent', I.accent);
    root.style.setProperty('--ts-paper', P.paper);
    root.setAttribute('data-polarity', P.polarity);

    var pn = root.querySelector('#ts-pair'); if (pn) pn.textContent = I.name + ' on ' + P.name;

    // ink row — floored against the CURRENT paper (computed, never curated)
    var ri = root.querySelector('#ts-inks'); ri.innerHTML = '';
    INKS.forEach(function (ink, idx) {
      var c = contrastRatio(ink.ink, P.paper);
      var floored = c < FLOOR;
      var title = floored
        ? ink.name + ' — too faint on ' + P.name + ' (' + c.toFixed(1) + ':1)'
        : 'Ink: ' + ink.name;
      ri.appendChild(dot(ink.ink, title, ink.key === eff.ink, floored, function () {
        writeLook({ ink: ink.key });
      }));
      if (idx === 5) { var g = document.createElement('span'); g.className = 'ts-gap'; ri.appendChild(g); }
    });

    // paper row — the stranding nudge answers a paper switch that drops the
    // held ink below the floor
    var rp = root.querySelector('#ts-papers'); rp.innerHTML = '';
    PAPERS.forEach(function (pp, idx) {
      rp.appendChild(dot(pp.paper, 'Paper: ' + pp.name + (pp.polarity === 'dark' ? ' (dark)' : ''),
        pp.key === eff.paper, false, function () {
          var cur = inkOf(effective().ink);
          var patch = { paper: pp.key };
          if (contrastRatio(cur.ink, pp.paper) < FLOOR) {
            var nk = nearestLegibleInk(pp.key);
            patch.ink = nk.key;
            toast('Ink switched to ' + nk.name + ' — ' + cur.name + ' is illegible on ' + pp.name + '.');
          }
          writeLook(patch);
        }));
      if (idx === 5) { var g = document.createElement('span'); g.className = 'ts-gap'; rp.appendChild(g); }
    });

    // scope
    root.querySelectorAll('.ts-scope-btn').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.scope === scope);
    });
    var oc = root.querySelector('#ts-ochips'); oc.innerHTML = '';
    var pls = appearance.pageLooks || {};
    Object.keys(pls).forEach(function (pg) {
      var o = pls[pg]; if (!o || (!o.ink && !o.paper)) return;
      var chip = document.createElement('span'); chip.className = 'ts-ochip';
      chip.innerHTML = '<span class="sw" style="background:' + inkOf(o.ink || appearance.ink).ink + '"></span>'
        + '<span class="sw" style="background:' + paperOf(o.paper || appearance.paper).paper + '"></span>'
        + pg + ' <button type="button" title="Clear the ' + pg + ' override">×</button>';
      chip.querySelector('button').addEventListener('click', function () {
        var pl = Object.assign({}, appearance.pageLooks); delete pl[pg];
        appearance.pageLooks = pl;
        if (scope === 'page' && pg === PAGE) scope = 'all';
        persist(); announce(); render();
      });
      oc.appendChild(chip);
    });

    // presets
    var mine = root.querySelector('#ts-mine'); mine.innerHTML = '';
    var my = appearance.lookPresets || [];
    if (!my.length) {
      var e = document.createElement('span'); e.className = 'ts-note'; e.style.margin = '0';
      e.textContent = 'None yet — set a look and save it.'; mine.appendChild(e);
    }
    my.forEach(function (p) { mine.appendChild(presetChip(p, true)); });
    var house = root.querySelector('#ts-house'); house.innerHTML = '';
    HOUSE.forEach(function (p) { house.appendChild(presetChip(p, false)); });
    var arch = root.querySelector('#ts-arch'); arch.innerHTML = '';
    ARCHIVES.forEach(function (p) { arch.appendChild(presetChip(p, false)); });

    // seat accent
    var ar = root.querySelector('#ts-accents'); ar.innerHTML = '';
    ACCENTS.forEach(function (hex) {
      ar.appendChild(dot(hex, 'Accent ' + hex,
        (appearance.accent || '').toLowerCase() === hex.toLowerCase(), false, function () {
          appearance.accent = hex;
          persist(); render();
          toast('Seat accent saved — chips and bylines repaint on next load.');
        }));
    });
  }

  function build() {
    if (root) return;
    injectStyles();
    root = document.createElement('aside');
    root.className = 'tokset';
    root.id = 'tok-settings';
    root.setAttribute('aria-label', 'Settings');
    var onSheet = PAGE === 'sheet-v2';
    root.innerHTML = [
      '<div class="ts-head"><span class="ts-title">Settings</span><span class="ts-sub">per-reader · saved to your seat</span></div>',
      '<section class="ts-sec">',
      '  <div class="ts-lbl">Look <span class="h" id="ts-pair"></span></div>',
      '  <div class="ts-row"><span class="ts-axis">Ink</span><span id="ts-inks" style="display:contents"></span></div>',
      '  <div class="ts-row"><span class="ts-axis">Paper</span><span id="ts-papers" style="display:contents"></span></div>',
      '  <div class="ts-scope" id="ts-scope">',
      '    <button type="button" class="ts-scope-btn" data-scope="all">Everywhere</button>',
      '    <button type="button" class="ts-scope-btn" data-scope="page">Only on ' + PAGE_LABEL + '</button>',
      '    <span id="ts-ochips" style="display:contents"></span>',
      '  </div>',
      '</section>',
      '<section class="ts-sec">',
      '  <div class="ts-lbl">Presets</div>',
      '  <div class="ts-kick">Yours</div><div class="ts-presets" id="ts-mine"></div>',
      '  <div class="ts-saveas"><input id="ts-savename" type="text" placeholder="Save current look as…" maxlength="24" aria-label="Preset name"><button type="button" id="ts-savebtn">Save</button></div>',
      '  <div class="ts-kick">The house</div><div class="ts-presets" id="ts-house"></div>',
      '  <div class="ts-kick">From the archives — the old themes</div><div class="ts-presets" id="ts-arch"></div>',
      '</section>',
      '<section class="ts-sec">',
      '  <div class="ts-lbl">Seat accent <span class="h">your chips, everywhere</span></div>',
      '  <div class="ts-row" id="ts-accents" style="margin:0"></div>',
      '</section>',
      '<section class="ts-sec" id="ts-sheet-sec" hidden>',
      '  <div class="ts-lbl">Sheet</div>',
      (onSheet
        ? '  <button class="ts-mrow" type="button" id="ts-row-download"><span>⤓&nbsp; Download character</span><span class="car">▸</span></button>'
          + '<div class="ts-subacts" id="ts-sub-download">'
          + '<button class="ts-sub-a" type="button" id="ts-dl-print">Print / PDF</button>'
          + '<button class="ts-sub-a" type="button" id="ts-dl-json">Download JSON</button></div>'
        : ''),
      '  <button class="ts-mrow" type="button" id="ts-row-appearance"><span>⚙&nbsp; Sheet appearance</span><span class="car">▸</span></button>',
      '  <div class="ts-sheet-drawer ts-subacts" id="ts-sheet-drawer"><div class="appearance-drawer" id="appearance-drawer" aria-label="Appearance settings"></div></div>',
      '</section>',
      '<section class="ts-sec" id="tokset-extra" hidden></section>',
    ].join('\n');
    document.body.appendChild(root);

    toastEl = document.createElement('div');
    toastEl.className = 'ts-toast'; toastEl.setAttribute('role', 'status');
    document.body.appendChild(toastEl);

    // scope
    root.querySelector('#ts-scope').addEventListener('click', function (e) {
      var b = e.target.closest('.ts-scope-btn'); if (!b) return;
      scope = b.dataset.scope;
      if (scope === 'page') {
        var pl = Object.assign({}, appearance.pageLooks || {});
        if (!pl[PAGE]) pl[PAGE] = effective();
        appearance.pageLooks = pl;
        persist(); announce();
      }
      render();
    });

    // save-as
    function saveCurrent() {
      var inp = root.querySelector('#ts-savename');
      var name = inp.value.trim();
      if (!name) { toast('Name the look first.'); return; }
      var eff = effective();
      appearance.lookPresets = (appearance.lookPresets || []).concat([{ name: name, ink: eff.ink, paper: eff.paper }]);
      inp.value = '';
      persist(); render();
      toast('Saved “' + name + '” — yours alone.');
    }
    root.querySelector('#ts-savebtn').addEventListener('click', saveCurrent);
    root.querySelector('#ts-savename').addEventListener('keydown', function (e) { if (e.key === 'Enter') saveCurrent(); });

    // the cog's territory — only shown where a page wired appearance
    // (appearance-boot adds html.has-appearance) or on the sheet
    var sheetSec = root.querySelector('#ts-sheet-sec');
    function maybeShowSheet() {
      if (onSheet || document.documentElement.classList.contains('has-appearance') || window.AppearanceUI) {
        sheetSec.hidden = false;
      }
    }
    maybeShowSheet();
    setTimeout(maybeShowSheet, 1500);   // appearance-boot loads async

    root.querySelector('#ts-row-appearance').addEventListener('click', function () {
      if (window.AppearanceUI && window.AppearanceUI.mount) window.AppearanceUI.mount();
      root.querySelector('#ts-sheet-drawer').classList.toggle('open');
    });
    if (onSheet) {
      root.querySelector('#ts-row-download').addEventListener('click', function () {
        root.querySelector('#ts-sub-download').classList.toggle('open');
      });
      root.querySelector('#ts-dl-print').addEventListener('click', function () { close(); window.print(); });
      root.querySelector('#ts-dl-json').addEventListener('click', function () {
        if (typeof window.__downloadCharacterJSON === 'function') window.__downloadCharacterJSON(this);
      });
    }

    // close on Esc / outside click
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) close();
    });
    document.addEventListener('click', function (e) {
      if (!open) return;
      if (root.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.nav-theme-btn')) return;
      close();
    });

    render();
  }

  function openFly() {
    build();
    open = true;
    root.classList.add('is-open');
    var b = document.querySelector('.nav-theme-btn'); if (b) b.setAttribute('aria-expanded', 'true');
  }
  function close() {
    if (!root) return;
    open = false;
    root.classList.remove('is-open');
    var b = document.querySelector('.nav-theme-btn'); if (b) b.setAttribute('aria-expanded', 'false');
  }
  function toggle(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    open ? close() : openFly();
  }

  // ── boot: cache paints first, the profile is the truth ──
  appearance = readCache();
  announce();

  // Build EAGERLY (closed): #tokset-extra and #appearance-drawer must exist
  // for late arrivals (battle.js's mobile section, AppearanceUI) without
  // waiting for the first ◐ press.
  function whenBody(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }
  whenBody(function () {
    build();
    document.dispatchEvent(new CustomEvent('tok:settings-ready'));
  });

  (async function loadProfile() {
    try {
      if (window.__tok && window.__tok.ready) await window.__tok.ready;
      sb = window.__tok && window.__tok.sb;
      uid = window.__tok && window.__tok.session && window.__tok.session.user && window.__tok.session.user.id;
      if (sb && uid) {
        var res = await sb.from('profiles').select('appearance').eq('user_id', uid).maybeSingle();
        if (!res.error && res.data && res.data.appearance) {
          appearance = Object.assign({}, appearance, res.data.appearance);
          writeCache();
        }
      }
    } catch (e) { /* cache/default already announced */ }
    announce();
    if (root) render();
  })();

  window.TokSettings = { toggle: toggle, open: openFly, close: close, isOpen: function () { return open; } };
})();
