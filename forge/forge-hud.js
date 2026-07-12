/* ── forge-hud.js ────────────────────────────────────────────────────────
   Bite 2 · §6.2–3: the BG3-style extended Battle HUD + Chat Feed.

   Self-contained: injects its own CSS and HTML from the approved v3 mock,
   renders from a state snapshot, dispatches events for interactions.
   Lives alongside cbPanel — the mock hides one or the other behind
   USE_FORGE_BAR. If the flag is off or this file fails to load, the old
   bar is untouched.

   The mock's renderHud() calls:
     window.renderForgeBar({ active, order, iControl, waiting, economy,
       pending, over, selKey, tgtKey, showSight, contestCover, session, kit,
       readying, releasing, sightReport });

   Interactions dispatch CustomEvents on document:
     forge:selectAction  { idx }
     forge:endTurn
     forge:toggleSight
     forge:toggleContest
     forge:tabChange     { tab }

   Loaded as a classic <script> — accesses ForgeKitDerive and
   ForgeFeedRender from window.                                            */
(function () {
  "use strict";
  if (window.__forgeHud) return;

  var activeTab = "attacks";
  var hudInjected = false;

  // ── CSS (ported from forge-battlehud-extended-mock-v3.html) ───────────
  var CSS = '\
/* ═══ FORGE HUD — battle-dark skin (default) ═══ */\n\
#fgBar{--hud-bg:#0d0d14;--hud-bg2:#111018;--hud-line:#1a1a28;--hud-fg:#f0ece4;--hud-dim:#555;--hud-dim2:#444;\
--hud-gold:#b8952a;--hud-red:#c0001a;--hud-blue:#2d7dd2;--hud-green:#5a9a6a;\
--die-bg:#1a1922;--die-bd:#2a2a3a;\
position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:17;width:min(880px,72vw);\
background:var(--hud-bg);border:1px solid var(--hud-line);font-family:"Barlow Condensed",system-ui;color:var(--hud-fg);\
box-shadow:0 14px 40px rgba(20,16,10,.45)}\n\
/* ── forge parchment skin ── */\n\
body.fg-parch #fgBar{--hud-bg:var(--tk-panel);--hud-bg2:var(--tk-panel-2);--hud-line:var(--tk-line);--hud-fg:var(--tk-ink);\
--hud-dim:#6b6455;--hud-dim2:#8a8272;--hud-gold:var(--tk-gold);--hud-red:var(--tk-blood);--hud-blue:var(--tk-teal);--hud-green:#5a7a4a;\
--die-bg:#fff9ee;--die-bd:var(--tk-line);box-shadow:0 14px 40px rgba(60,50,30,.3)}\n\
.fg-top{display:flex;align-items:center;gap:11px;padding:9px 14px;border-bottom:1px solid var(--hud-line)}\n\
.fg-chip{display:flex;align-items:center;gap:9px;padding:2px 4px}\n\
.fg-port{width:38px;height:38px;border:1px solid var(--hud-line);outline:2px solid var(--glow-pc,#e8b53a);\
background:var(--hud-bg2);display:flex;align-items:center;justify-content:center;\
font-family:"Playfair Display",serif;font-weight:700;font-size:19px;color:var(--hud-gold)}\n\
.fg-info{display:flex;flex-direction:column;gap:2px}\n\
.fg-name{font-size:15px;font-weight:700;line-height:1;letter-spacing:.02em}\n\
.fg-hp{font-size:11px;color:var(--hud-green)}\n\
.fg-div{width:1px;height:34px;background:var(--hud-line);flex-shrink:0}\n\
.fg-stats{display:flex;gap:14px}\n\
.fg-stat{display:flex;flex-direction:column;align-items:center;gap:1px}\n\
.fg-stat .v{font-size:16px;font-weight:700;line-height:1}\n\
.fg-stat .k{font-size:9px;color:var(--hud-dim2);letter-spacing:.1em;text-transform:uppercase}\n\
.fg-res{display:flex;gap:12px;align-items:center;flex:1}\n\
.fg-resChip{display:flex;flex-direction:column;gap:3px;align-items:center}\n\
.fg-resChip .k{font-size:9px;color:var(--hud-dim2);text-transform:uppercase;letter-spacing:.08em}\n\
.fg-pips{display:flex;gap:3px}\n\
.fg-pp{width:10px;height:10px;transform:rotate(45deg);border:1px solid var(--hud-line);background:var(--hud-gold);box-shadow:0 0 5px rgba(184,149,42,.5)}\n\
.fg-pp.spent{background:transparent;box-shadow:none}\n\
.fg-pp.tri{transform:none;width:0;height:0;border:none;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:11px solid var(--hud-blue)}\n\
.fg-pp.tri.spent{border-bottom-color:var(--hud-line)}\n\
.fg-pp.ki{border-radius:50%;transform:none;background:var(--hud-fg)}\n\
.fg-pp.ki.spent{background:transparent}\n\
.fg-movebar{width:92px;height:5px;border:1px solid var(--hud-line);background:var(--hud-bg2)}\n\
.fg-movebar i{display:block;height:100%;background:var(--hud-blue)}\n\
.fg-shelf{display:flex;gap:5px;align-items:center;padding:9px 14px;min-height:62px;border-bottom:1px solid var(--hud-line);flex-wrap:wrap}\n\
.fg-tile{width:44px;height:44px;position:relative;border:1px solid var(--hud-line);background:var(--hud-bg2);cursor:pointer;transition:.12s}\n\
.fg-tile:hover{border-color:var(--hud-dim)}\n\
.fg-tile.sel{outline:2px solid var(--hud-gold)}\n\
.fg-tile.greyed{opacity:.35;cursor:default}\n\
.fg-tile svg{position:absolute;inset:7px;stroke:var(--hud-fg);fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}\n\
.fg-tile.spell svg{stroke:var(--hud-blue)}\n\
.fg-tile.heal svg{stroke:var(--hud-green)}\n\
.fg-tile .bns{position:absolute;top:0;right:0;width:0;height:0;border-left:11px solid transparent;border-top:11px solid var(--hud-blue)}\n\
.fg-tile .cost{position:absolute;bottom:0;right:2px;font-size:10px;font-weight:700;color:var(--hud-dim)}\n\
.fg-tile::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);\
white-space:pre;background:var(--hud-fg);color:var(--hud-bg);font-size:11px;letter-spacing:.04em;padding:5px 9px;\
opacity:0;pointer-events:none;transition:.12s;z-index:40}\n\
.fg-tile:hover::after{opacity:1}\n\
.fg-shelfEmpty{font-size:12px;color:var(--hud-dim);letter-spacing:.08em;text-transform:uppercase}\n\
.fg-hint{padding:5px 14px;font-size:12px;color:var(--hud-dim);border-bottom:1px solid var(--hud-line);font-style:italic}\n\
.fg-hint b{color:var(--hud-fg);font-style:normal}\n\
.fg-tabs{display:flex}\n\
.fg-tab{flex:1;padding:8px 5px;background:var(--hud-bg);border:none;border-right:1px solid var(--hud-line);\
display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;transition:background .12s;font-family:"Barlow Condensed",system-ui}\n\
.fg-tab:last-child{border-right:none}\n\
.fg-tab:hover,.fg-tab.active{background:var(--hud-bg2)}\n\
.fg-tab .ico{font-size:15px;line-height:1;color:var(--hud-fg)}\n\
.fg-tab .lbl{font-size:10px;color:var(--hud-dim);letter-spacing:.1em;text-transform:uppercase}\n\
.fg-tab.active .lbl{color:var(--hud-fg)}\n\
.fg-tab.end .ico,.fg-tab.end .lbl{color:var(--hud-gold)}\n\
.fg-gating{padding:14px;text-align:center;font-size:13px;color:var(--hud-dim);border-bottom:1px solid var(--hud-line)}\n\
.fg-gating b{color:var(--hud-fg)}\n\
.fg-foeGo{display:block;width:100%;padding:12px;background:var(--hud-bg2);border:1px solid var(--hud-line);\
color:var(--hud-gold);font-family:"Barlow Condensed",system-ui;font-size:15px;font-weight:600;cursor:pointer;letter-spacing:.06em}\n\
.fg-foeGo:hover{background:var(--hud-line)}\n\
/* ═══ FEED (bottom right) ═══ */\n\
#fgFeed{--hud-bg:#0d0d14;--hud-bg2:#111018;--hud-line:#1a1a28;--hud-fg:#f0ece4;--hud-dim:#555;--hud-dim2:#444;\
--hud-gold:#b8952a;--hud-green:#5a9a6a;--pc-name:#8fb0e0;--foe-name:#e0a08f;\
--die-bg:#1a1922;--die-bd:#2a2a3a;\
position:fixed;right:16px;bottom:16px;z-index:16;width:352px;max-height:52vh;display:flex;flex-direction:column;\
background:var(--hud-bg);border:1px solid var(--hud-line);font-family:"Barlow Condensed",system-ui;color:var(--hud-fg);\
box-shadow:0 14px 40px rgba(20,16,10,.45)}\n\
body.fg-parch #fgFeed{--hud-bg:var(--tk-panel);--hud-bg2:var(--tk-panel-2);--hud-line:var(--tk-line);--hud-fg:var(--tk-ink);\
--hud-dim:#6b6455;--hud-dim2:#8a8272;--hud-gold:var(--tk-gold);--hud-green:#5a7a4a;\
--pc-name:#8a6a1f;--foe-name:var(--tk-blood);--die-bg:#fff9ee;--die-bd:var(--tk-line);\
box-shadow:0 14px 40px rgba(60,50,30,.3)}\n\
.fg-fhd{display:flex;align-items:center;justify-content:space-between;padding:7px 12px;border-bottom:1px solid var(--hud-line)}\n\
.fg-fhd .t{font-size:10px;font-weight:700;letter-spacing:.25em;text-transform:uppercase;color:var(--hud-gold)}\n\
.fg-fbody{overflow:auto;flex:1;padding:4px 0}\n\
.fg-frow{display:flex;gap:8px;padding:7px 12px;border-bottom:1px solid var(--hud-line)}\n\
.fg-frow:hover{background:var(--hud-bg2)}\n\
';

  // ── HTML ──────────────────────────────────────────────────────────────
  function injectHud() {
    if (hudInjected) return;
    hudInjected = true;

    // CSS
    var style = document.createElement("style");
    style.id = "fg-hud-css";
    style.textContent = CSS;
    if (window.ForgeFeedRender && window.ForgeFeedRender.CSS) style.textContent += "\n" + window.ForgeFeedRender.CSS;
    document.head.appendChild(style);

    // Bar HTML
    var bar = document.createElement("div");
    bar.id = "fgBar";
    bar.innerHTML = '<div class="fg-top" id="fgTop"></div>'
      + '<div class="fg-shelf" id="fgShelf"></div>'
      + '<div class="fg-hint" id="fgHint"></div>'
      + '<div class="fg-tabs" id="fgTabs"></div>';
    document.body.appendChild(bar);

    // Feed HTML
    var feed = document.createElement("div");
    feed.id = "fgFeed";
    feed.innerHTML = '<div class="fg-fhd"><span class="t">Game Feed</span></div>'
      + '<div class="fg-fbody" id="fgFeedBody"></div>';
    document.body.appendChild(feed);

    // Tab clicks
    wireTabs();
  }

  // ── TABS ────────────────────────────────────────────────────────────
  var TABS = [
    { key: "attacks",  ico: "\u2694", label: "Attacks", icoColor: "var(--hud-red)" },
    { key: "spells",   ico: "\u2726", label: "Spells",  icoColor: "var(--hud-gold)" },
    { key: "items",    ico: "\u25ce", label: "Items",   icoColor: "var(--hud-fg)" },
    { key: "feats",    ico: "\u2756", label: "Feats",   icoColor: "var(--hud-fg)" },
    { key: "bonus",    ico: "\u26a1", label: "Bonus",   icoColor: "var(--hud-blue)" },
    { key: "actions",  ico: "\u25c9", label: "Actions", icoColor: "var(--hud-fg)" },
    { key: "__end",    ico: "\u27f3", label: "End Turn", end: true }
  ];

  function renderTabs(s) {
    var el = document.getElementById("fgTabs");
    if (!el) return;
    el.innerHTML = TABS.map(function (t) {
      var cls = "fg-tab" + (t.key === activeTab ? " active" : "") + (t.end ? " end" : "");
      var dis = t.end && (!s || !s.iControl || s.waiting || s.over || (s.active && s.active.side !== "pc")) ? ' disabled title="Not your turn"' : "";
      return '<button class="' + cls + '" data-tab="' + t.key + '"' + dis + '>'
        + '<span class="ico" style="color:' + (t.icoColor || "var(--hud-fg)") + '">' + t.ico + '</span>'
        + '<span class="lbl">' + t.label + '</span></button>';
    }).join("");
  }

  function wireTabs() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".fg-tab");
      if (!btn) return;
      var tab = btn.dataset.tab;
      if (tab === "__end") {
        document.dispatchEvent(new CustomEvent("forge:endTurn"));
        return;
      }
      activeTab = tab;
      document.dispatchEvent(new CustomEvent("forge:tabChange", { detail: { tab: tab } }));
      // re-render the bar with cached state
      if (_lastState) renderForgeBar(_lastState);
    });
  }

  // ── TOP ROW ─────────────────────────────────────────────────────────
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c] || c; }); }

  function renderTop(s) {
    var el = document.getElementById("fgTop");
    if (!el || !s || !s.active) return;
    var u = s.active;
    var kit = s.kit || {};
    var isPc = u.side === "pc";

    // Portrait chip
    var initial = (u.name || "?").charAt(0).toUpperCase();
    var portStyle = isPc ? 'outline:2px solid var(--glow-pc)' : 'outline:2px solid var(--glow-foe,#c0402f)';

    // HP color
    var hpPct = u.hpMax ? u.hp / u.hpMax : 1;
    var hpColor = hpPct <= 0.25 ? "var(--hud-red)" : hpPct <= 0.5 ? "var(--hud-gold)" : "var(--hud-green)";

    // Economy pips
    var eco = s.economy || {};
    var actionPip = '<span class="fg-pp' + (eco.usedAction ? " spent" : "") + '"></span>';
    var bonusPip = '<span class="fg-pp tri' + (eco.usedBonus ? " spent" : "") + '"></span>';

    // Resource pips (from kit.pools)
    var resPips = "";
    (kit.pools || []).forEach(function (p) {
      if (p.kind === "slot" && p.max > 6) return; // skip large slot pools — they'd overflow
      var pips = "";
      var ppClass = p.kind === "resource" ? " ki" : "";
      for (var i = 0; i < p.max; i++) {
        pips += '<span class="fg-pp' + ppClass + (i >= p.current ? " spent" : "") + '"></span>';
      }
      resPips += '<div class="fg-resChip"><div class="fg-pips">' + pips + '</div><span class="k">' + esc(p.label) + "</span></div>";
    });

    // Move bar
    var moveLeft = eco.moveLeft != null ? eco.moveLeft : Math.floor((u.speed || 30) / 5);
    var moveMax = Math.floor((u.speed || 30) / 5);
    var movePct = moveMax > 0 ? Math.round(100 * moveLeft / moveMax) : 0;

    el.innerHTML = '<div class="fg-chip">'
      + '<div class="fg-port" style="' + portStyle + '">' + initial + '</div>'
      + '<div class="fg-info"><span class="fg-name">' + esc(u.name).toUpperCase() + '</span>'
      + '<span class="fg-hp" style="color:' + hpColor + '">' + Math.max(0, u.hp) + ' / ' + u.hpMax + '</span></div></div>'
      + '<div class="fg-div"></div>'
      + '<div class="fg-stats">'
      + '<div class="fg-stat"><span class="v">' + (u.ac || 10) + '</span><span class="k">AC</span></div>'
      + '<div class="fg-stat"><span class="v">' + (u.speed || 30) + '</span><span class="k">Spd</span></div>'
      + '<div class="fg-stat"><span class="v">' + (u.initMod >= 0 ? "+" + u.initMod : u.initMod) + '</span><span class="k">Init</span></div></div>'
      + '<div class="fg-div"></div>'
      + '<div class="fg-res">'
      + '<div class="fg-resChip"><div class="fg-pips">' + actionPip + '</div><span class="k">Action</span></div>'
      + '<div class="fg-resChip"><div class="fg-pips">' + bonusPip + '</div><span class="k">Bonus</span></div>'
      + resPips
      + '<div class="fg-resChip"><div class="fg-movebar"><i style="width:' + movePct + '%"></i></div>'
      + '<span class="k">Move ' + (moveLeft * 5) + '/' + (moveMax * 5) + '</span></div></div>';
  }

  // ── SHELF (tile grid) ───────────────────────────────────────────────
  function renderShelf(s) {
    var el = document.getElementById("fgShelf");
    if (!el) return;

    if (!s || !s.active || !s.iControl) {
      el.innerHTML = '<span class="fg-shelfEmpty">' + (s && s.active ? esc(s.active.name) + "\u2019s turn \u2014 watching." : "No active unit.") + '</span>';
      return;
    }

    var u = s.active;
    var isPc = u.side === "pc";

    // Foe turn: show the ▶ Run button
    if (!isPc) {
      el.innerHTML = '<button class="fg-foeGo" id="fgFoeGo"'
        + (s.waiting ? ' disabled title="Waiting\u2026"' : '') + '>\u25b6 Run '
        + esc(u.name) + '\u2019s turn</button>';
      var fBtn = document.getElementById("fgFoeGo");
      if (fBtn) fBtn.addEventListener("click", function () {
        document.dispatchEvent(new CustomEvent("forge:runFoe"));
      });
      return;
    }

    // PC turn: show tiles from the active tab
    var kit = s.kit || {};
    var tiles = (kit.tabs && kit.tabs[activeTab]) || [];

    if (!tiles.length) {
      el.innerHTML = '<span class="fg-shelfEmpty">No ' + activeTab + ' on this character.</span>';
      return;
    }

    el.innerHTML = tiles.map(function (t, i) {
      var isSelected = s.pending && s.pending._tileId === t.id;
      var cls = "fg-tile";
      if (isSelected) cls += " sel";
      if (t.greyed) cls += " greyed";
      if (t.spell || t.tab === "spells") cls += " spell";
      if (t.kind === "heal" || t.kind === "potion") cls += " heal";

      // Tooltip: label + cost + damage
      var tip = esc(t.label);
      if (t.dmg) tip += " \u00b7 " + t.dmg;
      if (t.dc) tip += " \u00b7 DC " + t.dc;
      if (t.hit) tip += " \u00b7 +" + t.hit;
      if (t.bonus) tip += " \u00b7 bonus";
      if (t.conc) tip += " \u00b7 conc.";
      if (t.greyed && t.greyReason) tip += "\\n" + t.greyReason;

      // Icon
      var iconId = iconIdFor(t);
      var iconSvg = iconId
        ? '<svg viewBox="0 0 24 24"><use href="#' + iconId + '"/></svg>'
        : '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:var(--hud-dim)">'
          + (t.label || "?").charAt(0).toUpperCase() + '</span>';

      // Bonus corner mark
      var bns = t.bonus ? '<span class="bns"></span>' : "";
      // Cost badge
      var cost = "";
      if (t.cost) {
        var keys = Object.keys(t.cost);
        cost = '<span class="cost">' + (keys.length ? t.cost[keys[0]] : "") + '</span>';
      }

      return '<div class="' + cls + '" data-tip="' + tip + '" data-tile-idx="' + i + '" data-tile-id="' + esc(t.id || "") + '">'
        + iconSvg + bns + cost + '</div>';
    }).join("");

    // Wire tile clicks
    el.querySelectorAll(".fg-tile").forEach(function (tEl) {
      if (tEl.classList.contains("greyed")) return;
      tEl.addEventListener("click", function () {
        var tileId = tEl.dataset.tileId;
        // Find the index in u.actions by matching _tileId
        var idx = -1;
        (u.actions || []).forEach(function (a, i) { if (a._tileId === tileId) idx = i; });
        if (idx >= 0) {
          document.dispatchEvent(new CustomEvent("forge:selectAction", { detail: { idx: idx } }));
        } else {
          // Universal actions (dash, disengage, etc.) — dispatch by kind
          var tile = tiles[+tEl.dataset.tileIdx];
          if (tile && tile.universal) {
            document.dispatchEvent(new CustomEvent("forge:universalAction", { detail: { kind: tile.kind, tile: tile } }));
          }
        }
      });
    });
  }

  function iconIdFor(tile) {
    if (!window.ForgeKitDerive) return null;
    var name = window.ForgeKitDerive.iconFor(tile);
    if (!name) return null;
    // Check if the SVG symbol exists
    var id = "gi-" + name;
    if (document.getElementById(id)) return id;
    // Fall back to v3 mock's i- prefix symbols
    var id2 = "i-" + name;
    if (document.getElementById(id2)) return id2;
    return id; // try the gi- prefix even if not found — the SVG sprite may load later
  }

  // ── HINT (contextual strip above tabs) ──────────────────────────────
  function renderHint(s) {
    var el = document.getElementById("fgHint");
    if (!el) return;
    if (!s || !s.active || !s.iControl) { el.style.display = "none"; return; }
    el.style.display = "";
    var u = s.active;
    if (u.side !== "pc") { el.innerHTML = ""; el.style.display = "none"; return; }

    if (s.waiting) {
      el.innerHTML = "<i>Waiting for the table\u2026</i>";
    } else if (s.pending) {
      el.innerHTML = "<b>" + esc(s.pending.label) + "</b> \u2014 "
        + ((s.pending.rng || 1) > 1 ? "red = in range \u00b7 amber = long (disadv) \u00b7 grey = unreachable" : "click a highlighted target");
    } else {
      el.innerHTML = "Move on teal \u00b7 pick an action, then a target.";
    }
  }

  // ── FEED ────────────────────────────────────────────────────────────
  var feedLog = [];
  function addFeedRow(html) {
    feedLog.unshift(html);
    if (feedLog.length > 80) feedLog.pop();
    renderFeed();
  }
  function renderFeed() {
    var el = document.getElementById("fgFeedBody");
    if (!el) return;
    el.innerHTML = feedLog.map(function (h) { return '<div class="fg-frow">' + h + '</div>'; }).join("");
  }

  // ── MAIN RENDER ─────────────────────────────────────────────────────
  var _lastState = null;
  function renderForgeBar(s) {
    if (!hudInjected) injectHud();
    _lastState = s;

    var bar = document.getElementById("fgBar");
    var feed = document.getElementById("fgFeed");
    if (!bar) return;

    if (!s || !s.active) {
      bar.style.display = "none";
      if (feed) feed.style.display = "none";
      return;
    }
    bar.style.display = "";
    if (feed) feed.style.display = "";

    renderTop(s);
    renderShelf(s);
    renderHint(s);
    renderTabs(s);
  }

  // ── PUBLIC ──────────────────────────────────────────────────────────
  window.__forgeHud = true;
  window.renderForgeBar = renderForgeBar;
  window.addForgeRow = addFeedRow;
})();
