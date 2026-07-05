/* bardic-tab.js — the rail's Bardic tab + corner chip (BARDIC-TAB-V1)
 *
 * The REMOTE side of the Bardic bus (wave A, July 5; approved via
 * mock-rail-bardic). Registers a site-wide "Bardic" tab via
 * TokRail.registerTab — the proven seam; rail.js's registerTab stays
 * untouched. Talks to the engine (bardic-console.html) over
 * window.BardicBus; NEVER touches audio itself. Renders snapshots,
 * sends verbs. Protocol: bardic-bus.js's header is the contract.
 *
 * Surfaces:
 *   PANE  — engine status ("Light the engine" when offline), one row
 *           per channel: mood DROPDOWN (July 5 call: dropdowns in the
 *           rail, pads stay the console's), now-playing, pause/next,
 *           volume. Chip visibility toggle. Broadcast section lands in
 *           wave B.
 *   CHIP  — #tok-bardic-chip, bottom-right, offset past the rail like
 *           the combat roll ticker (396px open / 36px collapsed).
 *           Click → TokRail.show('bardic'). Hidden via the pane toggle
 *           (localStorage 'tok-bardic-chip' — bardic-scoped;
 *           profiles.appearance stays the flyout's alone).
 *   DOTS  — live-dot on the tab while playing; ember on the rail
 *           handle when playing + chip hidden + rail collapsed, so
 *           state never goes fully invisible.
 *
 * Engine liveness: snapshots mark it live; 'engine-bye' marks it gone;
 * a hello ping (on load / focus / pane show) with a 1500ms reply window
 * catches crashed tabs. Suppressed chip on bardic-console.html itself.
 *
 * Injected by rail.js alongside characters-tab.js. Self-contained:
 * ensures bardic-bus.js, injects its own ID-prefixed CSS (JS-mixed
 * rgba literals only), registers on tok-rail:ready.
 */
(function () {
  'use strict';
  if (window.__tokBardicTab) return;
  window.__tokBardicTab = true;

  var ON_CONSOLE = /bardic-console\.html/.test(location.pathname);
  var CHIP_KEY = 'tok-bardic-chip';
  var PING_MS = 1500;

  var S = {
    bus: null,
    snap: null,            // latest engine snapshot (the truth)
    engineLive: false,
    pane: null,
    tabBtn: null,
    chip: null,
    chipPref: (function () { try { return localStorage.getItem(CHIP_KEY) || 'shown'; } catch (e) { return 'shown'; } })(),
    pingTimer: null,
    rows: {},              // chId → row element refs
  };

  // ── tiny helpers ──────────────────────────────────────────────────
  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function existsScript(file) { return !!document.querySelector('script[src*="' + file + '"]'); }
  function loadScript(file) {
    return new Promise(function (res, rej) {
      if (existsScript(file)) { res(); return; }
      var s = document.createElement('script');
      s.src = file;
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error('load failed: ' + file)); };
      document.head.appendChild(s);
    });
  }
  function ensureBus() {
    if (window.BardicBus) return Promise.resolve();
    return loadScript('bardic-bus.js');
  }
  function playingChannels() {
    if (!S.snap || !S.engineLive) return [];
    var out = [];
    for (var id in S.snap.channels) {
      var c = S.snap.channels[id];
      if (c.trackTitle && !c.paused) out.push({ id: id, label: c.label, accent: c.accent, title: c.trackTitle });
    }
    return out;
  }

  // ── scoped CSS (ID-prefixed; rgba literals mixed here in JS-land) ──
  function injectCss() {
    if (document.getElementById('tok-bardic-tab-css')) return;
    var css = ''
      + '#tok-rail .tok-bd-pane{padding:12px 12px 18px;display:flex;flex-direction:column;gap:12px;overflow-y:auto}'
      + '#tok-rail .tok-bd-sec{border:1px solid rgba(236,226,205,0.12);background:rgba(12,22,20,0.62);padding:10px 12px}'
      + '#tok-rail .tok-bd-head{display:flex;align-items:center;gap:8px;font-family:Oswald,sans-serif;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(139,132,115,1);margin-bottom:9px}'
      + '#tok-rail .tok-bd-head .d{width:7px;height:7px;border-radius:50%;background:rgba(107,93,74,1)}'
      + '#tok-rail .tok-bd-head.live .d{background:rgba(85,196,192,1);box-shadow:0 0 7px rgba(85,196,192,0.9)}'
      + '#tok-rail .tok-bd-head .r{margin-left:auto;letter-spacing:0.1em;color:rgba(185,176,154,1);text-transform:none}'
      + '#tok-rail .tok-bd-eng{font-size:13.5px;color:rgba(185,176,154,1);font-family:"EB Garamond",serif}'
      + '#tok-rail .tok-bd-eng b{color:rgba(236,226,205,1);font-weight:600}'
      + '#tok-rail .tok-bd-light{display:block;width:100%;margin-top:2px;padding:9px 0;background:transparent;border:1px solid rgba(199,154,74,0.6);color:rgba(231,194,121,1);font-family:Oswald,sans-serif;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;cursor:pointer}'
      + '#tok-rail .tok-bd-light:hover{background:rgba(199,154,74,0.12)}'
      + '#tok-rail .tok-bd-row{display:flex;align-items:center;gap:8px;padding:9px 0;border-top:1px solid rgba(236,226,205,0.12)}'
      + '#tok-rail .tok-bd-row:first-of-type{border-top:none}'
      + '#tok-rail .tok-bd-bar{width:3px;align-self:stretch;flex:none}'
      + '#tok-rail .tok-bd-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}'
      + '#tok-rail .tok-bd-lab{font-family:Oswald,sans-serif;font-size:8px;letter-spacing:0.2em;text-transform:uppercase}'
      + '#tok-rail .tok-bd-sel{width:100%;background:rgba(10,18,16,0.85);border:1px solid rgba(236,226,205,0.16);color:rgba(236,226,205,1);font-family:"EB Garamond",serif;font-size:13px;padding:4px 6px}'
      + '#tok-rail .tok-bd-sel option{background:rgb(10,18,16);color:rgb(236,226,205)}'
      + '#tok-rail .tok-bd-now{font-size:12px;color:rgba(185,176,154,1);font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '#tok-rail .tok-bd-now.idle{color:rgba(139,132,115,1);font-style:normal}'
      + '#tok-rail .tok-bd-ctl{display:flex;flex-direction:column;gap:4px;align-items:center}'
      + '#tok-rail .tok-bd-ctl .btns{display:flex;gap:4px}'
      + '#tok-rail .tok-bd-ctl button{width:24px;height:24px;background:transparent;border:1px solid rgba(236,226,205,0.14);color:rgba(185,176,154,1);cursor:pointer;font-size:10px;line-height:1}'
      + '#tok-rail .tok-bd-ctl button:hover{border-color:rgba(199,154,74,0.6);color:rgba(236,226,205,1)}'
      + '#tok-rail .tok-bd-ctl input[type=range]{width:56px}'
      + '#tok-rail .tok-bd-chiprow{display:flex;align-items:center;gap:8px;min-height:26px}'
      + '#tok-rail .tok-bd-minichip{display:none;align-items:center;gap:7px;min-width:0;flex:1}'
      + '#tok-rail .tok-bd-minichip.on{display:flex}'
      + '#tok-rail .tok-bd-minichip .eq{display:flex;align-items:flex-end;gap:2px;height:12px;flex:none}'
      + '#tok-rail .tok-bd-minichip .eq i{width:3px;background:rgba(201,168,76,1);animation:tokBdEq 0.9s infinite ease-in-out}'
      + '#tok-rail .tok-bd-minichip .eq i:nth-child(2){animation-delay:0.2s}'
      + '#tok-rail .tok-bd-minichip .eq i:nth-child(3){animation-delay:0.45s}'
      + '#tok-rail .tok-bd-minichip .mt{font-size:12px;color:rgba(236,226,205,1);font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '#tok-rail .tok-bd-chiprow .l.off{display:none}'
      + '#tok-rail .tok-bd-chiprow .l{font-family:Oswald,sans-serif;font-size:8.5px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(139,132,115,1)}'
      + '#tok-rail .tok-bd-chiptog{margin-left:auto;padding:4px 10px;background:transparent;border:1px solid rgba(199,154,74,0.34);color:rgba(185,176,154,1);font-family:Oswald,sans-serif;font-size:8.5px;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer}'
      + '#tok-rail .tok-bd-chiptog.on{border-color:rgba(199,154,74,0.6);color:rgba(231,194,121,1)}'
      /* tab live-dot */
      + '#tok-rail .tr-tab[data-rail-tab="bardic"]{position:relative}'
      + '#tok-rail .tr-tab[data-rail-tab="bardic"] .tok-bd-dot{position:absolute;top:6px;right:calc(50% - 16px);width:6px;height:6px;border-radius:50%;background:rgba(231,194,121,1);box-shadow:0 0 6px rgba(231,194,121,0.9);opacity:0;transition:opacity 0.2s}'
      + '#tok-rail .tr-tab[data-rail-tab="bardic"] .tok-bd-dot.on{opacity:1}'
      /* the chip */
      + '#tok-bardic-chip{position:fixed;bottom:16px;right:396px;z-index:89;display:flex;align-items:center;gap:9px;padding:8px 14px 8px 10px;background:linear-gradient(180deg,rgba(22,38,36,1),rgba(16,28,26,1));border:1px solid rgba(199,154,74,0.34);cursor:pointer;max-width:300px;transition:right 0.22s ease,opacity 0.2s;font-family:"EB Garamond",serif}'
      + '#tok-bardic-chip.tok-bd-railshut{right:36px}'
      + '#tok-bardic-chip.tok-bd-off{display:none}'
      + '#tok-bardic-chip .eq{display:flex;align-items:flex-end;gap:2px;height:14px;flex:none}'
      + '#tok-bardic-chip .eq i{width:3px;background:rgba(201,168,76,1);animation:tokBdEq 0.9s infinite ease-in-out}'
      + '#tok-bardic-chip .eq i:nth-child(2){animation-delay:0.2s}'
      + '#tok-bardic-chip .eq i:nth-child(3){animation-delay:0.45s}'
      + '@keyframes tokBdEq{0%,100%{height:5px}50%{height:14px}}'
      + '#tok-bardic-chip .w{min-width:0}'
      + '#tok-bardic-chip .s{font-family:Oswald,sans-serif;font-size:8px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(139,132,115,1)}'
      + '#tok-bardic-chip .t{font-size:12.5px;color:rgba(236,226,205,1);font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      /* handle ember */
      + '.tr-handle .tok-bd-ember{position:absolute;top:8px;left:50%;transform:translateX(-50%);width:5px;height:5px;border-radius:50%;background:rgba(231,194,121,1);box-shadow:0 0 5px rgba(231,194,121,0.9);opacity:0;transition:opacity 0.2s;pointer-events:none}'
      + '.tr-handle .tok-bd-ember.on{opacity:1}';
    var st = document.createElement('style');
    st.id = 'tok-bardic-tab-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ── engine liveness ───────────────────────────────────────────────
  var pingPending = null;
  function pingEngine() {
    if (!S.bus) return;
    S.bus.send({ t: 'hello' });
    clearTimeout(pingPending);
    pingPending = setTimeout(function () {
      // no state reply — engine gone (crashed tab / never opened)
      setEngineLive(false);
    }, PING_MS);
  }
  function setEngineLive(live) {
    if (S.engineLive === live) { paintAll(); return; }
    S.engineLive = live;
    paintAll();
  }

  // ── pane: static skeleton once, update-in-place per snapshot ──────
  function buildPane(pane) {
    pane.innerHTML = '';
    var wrap = el('div', 'tok-bd-pane');

    // ENGINE section
    var eng = el('div', 'tok-bd-sec');
    var ehead = el('div', 'tok-bd-head');
    ehead.innerHTML = '<span class="d"></span>ENGINE<span class="r"></span>';
    var etext = el('div', 'tok-bd-eng');
    var light = el('button', 'tok-bd-light');
    light.textContent = '\u27E1  Light the engine';
    light.addEventListener('click', function () {
      window.open('bardic-console.html', 'tok-bardic-engine');
      setTimeout(pingEngine, 2500);   // give it a breath, then ask
    });
    var chiprow = el('div', 'tok-bd-chiprow');
    chiprow.innerHTML = '<span class="l">Corner chip</span>'
      + '<div class="tok-bd-minichip"><div class="eq"><i></i><i></i><i></i></div><div class="mt"></div></div>';
    var chiptog = el('button', 'tok-bd-chiptog');
    chiptog.addEventListener('click', function () {
      S.chipPref = S.chipPref === 'shown' ? 'hidden' : 'shown';
      try { localStorage.setItem(CHIP_KEY, S.chipPref); } catch (e) {}
      paintAll();
    });
    chiprow.appendChild(chiptog);
    eng.appendChild(ehead); eng.appendChild(etext); eng.appendChild(light); eng.appendChild(chiprow);

    // CHANNELS section
    var chs = el('div', 'tok-bd-sec');
    var chead = el('div', 'tok-bd-head');
    chead.textContent = 'CHANNELS';
    chs.appendChild(chead);
    var rowsHost = el('div');
    chs.appendChild(rowsHost);

    wrap.appendChild(eng); wrap.appendChild(chs);
    pane.appendChild(wrap);

    S.paneRefs = { ehead: ehead, etext: etext, light: light, chiptog: chiptog, rowsHost: rowsHost, chs: chs };
  }

  function buildRow(chId, ch) {
    var row = el('div', 'tok-bd-row');
    var bar = el('div', 'tok-bd-bar');
    var main = el('div', 'tok-bd-main');
    var lab = el('div', 'tok-bd-lab');
    var sel = document.createElement('select');
    sel.className = 'tok-bd-sel';
    var now = el('div', 'tok-bd-now');
    main.appendChild(lab); main.appendChild(sel); main.appendChild(now);
    var ctl = el('div', 'tok-bd-ctl');
    var btns = el('div', 'btns');
    var pauseB = document.createElement('button'); pauseB.title = 'Pause / resume';
    var nextB = document.createElement('button'); nextB.textContent = '\u23ED'; nextB.title = 'Next track';
    btns.appendChild(pauseB); btns.appendChild(nextB);
    var vol = document.createElement('input');
    vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.01';
    ctl.appendChild(btns); ctl.appendChild(vol);
    row.appendChild(bar); row.appendChild(main); row.appendChild(ctl);

    sel.addEventListener('change', function () {
      var v = sel.value;
      if (v === '') S.bus.send({ t: 'stop', chId: chId });
      else S.bus.send({ t: 'cast', moodId: v, chId: chId });
    });
    pauseB.addEventListener('click', function () {
      // 'pause' is a true per-channel pause/resume (engine adapter, July 5);
      // 'toggle' on an active mood is the console's double-press-to-skip.
      S.bus.send({ t: 'pause', chId: chId });
    });
    nextB.addEventListener('click', function () { S.bus.send({ t: 'next', chId: chId }); });
    var volT = null;
    vol.addEventListener('input', function () {
      clearTimeout(volT);
      var v = parseFloat(vol.value);
      volT = setTimeout(function () { S.bus.send({ t: 'vol', chId: chId, val: v }); }, 90);
    });

    return { row: row, bar: bar, lab: lab, sel: sel, now: now, pauseB: pauseB, vol: vol };
  }

  function paintPane() {
    if (!S.paneRefs) return;
    var R = S.paneRefs;
    R.ehead.classList.toggle('live', S.engineLive);
    R.ehead.querySelector('.r').textContent = S.engineLive ? 'bardic-console \u00b7 background tab' : 'not running';
    R.etext.innerHTML = S.engineLive
      ? 'Playing from <b>your console tab</b> \u2014 audio never touches this page, so navigation can\u2019t interrupt it.'
      : 'The engine isn\u2019t running. Light it and this pane becomes the remote.';
    R.light.style.display = S.engineLive ? 'none' : 'block';
    R.chiptog.classList.toggle('on', S.chipPref === 'shown');
    R.chiptog.textContent = S.chipPref === 'shown' ? 'Shown \u00b7 click to hide' : 'Hidden \u00b7 click to show';
    // tucked chip lives HERE: the mini now-playing takes the label's space
    var live = playingChannels();
    var mini = R.chiptog.parentNode.querySelector('.tok-bd-minichip');
    var lab2 = R.chiptog.parentNode.querySelector('.l');
    var tucked = S.chipPref === 'hidden' && live.length > 0;
    mini.classList.toggle('on', tucked);
    lab2.classList.toggle('off', tucked);
    if (tucked) {
      mini.querySelector('.mt').textContent = live.map(function (c) { return c.title; }).join(' \u00b7 ');
      var eqs = mini.querySelectorAll('.eq i');
      for (var ei = 0; ei < eqs.length; ei++) eqs[ei].style.background = (live[ei % live.length] || live[0]).accent;
    }
    R.chs.style.display = S.engineLive ? '' : 'none';
    if (!S.snap || !S.engineLive) return;

    var moods = (S.snap.moods || []).slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    for (var chId in S.snap.channels) {
      var ch = S.snap.channels[chId];
      var refs = S.rows[chId];
      if (!refs) { refs = S.rows[chId] = buildRow(chId, ch); R.rowsHost.appendChild(refs.row); }
      refs.bar.style.background = ch.accent || 'rgba(201,168,76,1)';
      refs.lab.style.color = ch.accent || 'rgba(201,168,76,1)';
      refs.lab.textContent = ch.label || chId;
      // dropdown: rebuild options if the mood list changed; hands off while focused
      if (document.activeElement !== refs.sel) {
        var want = '\u2014 silence \u2014|' + moods.map(function (m) { return m.id + ':' + m.name; }).join('|');
        if (refs.sel.dataset.opts !== want) {
          refs.sel.innerHTML = '';
          var o0 = document.createElement('option'); o0.value = ''; o0.textContent = '\u2014 silence \u2014';
          refs.sel.appendChild(o0);
          moods.forEach(function (m) {
            var o = document.createElement('option'); o.value = m.id; o.textContent = m.name;
            refs.sel.appendChild(o);
          });
          refs.sel.dataset.opts = want;
        }
        refs.sel.value = ch.sourceType === 'sonus' ? '' : (ch.moodId || '');
      }
      if (ch.trackTitle) {
        refs.now.classList.remove('idle');
        refs.now.textContent = (ch.paused ? '\u23F8 ' : '') + ch.trackTitle;
      } else {
        refs.now.classList.add('idle');
        refs.now.textContent = ch.sourceType === 'sonus' ? 'Sonus portal (console-only)' : 'idle';
      }
      refs.pauseB.textContent = ch.paused ? '\u25B6' : '\u23F8';
      if (document.activeElement !== refs.vol) refs.vol.value = String(ch.volume != null ? ch.volume : 0.5);
    }
  }

  // ── chip + dots ───────────────────────────────────────────────────
  function buildChip() {
    if (ON_CONSOLE || S.chip) return;
    var chip = el('div');
    chip.id = 'tok-bardic-chip';
    chip.title = 'Open the Bardic tab';
    chip.innerHTML = '<div class="eq"><i></i><i></i><i></i></div>'
      + '<div class="w"><div class="s"></div><div class="t"></div></div>';
    chip.addEventListener('click', function () {
      if (window.TokRail && window.TokRail.show) window.TokRail.show('bardic');
    });
    document.body.appendChild(chip);
    S.chip = chip;

    // follow the rail's open/collapsed state (the ticker's offsets: 396 / 36)
    var railEl = document.getElementById('tok-rail');
    function railShut() { return !railEl || railEl.classList.contains('tr-collapsed'); }
    function place() { chip.classList.toggle('tok-bd-railshut', railShut()); paintEmber(); }
    if (railEl && typeof MutationObserver === 'function') {
      new MutationObserver(place).observe(railEl, { attributes: true, attributeFilter: ['class'] });
    }
    place();
  }
  function paintChip() {
    if (!S.chip) return;
    var live = playingChannels();
    var show = S.chipPref === 'shown' && live.length > 0;
    S.chip.classList.toggle('tok-bd-off', !show);
    if (!show) return;
    S.chip.querySelector('.s').textContent = 'Now playing \u00b7 ' + live.length + (live.length === 1 ? ' channel' : ' channels');
    S.chip.querySelector('.t').textContent = live.map(function (c) { return c.title; }).join(' \u00b7 ');
    var eqs = S.chip.querySelectorAll('.eq i');
    for (var i = 0; i < eqs.length; i++) eqs[i].style.background = (live[i % live.length] || live[0]).accent;
  }
  function paintDot() {
    if (!S.tabBtn) return;
    var dot = S.tabBtn.querySelector('.tok-bd-dot');
    if (!dot) { dot = el('span', 'tok-bd-dot'); S.tabBtn.appendChild(dot); }
    dot.classList.toggle('on', playingChannels().length > 0);
  }
  function paintEmber() {
    var handle = document.querySelector('.tr-handle');
    if (!handle) return;
    var em = handle.querySelector('.tok-bd-ember');
    if (!em) { em = el('span', 'tok-bd-ember'); handle.appendChild(em); }
    var railEl = document.getElementById('tok-rail');
    var shut = !railEl || railEl.classList.contains('tr-collapsed');
    em.classList.toggle('on', playingChannels().length > 0 && S.chipPref === 'hidden' && shut);
  }
  function paintAll() { paintPane(); paintChip(); paintDot(); paintEmber(); }

  // ── bus wiring ────────────────────────────────────────────────────
  function connectBus() {
    S.bus = window.BardicBus.connect('remote');
    if (!S.bus.supported) { setEngineLive(false); return; }
    S.bus.onMessage(function (msg) {
      if (msg.t === 'state') {
        clearTimeout(pingPending);
        S.snap = msg;
        setEngineLive(true);
      } else if (msg.t === 'engine-bye') {
        setEngineLive(false);
      }
    });
    pingEngine();
    window.addEventListener('focus', pingEngine);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) pingEngine();
    });
  }

  // ── icon + registration ───────────────────────────────────────────
  var TAB_ICON = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M6 14V5l8-2v9"/><circle cx="4.5" cy="14" r="1.8"/><circle cx="12.5" cy="12" r="1.8"/></svg>';

  function register() {
    if (!window.TokRail || !window.TokRail.registerTab) return;
    injectCss();
    ensureBus().then(function () {
      var reg = window.TokRail.registerTab({
        id: 'bardic', label: 'Bardic', icon: TAB_ICON, order: 30,
        onMount: function (pane) { buildPane(pane); },
        onShow: function () { pingEngine(); paintAll(); }
      });
      if (reg) S.tabBtn = reg.button;
      buildChip();
      connectBus();
      paintAll();
    }).catch(function (e) {
      console.warn('[bardic-tab] bus unavailable:', e);
    });
  }

  if (window.TokRail && window.TokRail.ready) register();
  else document.addEventListener('tok-rail:ready', register, { once: true });
})();
