/* characters-tab.js — the rail's Characters roster (CHARACTERS-TAB-V1)
 *
 * Registers a site-wide "Characters" tab via TokRail.registerTab (the proven
 * seam). Lists every character from CharacterData.loadParty, grouped into folders
 * from the shared roster_layout doc (CharacterData.load/saveLayout). A row tap
 * opens that character's mounted v11 sheet; the visible actions button also
 * offers the full sheet page, move, and deletion controls on touch devices.
 * Soft-delete (mark / restore / staff delete) and folder ops (create / rename /
 * move) ride along. Drag-to-move is a later polish pass; v1 moves via a menu.
 *
 * Injected by rail.js alongside feed-render.js. Self-contained: ensures
 * character-data.js, injects its own scoped CSS, registers on tok-rail:ready.
 */
(function () {
  'use strict';
  if (window.__tokCharactersTab) return;
  window.__tokCharactersTab = true;

  var STATE = { chars: [], layout: {}, collapsed: loadCollapsed(), staff: false, menu: null, picker: null };

  // ── tiny DOM helpers ─────────────────────────────────────────────────────
  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function CD() { return window.CharacterData; }

  // ── dependency loaders ────────────────────────────────────────────────────
  function existsScript(file) { return !!document.querySelector('script[src$="' + file + '"]'); }
  function loadScript(file, asModule) {
    return new Promise(function (res, rej) {
      if (existsScript(file)) { res(); return; }
      var s = document.createElement('script');
      if (asModule) s.type = 'module';
      s.src = file;
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error('load failed: ' + file)); };
      document.head.appendChild(s);
    });
  }
  function loadCssOnce(file) {
    if (document.querySelector('link[href$="' + file + '"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = file; document.head.appendChild(l);
  }
  function waitFor(test, ms) {
    return new Promise(function (res, rej) {
      if (test()) { res(); return; }
      var t0 = Date.now();
      var iv = setInterval(function () {
        if (test()) { clearInterval(iv); res(); }
        else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error('timeout')); }
      }, 40);
    });
  }
  function ensureCharacterData() {
    // Check the METHOD, not just presence. On pages that inject character-data.js
    // (rather than loading it via a static <script>), an older cached/deployed copy
    // can define window.CharacterData WITHOUT loadParty — a bare `if (window.CharacterData)`
    // would pass and then CD().loadParty throws "not a function". If a partial copy is
    // present, a plain re-inject would re-hit the same file, so cache-bust to force a
    // fresh fetch; the fresh module's IIFE overwrites the stale window.CharacterData.
    if (window.CharacterData && typeof window.CharacterData.loadParty === 'function') return Promise.resolve();
    var src = window.CharacterData ? ('character-data.js?v=' + Date.now()) : 'character-data.js';
    return loadScript(src).then(function () { return waitFor(function () { return !!(window.CharacterData && typeof window.CharacterData.loadParty === 'function'); }, 5000); });
  }
  // The v11 sheet's deps, in order — mirrors sheet-v2.html's includes. Most pages
  // don't load these, so we inject the missing ones the first time a sheet opens.
  function ensureSheetDeps() {
    if (window.mountSheet) return Promise.resolve();
    loadCssOnce('sheet-mount.css?v=ca1');
    return Promise.resolve()
      .then(function () { return window.CharacterData ? null : loadScript('character-data.js'); })
      .then(function () { return window.ResourceDerive ? null : loadScript('resource-derive.js'); })
      .then(function () { return existsScript('dice-engine.js') ? null : loadScript('dice-engine.js'); })
      .then(function () { return window.mountSheet ? null : loadScript('sheet-mount.js?v=facets1', true); })
      .then(function () { return waitFor(function () { return !!window.mountSheet; }, 5000); });
  }

  // ── collapse state (a per-user view pref, kept local) ──────────────────────
  function loadCollapsed() { try { return JSON.parse(localStorage.getItem('tok-roster-collapsed') || '[]') || []; } catch (e) { return []; } }
  function saveCollapsed() { try { localStorage.setItem('tok-roster-collapsed', JSON.stringify(STATE.collapsed)); } catch (e) {} }
  function isCollapsed(id) { return STATE.collapsed.indexOf(id) !== -1; }
  function toggleCollapsed(id) {
    var i = STATE.collapsed.indexOf(id);
    if (i === -1) STATE.collapsed.push(id); else STATE.collapsed.splice(i, 1);
    saveCollapsed();
  }

  // ── layout helpers ────────────────────────────────────────────────────────
  function normLayout(layout) {
    layout = layout || {};
    return {
      folders: Array.isArray(layout.folders) ? layout.folders.slice() : [],
      order: Array.isArray(layout.order) ? layout.order.slice() : (Array.isArray(layout.folders) ? layout.folders.map(function (f) { return f.id; }) : []),
      members: Object.assign({}, layout.members || {})
    };
  }
  // Pure: characters + layout -> { folders:[{id,name,chars}], unfiled:[chars] }.
  // Exposed for tests. Unfiled = characters not in members or pointing at a gone folder.
  function groupRoster(characters, layout) {
    layout = layout || {};
    var folders = Array.isArray(layout.folders) ? layout.folders : [];
    var order = Array.isArray(layout.order) ? layout.order : folders.map(function (f) { return f.id; });
    var members = layout.members || {};
    var byId = {};
    folders.forEach(function (f) { if (f && f.id) byId[f.id] = { id: f.id, name: f.name || 'Folder', chars: [] }; });
    var unfiled = [];
    (characters || []).forEach(function (ch) {
      var fid = members[ch.key];
      if (fid && byId[fid]) byId[fid].chars.push(ch); else unfiled.push(ch);
    });
    var ordered = [], seen = {};
    order.forEach(function (id) { if (byId[id] && !seen[id]) { ordered.push(byId[id]); seen[id] = true; } });
    folders.forEach(function (f) { if (f && f.id && byId[f.id] && !seen[f.id]) { ordered.push(byId[f.id]); seen[f.id] = true; } });
    return { folders: ordered, unfiled: unfiled };
  }

  // ── presentation bits ─────────────────────────────────────────────────────
  function classLine(ch) {
    var s = ch.structural || {};
    var label = s.classLabel || '';
    if (s.subclass) label += (label ? ' · ' : '') + s.subclass;
    if (!label && s.race) label = s.race;
    return label || '—';
  }
  function initialOf(ch) { var n = (ch.name || ch.key || '?').trim(); return n ? n[0].toUpperCase() : '?'; }

  var ICON = {
    mark: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 3.5h7M5 3V2h2v1M3.5 3.5l.4 6h4.2l.4-6"/></svg>',
    move: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1.5 3.5l1-1.2h2.2l.8 1h4.5V9.5h-8.5z"/></svg>',
    chev: '<svg class="fold-chev" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 2l4 3.5L3 9"/></svg>',
    rename: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M8.5 2l1.5 1.5-6 6L2 10l.5-2z"/></svg>',
    more: '<svg viewBox="0 0 14 14" fill="currentColor"><circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="11" cy="7" r="1.2"/></svg>'
  };

  function rowHTML(ch) {
    if (ch.deleteMarked) {
      return '<div class="ch-row marked" data-key="' + esc(ch.key) + '">'
        + '<div class="ch-av"><span class="ch-av-i">' + esc(initialOf(ch)) + '</span></div>'
        + '<div class="ch-body2"><div class="ch-name">' + esc(ch.name) + '</div>'
        + '<div class="ch-cls">' + esc(classLine(ch)) + '</div>'
        + '<div class="ch-trash"><button class="ch-tb restore" data-act="restore">Restore</button>'
        + (STATE.staff ? '<button class="ch-tb del" data-act="delete">Delete</button>' : '<span class="ch-staffnote">awaiting staff</span>')
        + '</div></div></div>';
    }
    return '<div class="ch-row" data-key="' + esc(ch.key) + '" data-act="open">'
      + '<div class="ch-av"><span class="ch-av-i">' + esc(initialOf(ch)) + '</span></div>'
      + '<div class="ch-body2"><div class="ch-name">' + esc(ch.name) + '</div>'
      + '<div class="ch-cls">' + esc(classLine(ch)) + '</div></div>'
      + '<button class="ch-more" data-act="actions" type="button" aria-label="Actions for ' + esc(ch.name) + '" title="Character actions">' + ICON.more + '</button>'
      + '</div>';
  }
  function folderHTML(id, name, chars, isUnfiled) {
    var collapsed = isCollapsed(id);
    return '<div class="fold' + (collapsed ? ' collapsed' : '') + (isUnfiled ? ' unfiled' : '') + '" data-fold="' + esc(id) + '">'
      + '<div class="fold-h" data-act="collapse">' + ICON.chev
      + '<span class="fold-name">' + esc(name) + '</span>'
      + '<span class="fold-ct">' + chars.length + '</span>'
      + (isUnfiled ? '' : '<span class="fold-tools"><button class="fold-tool" data-act="rename" title="Rename">' + ICON.rename + '</button></span>')
      + '</div>'
      + '<div class="fold-body">' + (chars.length ? chars.map(rowHTML).join('') : '<div class="fold-empty">empty</div>') + '</div>'
      + '</div>';
  }

  function topHTML() {
    return '<div class="ch-top">'
      + '<button class="ch-open" data-act="picker"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 2.5v9M2.5 7h9"/></svg> Open a sheet</button>'
      + '<button class="ch-reforge" data-act="forge">Reforger</button>'
      + '<button class="ch-newfolder" data-act="addfolder" title="New folder" aria-label="New folder"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1.5 4l1.2-1.5h3l1 1.2h5.3V11.5H1.5z"/><path d="M7 6.5v3M5.5 8h3" stroke-width="1.3"/></svg></button>'
      + '</div>';
  }

  // ── render + refresh ──────────────────────────────────────────────────────
  function render(pane) {
    pane.innerHTML = topHTML() + '<div class="ch-list" data-charlist><div class="ch-empty">Loading roster…</div></div>';
    pane.addEventListener('click', onPaneClick);
    pane.addEventListener('contextmenu', onPaneContext);
    refresh(pane);
  }
  function refresh(pane) {
    var list = (pane || document).querySelector('[data-charlist]');
    if (!list) return;
    ensureCharacterData().then(function () {
      return Promise.all([CD().loadParty(), CD().loadLayout().catch(function () { return {}; })]);
    }).then(function (res) {
      STATE.chars = res[0] || []; STATE.layout = res[1] || {};
      paint(list);
    }).catch(function (e) {
      list.innerHTML = '<div class="ch-empty">Couldn’t load characters (' + esc((e && e.message) || 'error') + ').</div>';
    });
  }
  function paint(list) {
    var g = groupRoster(STATE.chars, STATE.layout);
    var html = '';
    g.folders.forEach(function (f) { html += folderHTML(f.id, f.name, f.chars, false); });
    html += folderHTML('__unfiled', 'Unfiled', g.unfiled, true);
    list.innerHTML = (STATE.chars.length ? html : '<div class="ch-empty">No characters yet — forge one.</div>');
  }
  function repaint() { var list = document.querySelector('[data-charlist]'); if (list) paint(list); }

  // ── interactions ──────────────────────────────────────────────────────────
  function onPaneClick(e) {
    var actEl = e.target.closest('[data-act]');
    if (!actEl) return;
    var act = actEl.getAttribute('data-act');
    var row = e.target.closest('.ch-row');
    var key = row && row.getAttribute('data-key');
    var fold = e.target.closest('.fold');
    var fid = fold && fold.getAttribute('data-fold');

    if (act === 'forge') { window.location.href = 'shards.html'; return; }
    if (act === 'picker') { openSheetPicker(); return; }
    if (act === 'addfolder') { addFolder(); return; }
    if (act === 'collapse') { if (fid) { toggleCollapsed(fid); repaint(); } return; }
    if (act === 'rename') { e.stopPropagation(); if (fid) renameFolder(fid); return; }
    if (act === 'actions') { e.stopPropagation(); if (key) openActionsMenu(actEl, key); return; }
    if (act === 'mark') { e.stopPropagation(); if (key) doMark(key, true); return; }
    if (act === 'restore') { if (key) doMark(key, false); return; }
    if (act === 'delete') { if (key) doDelete(key); return; }
    if (act === 'open') { if (key) { var oc = STATE.chars.filter(function (x) { return x.key === key; })[0]; openSheet(key, oc && oc.name); } return; }
  }

  function onPaneContext(e) {
    var row = e.target.closest('.ch-row[data-act="open"]');
    if (!row) return;
    var anchor = row.querySelector('.ch-more');
    if (!anchor) return;
    e.preventDefault();
    openActionsMenu(anchor, row.getAttribute('data-key'));
  }

  function doMark(key, marked) {
    CD().markDeletion(key, marked).then(function () {
      var c = STATE.chars.filter(function (x) { return x.key === key; })[0]; if (c) c.deleteMarked = marked;
      repaint();
    }).catch(function (e) { alert('Could not update: ' + ((e && e.message) || 'error')); });
  }
  function doDelete(key) {
    var c = STATE.chars.filter(function (x) { return x.key === key; })[0];
    if (!window.confirm('Permanently delete ' + ((c && c.name) || key) + '? This cannot be undone.')) return;
    CD().remove(key).then(function () {
      STATE.chars = STATE.chars.filter(function (x) { return x.key !== key; });
      var l = normLayout(STATE.layout); delete l.members[key]; STATE.layout = l; CD().saveLayout(l).catch(function () {});
      repaint();
    }).catch(function (e) { alert('Delete failed: ' + ((e && e.message) || 'error')); });
  }
  function addFolder() {
    var name = (window.prompt('New folder name:') || '').trim(); if (!name) return;
    var l = normLayout(STATE.layout);
    var id = 'f_' + Math.random().toString(16).slice(2, 6);
    l.folders.push({ id: id, name: name }); l.order.push(id);
    STATE.layout = l; saveAndRepaint();
  }
  function renameFolder(fid) {
    var l = normLayout(STATE.layout);
    var f = l.folders.filter(function (x) { return x.id === fid; })[0]; if (!f) return;
    var name = (window.prompt('Rename folder:', f.name) || '').trim(); if (!name) return;
    f.name = name; STATE.layout = l; saveAndRepaint();
  }
  function moveChar(key, fid) {
    var l = normLayout(STATE.layout);
    if (fid === '__new') {
      var name = (window.prompt('New folder name:') || '').trim(); if (!name) return;
      var id = 'f_' + Math.random().toString(16).slice(2, 6);
      l.folders.push({ id: id, name: name }); l.order.push(id); fid = id;
    }
    if (fid === '__unfiled') delete l.members[key]; else l.members[key] = fid;
    STATE.layout = l; saveAndRepaint();
  }
  function saveAndRepaint() { repaint(); CD().saveLayout(STATE.layout).catch(function (e) { console.warn('[characters] saveLayout failed', e); }); }

  // move-to-folder popover
  function closeMoveMenu() { if (STATE.menu) { STATE.menu.remove(); STATE.menu = null; document.removeEventListener('click', closeMoveOutside, true); } }
  function closeMoveOutside(e) { if (STATE.menu && !STATE.menu.contains(e.target)) closeMoveMenu(); }
  function openMoveMenu(anchor, key) {
    closeMoveMenu();
    var g = groupRoster(STATE.chars, STATE.layout);
    var items = g.folders.map(function (f) { return '<button class="ch-mi" data-mv="' + esc(f.id) + '">' + esc(f.name) + '</button>'; });
    items.push('<button class="ch-mi" data-mv="__unfiled">Unfiled</button>');
    items.push('<button class="ch-mi ch-mi-new" data-mv="__new">+ New folder…</button>');
    var m = el('div', 'ch-menu'); m.innerHTML = items.join('');
    document.body.appendChild(m);
    var r = anchor.getBoundingClientRect();
    m.style.top = (r.bottom + 4) + 'px';
    m.style.left = Math.max(8, Math.min(r.left - 120, window.innerWidth - 188)) + 'px';
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mv]'); if (!b) return;
      moveChar(key, b.getAttribute('data-mv')); closeMoveMenu();
    });
    STATE.menu = m;
    setTimeout(function () { document.addEventListener('click', closeMoveOutside, true); }, 0);
  }

  function sheetPageHref(key) { return 'sheet-v2.html?character=' + encodeURIComponent(key || ''); }

  // One visible touch target replaces the two hover-only row buttons. The same
  // menu also answers the desktop secondary-click expectation.
  function openActionsMenu(anchor, key) {
    closeMoveMenu();
    var c = STATE.chars.filter(function (x) { return x.key === key; })[0];
    if (!c) return;
    var m = el('div', 'ch-menu ch-actions');
    m.innerHTML =
      '<button class="ch-ma" data-ca="mounted"><b>Mounted sheet</b><span>Open the floating multi-tab sheet</span></button>' +
      '<button class="ch-ma" data-ca="full"><b>Full character page</b><span>Go to the complete site page</span></button>' +
      '<button class="ch-ma compact" data-ca="move">Move to folder…</button>' +
      '<button class="ch-ma compact danger" data-ca="mark">Mark for deletion</button>';
    document.body.appendChild(m);
    var r = anchor.getBoundingClientRect();
    m.style.top = Math.max(8, Math.min(r.bottom + 4, window.innerHeight - 208)) + 'px';
    m.style.left = Math.max(8, Math.min(r.right - 226, window.innerWidth - 234)) + 'px';
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ca]'); if (!b) return;
      var act = b.getAttribute('data-ca');
      if (act === 'mounted') { closeMoveMenu(); openSheet(key, c.name); }
      else if (act === 'full') { window.location.href = sheetPageHref(key); }
      else if (act === 'move') { closeMoveMenu(); openMoveMenu(anchor, key); }
      else if (act === 'mark') { closeMoveMenu(); doMark(key, true); }
    });
    STATE.menu = m;
    setTimeout(function () { document.addEventListener('click', closeMoveOutside, true); }, 0);
  }

  function closeSheetPicker() {
    if (!STATE.picker) return;
    document.removeEventListener('keydown', sheetPickerKey);
    STATE.picker.remove(); STATE.picker = null;
  }
  function sheetPickerKey(e) { if (e.key === 'Escape') closeSheetPicker(); }
  function showSheetPicker() {
    closeSheetPicker(); closeMoveMenu();
    var rows = STATE.chars.filter(function (c) { return !c.deleteMarked; }).map(function (c) {
      return '<div class="ch-pick-row">' +
        '<button class="ch-pick-mounted" type="button" data-pick-mounted="' + esc(c.key) + '">' +
          '<span class="ch-pick-av">' + esc(initialOf(c)) + '</span><span class="ch-pick-who"><b>' + esc(c.name) + '</b><small>' + esc(classLine(c)) + '</small><em>Mounted sheet</em></span><span class="ch-pick-go">→</span>' +
        '</button>' +
        '<a class="ch-pick-full" href="' + sheetPageHref(c.key) + '">Full page ↗</a>' +
      '</div>';
    }).join('');
    var veil = el('div', 'ch-picker-veil');
    veil.innerHTML = '<section class="ch-picker" role="dialog" aria-modal="true" aria-labelledby="ch-picker-title">' +
      '<header><span>Shared character roster</span><h2 id="ch-picker-title">Choose a sheet</h2><p>Open the mounted sheet for play, or go to the character’s full site page.</p></header>' +
      '<div class="ch-picker-list">' + (rows || '<div class="ch-picker-empty">No characters are available yet.</div>') + '</div>' +
      '<footer><button type="button" data-picker-close>Cancel</button><a href="shards.html">Open Shard Reforger</a></footer>' +
      '</section>';
    veil.addEventListener('click', function (e) {
      if (e.target === veil || e.target.closest('[data-picker-close]')) { closeSheetPicker(); return; }
      var b = e.target.closest('[data-pick-mounted]');
      if (!b) return;
      var key = b.getAttribute('data-pick-mounted');
      var c = STATE.chars.filter(function (x) { return x.key === key; })[0];
      closeSheetPicker(); openSheet(key, c && c.name);
    });
    document.body.appendChild(veil); STATE.picker = veil;
    document.addEventListener('keydown', sheetPickerKey);
  }
  function openSheetPicker() {
    ensureCharacterData().then(function () { return CD().loadParty(); }).then(function (chars) {
      STATE.chars = chars || []; showSheetPicker();
    }).catch(function (e) {
      alert('Couldn’t load the sheet list (' + ((e && e.message) || 'error') + ').');
    });
  }

  // ── open a character's sheet in the floating window — the full-size "mounted
  // sheet" combat already uses (CombatSheets), not the narrow rail pane. Loads the
  // float + its CSS + the sheet deps on demand, then CombatSheets.open(key, name).
  function ensureSheetFloat() {
    return ensureSheetDeps().then(function () {
      loadCssOnce('combat-sheet-float.css?v=touch1');
      if (window.CombatSheets && window.CombatSheets.open) return null;
      return loadScript('combat-sheet-float.js').then(function () { return waitFor(function () { return !!(window.CombatSheets && window.CombatSheets.open); }, 5000); });
    });
  }
  function openSheet(key, name) {
    ensureSheetFloat().then(function () {
      if (window.CombatSheets && window.CombatSheets.open) {
        window.CombatSheets.onAdd = openSheetPicker;
        window.CombatSheets.open(key, name || key);
      }
    }).catch(function (e) {
      console.warn('[characters] sheet float failed', e);
      alert('Couldn’t open the sheet (' + ((e && e.message) || 'error') + ').');
    });
  }

  // ── scoped CSS ────────────────────────────────────────────────────────────
  function injectCss() {
    if (document.getElementById('tok-characters-css')) return;
    var s = document.createElement('style'); s.id = 'tok-characters-css';
    s.textContent = [
      '#tok-rail .ch-top{padding:11px 13px 10px;border-bottom:1px solid var(--hair);display:flex;gap:7px}',
      '#tok-rail .ch-open{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:9px 8px;cursor:pointer;background:rgba(231,194,121,.08);border:1px solid var(--frame);color:var(--gold-br);font-family:"Oswald",sans-serif;letter-spacing:.12em;text-transform:uppercase;font-size:10px}',
      '#tok-rail .ch-open:hover{background:rgba(231,194,121,.16);color:var(--cream-hi)}',
      '#tok-rail .ch-open svg{width:13px;height:13px}',
      '#tok-rail .ch-reforge,#tok-rail .ch-newfolder{flex:none;display:flex;align-items:center;justify-content:center;padding:9px 10px;cursor:pointer;background:transparent;border:1px solid var(--hair);color:var(--cream-fnt);font-family:"Oswald",sans-serif;letter-spacing:.09em;text-transform:uppercase;font-size:9px}',
      '#tok-rail .ch-reforge:hover,#tok-rail .ch-newfolder:hover{color:var(--cream);border-color:var(--frame)}',
      '#tok-rail .ch-newfolder{width:35px;padding:9px}',
      '#tok-rail .ch-newfolder svg{width:13px;height:13px}',
      '#tok-rail .ch-list{flex:1 1 auto;min-height:0;overflow-y:auto;padding:5px 9px 16px;scrollbar-width:thin;scrollbar-color:rgba(199,154,74,.25) transparent;-webkit-overflow-scrolling:touch;touch-action:pan-y}',
      '#tok-rail .ch-list::-webkit-scrollbar{width:4px}',
      '#tok-rail .ch-list::-webkit-scrollbar-thumb{background:rgba(199,154,74,.25)}',
      '#tok-rail .ch-empty,#tok-rail .fold-empty{font-family:"EB Garamond",serif;font-style:italic;color:var(--cream-fnt);font-size:13px;padding:10px 8px}',
      '#tok-rail .fold-empty{padding:5px 8px 5px 6px;font-size:12px}',
      '#tok-rail .fold{margin-top:7px}',
      '#tok-rail .fold-h{display:flex;align-items:center;gap:7px;padding:6px 6px 5px;cursor:pointer;position:relative;border-bottom:1px solid var(--hair)}',
      '#tok-rail .fold-h:hover{background:rgba(236,226,205,.03)}',
      '#tok-rail .fold-chev{flex:none;width:11px;height:11px;color:var(--gold);transition:transform .15s}',
      '#tok-rail .fold.collapsed .fold-chev{transform:rotate(-90deg)}',
      '#tok-rail .fold-name{flex:1;font-family:"Oswald",sans-serif;letter-spacing:.13em;text-transform:uppercase;font-size:10.5px;color:var(--gold-br);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#tok-rail .fold.unfiled .fold-name{color:var(--cream-fnt)}',
      '#tok-rail .fold-ct{font-family:"Oswald",sans-serif;font-size:9px;color:var(--cream-fnt)}',
      '#tok-rail .fold-tools{display:none;margin-left:4px}',
      '#tok-rail .fold-h:hover .fold-tools{display:flex}',
      '#tok-rail .fold-tool{background:transparent;border:none;color:var(--cream-fnt);cursor:pointer;padding:1px}',
      '#tok-rail .fold-tool:hover{color:var(--cream)}',
      '#tok-rail .fold-tool svg{width:12px;height:12px;display:block}',
      '#tok-rail .fold.collapsed .fold-body{display:none}',
      '#tok-rail .fold-body{padding:3px 0 2px 4px}',
      '#tok-rail .ch-row{display:flex;gap:8px;align-items:center;position:relative;padding:7px 8px;cursor:pointer;border:1px solid transparent;transition:background .12s,border-color .12s}',
      '#tok-rail .ch-row[data-act="open"]:hover{background:rgba(236,226,205,.04);border-color:var(--hair)}',
      '#tok-rail .ch-av{flex:none;width:29px;height:29px;border-radius:50%;border:1.5px solid var(--gold);overflow:hidden;display:flex;align-items:center;justify-content:center;background:rgba(7,12,11,.5)}',
      '#tok-rail .ch-av-i{font-family:"Playfair Display",serif;font-size:13px;color:var(--cream-dim)}',
      '#tok-rail .ch-body2{min-width:0;flex:1}',
      '#tok-rail .ch-name{font-family:"Playfair Display",serif;font-weight:700;font-size:15px;color:var(--cream-hi);line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#tok-rail .ch-cls{font-family:"EB Garamond",serif;font-size:13px;color:var(--cream-dim);line-height:1.25}',
      '#tok-rail .ch-more{flex:none;width:34px;height:34px;display:grid;place-items:center;background:rgba(7,12,11,.5);border:1px solid var(--frame);color:var(--gold-br);cursor:pointer;padding:0}',
      '#tok-rail .ch-more:hover{background:rgba(231,194,121,.1);border-color:var(--gold)}',
      '#tok-rail .ch-more svg{width:14px;height:14px;display:block}',
      '#tok-rail .ch-row.marked{opacity:.55;border-color:rgba(207,59,44,.3);background:rgba(207,59,44,.05);cursor:default}',
      '#tok-rail .ch-row.marked .ch-name{text-decoration:line-through;text-decoration-color:rgba(224,88,74,.7);color:var(--cream-dim)}',
      '#tok-rail .ch-trash{display:flex;gap:6px;margin-top:5px}',
      '#tok-rail .ch-tb{font-family:"Oswald",sans-serif;letter-spacing:.08em;text-transform:uppercase;font-size:9px;padding:3px 8px;cursor:pointer;background:transparent;border:1px solid var(--hair);color:var(--cream-fnt)}',
      '#tok-rail .ch-tb.restore:hover{color:var(--teal);border-color:var(--teal)}',
      '#tok-rail .ch-tb.del{color:var(--red-br);border-color:rgba(207,59,44,.45)}',
      '#tok-rail .ch-tb.del:hover{background:rgba(207,59,44,.16)}',
      '#tok-rail .ch-staffnote{font-family:"Oswald",sans-serif;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--cream-fnt);align-self:center}',
      // move popover (body-level)
      '.ch-menu{position:fixed;z-index:1200;min-width:160px;max-width:180px;background:linear-gradient(180deg,#1b2c2a,#13201e);border:1px solid rgba(199,154,74,.4);box-shadow:0 8px 28px rgba(0,0,0,.5);padding:4px;display:flex;flex-direction:column}',
      '.ch-menu.ch-actions{width:226px;max-width:226px}',
      '.ch-mi{text-align:left;background:transparent;border:none;color:#ece2cd;font-family:"EB Garamond",serif;font-size:14px;padding:7px 9px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ch-mi:hover{background:rgba(231,194,121,.12);color:#f9f3e6}',
      '.ch-mi-new{border-top:1px solid rgba(236,226,205,.1);color:#e7c279;font-family:"Oswald",sans-serif;text-transform:uppercase;letter-spacing:.1em;font-size:10px}',
      '.ch-ma{width:100%;min-height:47px;padding:8px 10px;text-align:left;background:transparent;border:0;border-bottom:1px solid rgba(236,226,205,.1);color:#ece2cd;cursor:pointer;font-family:"EB Garamond",serif}',
      '.ch-ma:hover{background:rgba(231,194,121,.1)}',
      '.ch-ma b{display:block;color:#e7c279;font:600 9px "Oswald",sans-serif;letter-spacing:.1em;text-transform:uppercase}',
      '.ch-ma span{display:block;margin-top:3px;color:#8d8675;font-size:11px}',
      '.ch-ma.compact{min-height:38px;font-size:13px}',
      '.ch-ma.danger{color:#e0584a;border-bottom:0}',
      '.ch-picker-veil{position:fixed;inset:0;z-index:1300;display:grid;place-items:center;padding:18px;background:rgba(2,5,4,.72);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}',
      '.ch-picker{width:min(500px,100%);max-height:min(680px,90vh);display:flex;flex-direction:column;overflow:hidden;background:#13211f;border:1px solid rgba(199,154,74,.4);box-shadow:0 24px 60px #000;color:#ece2cd}',
      '.ch-picker header{padding:18px;border-bottom:1px solid rgba(236,226,205,.12)}',
      '.ch-picker header>span{color:#c79a4a;font:700 8px "Oswald",sans-serif;letter-spacing:.22em;text-transform:uppercase}',
      '.ch-picker h2{margin:6px 0 4px;color:#f9f3e6;font:400 25px "Playfair Display",serif}',
      '.ch-picker p{margin:0;color:#8d8675;font:13px "EB Garamond",serif}',
      '.ch-picker-list{overflow-y:auto;padding:8px;-webkit-overflow-scrolling:touch;touch-action:pan-y}',
      '.ch-pick-row{display:flex;align-items:stretch;border:1px solid transparent}',
      '.ch-pick-row:focus-within{border-color:rgba(199,154,74,.34);background:rgba(231,194,121,.05)}',
      '.ch-pick-mounted{flex:1;min-width:0;min-height:62px;display:flex;align-items:center;gap:10px;padding:8px;border:0;background:transparent;color:#ece2cd;text-align:left;cursor:pointer}',
      '.ch-pick-av{flex:none;width:36px;height:36px;border:1.5px solid #c79a4a;border-radius:50%;display:grid;place-items:center;font-family:"Playfair Display",serif}',
      '.ch-pick-who{flex:1;min-width:0}',
      '.ch-pick-who b,.ch-pick-who small,.ch-pick-who em{display:block}',
      '.ch-pick-who b{color:#f9f3e6;font:700 15px "Playfair Display",serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ch-pick-who small{margin-top:2px;color:#b9b09a;font:12px "EB Garamond",serif}',
      '.ch-pick-who em{margin-top:3px;color:#55c4c0;font:600 8px "Oswald",sans-serif;letter-spacing:.1em;text-transform:uppercase;font-style:normal}',
      '.ch-pick-go{color:#e7c279;font-size:18px}',
      '.ch-pick-full{flex:none;width:92px;margin:7px 7px 7px 0;display:grid;place-items:center;border:1px solid rgba(199,154,74,.34);color:#e7c279;text-decoration:none;font:600 8px "Oswald",sans-serif;letter-spacing:.09em;text-transform:uppercase}',
      '.ch-picker-empty{padding:18px;color:#8d8675;font:italic 14px "EB Garamond",serif}',
      '.ch-picker footer{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(236,226,205,.12)}',
      '.ch-picker footer button,.ch-picker footer a{min-height:38px;display:grid;place-items:center;padding:0 13px;border:1px solid rgba(199,154,74,.34);background:transparent;color:#b9b09a;text-decoration:none;font:600 9px "Oswald",sans-serif;letter-spacing:.11em;text-transform:uppercase;cursor:pointer}',
      '.ch-picker footer a{flex:1;color:#e7c279}',
      '@media (hover:none),(pointer:coarse){#tok-rail .fold-tools{display:flex}.ch-ma,.ch-pick-mounted,.ch-pick-full{min-height:44px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── icon for the tab button ────────────────────────────────────────────────
  var TAB_ICON = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="6.5" cy="6" r="2.4"/><path d="M2.5 14c0-2.3 1.8-3.7 4-3.7s4 1.4 4 3.7"/><circle cx="13" cy="7" r="1.7"/><path d="M11.4 13.2c.2-1.6 1.1-2.5 2.6-2.5 1 0 1.7.4 2.1 1.1"/></svg>';

  // ── register against the rail seam ─────────────────────────────────────────
  function register() {
    if (!window.TokRail || !window.TokRail.registerTab) return;
    injectCss();
    window.__tok.ready.then(function (me) { STATE.staff = !!(me && (me.role === 'overseer' || me.role === 'dm')); }).catch(function () {});
    window.TokRail.registerTab({
      id: 'characters', label: 'Characters', icon: TAB_ICON, order: 15,
      onMount: function (pane) { render(pane); },
      onShow: function () { refresh(); }   // re-pull on each visit (reflects new forges / changes)
    });
  }

  if (window.TokRail && window.TokRail.ready) register();
  else document.addEventListener('tok-rail:ready', register, { once: true });
  document.addEventListener('combatsheets:add', openSheetPicker);

  // expose pure bits for tests
  window.CharactersTab = { groupRoster: groupRoster, normLayout: normLayout, classLine: classLine, sheetPageHref: sheetPageHref };
})();
