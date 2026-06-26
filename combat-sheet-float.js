// combat-sheet-float.js
// ---------------------------------------------------------------------------
// CombatSheets — a floating, draggable + resizable, multi-TAB window that hosts
// LIVE v11 character sheets over the combat board. Each tab mounts the real
// sheet via window.mountSheet(container, key), which reads the character's
// Supabase row through CharacterData and wires its own write-affordances
// (inspiration / rests / hit dice). Because the sheet writes back to the SAME
// `characters` row the orbs read, the two surfaces share one source of truth.
//
// Public API (combat.html calls these):
//   CombatSheets.open(key, name)   open/focus a sheet tab + reveal the window
//   CombatSheets.close()           hide the window (a reopen tab stays on the edge)
//   CombatSheets.closeTab(key)     drop one tab
//   CombatSheets.onAdd = fn        optional: what the ribbon "+" does (a picker)
//
// Drives the chrome defined in combat-sheet-float.css: .sheet-float / .sf-ribbon
// (.sf-grip-l drag · .sf-tabs/.sf-tab · .sf-add · .sf-winbtn/.sf-close) /
// .sf-stack/.sf-page (one per tab) / .sf-grip resize / .sf-reopen edge tab.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  var LS = 'tok.sheetFloat.v2';   // v2: reset saved geometry so the wider two-column default lands
  var win = null, reopenEl = null, tabsEl = null, stackEl = null;
  var tabs = Object.create(null);   // key -> { tab, page, name }
  var activeKey = null;
  var geom = loadGeom();

  function loadGeom() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function saveGeom() {
    if (!win) return;
    try {
      localStorage.setItem(LS, JSON.stringify({
        left: win.style.left || null, top: win.style.top || null,
        width: win.style.width || null, height: win.style.height || null,
        min: win.classList.contains('minimized')
      }));
    } catch (e) {}
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ── build the window once ──
  function ensureWindow() {
    if (win) return;
    win = document.createElement('div');
    win.className = 'sheet-float';
    win.setAttribute('hidden', '');
    win.innerHTML =
      '<div class="sf-ribbon">' +
        '<div class="sf-grip-l" title="Drag">\u28FF</div>' +
        '<div class="sf-tabs"></div>' +
        '<button class="sf-add" type="button" title="Open another sheet">+</button>' +
        '<button class="sf-winbtn sf-min" type="button" title="Minimize">\u2013</button>' +
        '<button class="sf-winbtn sf-close" type="button" title="Close">\u2715</button>' +
      '</div>' +
      '<div class="sf-stack"></div>' +
      '<div class="sf-grip" title="Resize"></div>';
    document.body.appendChild(win);
    tabsEl = win.querySelector('.sf-tabs');
    stackEl = win.querySelector('.sf-stack');

    reopenEl = document.createElement('div');
    reopenEl.className = 'sf-reopen';
    reopenEl.textContent = 'Sheets';
    reopenEl.addEventListener('click', showWindow);
    document.body.appendChild(reopenEl);

    // restore saved geometry (positioned by left/top → drop the CSS `right`)
    if (geom.left) { win.style.left = geom.left; win.style.right = 'auto'; }
    if (geom.top) win.style.top = geom.top;
    if (geom.width) win.style.width = geom.width;
    if (geom.height) win.style.height = geom.height;
    if (geom.min) win.classList.add('minimized');

    win.querySelector('.sf-min').addEventListener('click', function () { win.classList.toggle('minimized'); saveGeom(); });
    win.querySelector('.sf-close').addEventListener('click', hideWindow);
    win.querySelector('.sf-add').addEventListener('click', function () {
      if (typeof API.onAdd === 'function') API.onAdd();
      else window.dispatchEvent(new CustomEvent('combatsheets:add'));   // host can listen + show a picker
    });
    // a wheel anywhere in the window scrolls the window — never bubbles out to zoom the board
    win.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });

    wireDrag(win.querySelector('.sf-grip-l'));
    wireResize(win.querySelector('.sf-grip'));
  }

  function showWindow() { ensureWindow(); win.removeAttribute('hidden'); if (reopenEl) reopenEl.classList.remove('show'); }
  function hideWindow() { if (win) win.setAttribute('hidden', ''); if (reopenEl && Object.keys(tabs).length) reopenEl.classList.add('show'); }

  function activate(key) {
    if (!tabs[key]) return;
    activeKey = key;
    Object.keys(tabs).forEach(function (k) {
      var on = (k === key);
      tabs[k].tab.classList.toggle('active', on);
      tabs[k].page.classList.toggle('active', on);
    });
  }

  function closeTab(key) {
    var t = tabs[key]; if (!t) return;
    t.tab.remove(); t.page.remove();
    delete tabs[key];
    var rest = Object.keys(tabs);
    if (!rest.length) { activeKey = null; hideWindow(); if (reopenEl) reopenEl.classList.remove('show'); return; }
    if (activeKey === key) activate(rest[rest.length - 1]);
  }

  function open(key, name) {
    if (!key) return;
    ensureWindow();
    win.classList.remove('minimized');
    showWindow();
    if (tabs[key]) { activate(key); return; }

    var tab = document.createElement('div');
    tab.className = 'sf-tab';
    tab.innerHTML = '<span class="chip"></span><span class="tname">' + esc(name || key) + '</span>' +
      '<span class="tx" role="button" title="Close sheet">\u2715</span>';
    tab.addEventListener('click', function (e) {
      if (e.target.closest('.tx')) { e.stopPropagation(); closeTab(key); return; }
      activate(key);
    });
    tabsEl.appendChild(tab);

    var page = document.createElement('div');
    page.className = 'sf-page';
    var bg = document.createElement('div');        // non-scrolling appearance layer (per-tab)
    bg.className = 'sf-bg';
    var scroll = document.createElement('div');     // the sheet scrolls in here, over the bg
    scroll.className = 'sf-scroll';
    page.appendChild(bg);
    page.appendChild(scroll);
    stackEl.appendChild(page);

    tabs[key] = { tab: tab, page: page, scroll: scroll, bg: bg, name: name || key };
    activate(key);

    if (window.mountSheet) {
      try { window.mountSheet(scroll, key); }
      catch (e) { scroll.innerHTML = errHTML('Could not load this sheet.'); console.error('[sheetfloat] mount failed:', e); }
    } else {
      scroll.innerHTML = errHTML('Sheet engine not loaded.');
    }
    // paint this character's saved look into the tab background — per-character,
    // read-only (writes stay owner-only via the cog on the standalone sheet).
    // Lazy-loaded; cosmetic, so any failure is swallowed and never blocks the sheet.
    import('./appearance-float.js')
      .then(function (m) { m.loadFloatAppearance(window.__tok && window.__tok.sb, key, page); })
      .catch(function () {});
    tab.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }
  function errHTML(msg) { return '<div style="padding:18px;color:#e0584a;font-family:\'EB Garamond\',serif">' + esc(msg) + '</div>'; }

  // ── drag the window (pointer move/up on document so tracking never drops) ──
  function wireDrag(grip) {
    if (!grip) return;
    grip.style.touchAction = 'none';
    grip.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button > 0) return;
      e.preventDefault();
      var r = win.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
      win.style.right = 'auto'; win.style.left = r.left + 'px'; win.style.top = r.top + 'px';
      function mv(ev) {
        var nx = r.left + (ev.clientX - sx), ny = r.top + (ev.clientY - sy);
        nx = Math.max(4, Math.min(window.innerWidth - 90, nx));
        ny = Math.max(4, Math.min(window.innerHeight - 44, ny));
        win.style.left = nx + 'px'; win.style.top = ny + 'px';
      }
      function up() { document.removeEventListener('pointermove', mv, true); document.removeEventListener('pointerup', up, true); document.removeEventListener('pointercancel', up, true); saveGeom(); }
      document.addEventListener('pointermove', mv, true);
      document.addEventListener('pointerup', up, true);
      document.addEventListener('pointercancel', up, true);
    });
  }

  // ── resize from the bottom-right grip ──
  function wireResize(grip) {
    if (!grip) return;
    grip.style.touchAction = 'none';
    grip.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button > 0) return;
      e.preventDefault(); e.stopPropagation();
      var r = win.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
      function mv(ev) {
        var w = Math.max(320, Math.min(window.innerWidth - r.left - 8, r.width + (ev.clientX - sx)));
        var h = Math.max(240, Math.min(window.innerHeight - r.top - 8, r.height + (ev.clientY - sy)));
        win.style.width = w + 'px'; win.style.height = h + 'px';
      }
      function up() { document.removeEventListener('pointermove', mv, true); document.removeEventListener('pointerup', up, true); document.removeEventListener('pointercancel', up, true); saveGeom(); }
      document.addEventListener('pointermove', mv, true);
      document.addEventListener('pointerup', up, true);
      document.addEventListener('pointercancel', up, true);
    });
  }

  var API = {
    open: open,
    close: hideWindow,
    closeTab: closeTab,
    isOpen: function () { return !!(win && !win.hasAttribute('hidden')); },
    // Re-render an open tab in place from fresh data (called by combat.html's
    // characters-realtime sub). renderSheet only repaints [data-f] values + the
    // display lists, and the wired affordances (inspiration / rests / hit dice) sit
    // on stable nodes it never replaces — so this is flicker-free, keeps scroll, and
    // doesn't duplicate handlers. A self-echo repaints identical values = invisible.
    refresh: function (key) {
      var t = tabs[key];
      if (!t || !t.scroll || !window.__sheet || !window.__sheet.renderSheet || !window.CharacterData) return;
      window.CharacterData.loadCharacter(key).then(function (cd) {
        if (!cd || !tabs[key]) return;                       // tab closed while we loaded
        var shape = window.__sheet.toRenderShape ? window.__sheet.toRenderShape(cd) : cd;
        try { window.__sheet.renderSheet(t.scroll, shape); }
        catch (e) { console.warn('[sheetfloat] refresh failed:', e && e.message); }
      }).catch(function () {});
    },
    onAdd: null
  };
  window.CombatSheets = API;
})();
