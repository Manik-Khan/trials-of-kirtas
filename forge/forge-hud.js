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
.fg-tile svg{position:absolute;inset:7px;fill:var(--hud-fg)}\n\
.fg-tile.spell svg{fill:var(--hud-blue)}\n\
.fg-tile.heal svg{fill:var(--hud-green)}\n\
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
/* ═══ OVERFLOW CHIP ═══ */\n\
.fg-overflow{padding:2px 7px;font-size:11px;font-weight:700;color:var(--hud-dim2);background:var(--hud-bg2);\
border:1px solid var(--hud-line);cursor:pointer;letter-spacing:.04em;white-space:nowrap}\n\
.fg-overflow:hover{color:var(--hud-fg)}\n\
/* ═══ RESOURCES TAB ═══ */\n\
.fg-resGrid{display:flex;gap:8px;padding:9px 14px;overflow-x:auto;min-height:62px;border-bottom:1px solid var(--hud-line)}\n\
.fg-resCard{min-width:120px;max-width:160px;flex-shrink:0;background:var(--hud-bg2);border:1px solid var(--hud-line);padding:8px 10px;cursor:pointer;transition:.12s}\n\
.fg-resCard:hover{border-color:var(--hud-dim)}\n\
.fg-resCard .rc-label{font-size:12px;font-weight:600;letter-spacing:.04em;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n\
.fg-resCard .rc-pips{display:flex;gap:3px;flex-wrap:wrap;margin-bottom:4px}\n\
.fg-resCard .rc-die{font-size:10px;color:var(--hud-gold);font-weight:700}\n\
.fg-resCard .rc-detail{display:none;margin-top:6px;padding-top:6px;border-top:1px solid var(--hud-line);font-size:11px;color:var(--hud-dim2);line-height:1.4}\n\
.fg-resCard.expanded .rc-detail{display:block}\n\
.fg-resCard .rc-detail b{color:var(--hud-fg);font-weight:600}\n\
.fg-resCard.tone-class{border-left:3px solid var(--hud-gold)}\n\
.fg-resCard.tone-subclass{border-left:3px solid #3a8a8a}\n\
.fg-resCard.tone-race{border-left:3px solid var(--hud-red)}\n\
.fg-resCard.tone-custom{border-left:3px solid #8a6aaa}\n\
/* ═══ DETAIL DRAWER ═══ */\n\
#fgDrawer{position:fixed;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);z-index:18;width:min(460px,68vw);\
background:var(--hud-bg);border:1px solid var(--hud-line);font-family:"Barlow Condensed",system-ui;color:var(--hud-fg);\
box-shadow:0 -8px 30px rgba(0,0,0,.35);display:none;max-height:40vh;overflow-y:auto}\n\
body.fg-parch #fgDrawer{--hud-bg:var(--tk-panel);--hud-line:var(--tk-line);--hud-fg:var(--tk-ink);--hud-dim:#6b6455;\
--hud-dim2:#8a8272;--hud-gold:var(--tk-gold);--hud-red:var(--tk-blood)}\n\
.fg-dw-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--hud-line)}\n\
.fg-dw-name{font-size:15px;font-weight:700;letter-spacing:.03em}\n\
.fg-dw-cost{font-size:12px;color:var(--hud-dim2);display:flex;gap:8px;align-items:center}\n\
.fg-dw-cost .conc{color:var(--hud-gold);font-weight:600}\n\
.fg-dw-body{padding:10px 14px;font-size:13px;line-height:1.5;color:var(--hud-dim2)}\n\
.fg-dw-body b,.fg-dw-body strong{color:var(--hud-fg);font-weight:600}\n\
.fg-dw-body p{margin:0 0 6px}\n\
.fg-dw-actions{display:flex;gap:8px;padding:8px 14px;border-top:1px solid var(--hud-line)}\n\
.fg-dw-btn{padding:5px 12px;background:var(--hud-bg2);border:1px solid var(--hud-line);color:var(--hud-fg);\
font-family:"Barlow Condensed",system-ui;font-size:12px;cursor:pointer;letter-spacing:.06em}\n\
.fg-dw-btn:hover{background:var(--hud-line)}\n\
.fg-dw-grey{color:var(--hud-dim);font-style:italic}\n\
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
    // Tile long-press / right-click → detail drawer; overflow chip → resources tab
    wireTileInteractions();
  }

  // ── TABS ────────────────────────────────────────────────────────────
  var TABS = [
    { key: "attacks",   ico: "\u2694", label: "Attacks",   icoColor: "var(--hud-red)" },
    { key: "spells",    ico: "\u2726", label: "Spells",    icoColor: "var(--hud-gold)" },
    { key: "items",     ico: "\u25ce", label: "Items",     icoColor: "var(--hud-fg)" },
    { key: "feats",     ico: "\u2756", label: "Feats",     icoColor: "var(--hud-fg)" },
    { key: "bonus",     ico: "\u26a1", label: "Bonus",     icoColor: "var(--hud-blue)" },
    { key: "actions",   ico: "\u25c9", label: "Actions",   icoColor: "var(--hud-fg)" },
    { key: "resources", ico: "\u2b21", label: "Resources", icoColor: "var(--hud-dim2)" },
    { key: "__end",     ico: "\u27f3", label: "End Turn",  end: true }
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

    // Resource pips (curated: ≤3 prioritized pip groups, then +N overflow)
    // Priority: spell-slot pools by level, then class resources by origin
    // (class → subclass → race → custom). Large pools (max>6) skip the top row.
    var resPips = "";
    var allPools = (kit.pools || []).slice();
    var ORIGIN_ORDER = { "class": 0, "subclass": 1, "race": 2, "custom": 3 };
    var sortedPools = allPools
      .filter(function (p) { return p.max > 0 && !(p.kind === "slot" && p.max > 6); })
      .sort(function (a, b) {
        // slots first (by level asc), then resources by origin priority
        if (a.kind === "slot" && b.kind !== "slot") return -1;
        if (a.kind !== "slot" && b.kind === "slot") return 1;
        if (a.kind === "slot" && b.kind === "slot") return (a.level || 0) - (b.level || 0);
        var oa = ORIGIN_ORDER[a.origin || "class"] || 0, ob = ORIGIN_ORDER[b.origin || "class"] || 0;
        return oa - ob;
      });
    var MAX_TOP_PIPS = 3;
    var shownPools = sortedPools.slice(0, MAX_TOP_PIPS);
    var overflowCount = sortedPools.length - shownPools.length;
    shownPools.forEach(function (p) {
      var pips = "";
      var ppClass = p.kind === "resource" ? " ki" : "";
      for (var j = 0; j < p.max; j++) {
        pips += '<span class="fg-pp' + ppClass + (j >= p.current ? " spent" : "") + '"></span>';
      }
      resPips += '<div class="fg-resChip"><div class="fg-pips">' + pips + '</div><span class="k">' + esc(p.label) + "</span></div>";
    });
    if (overflowCount > 0) {
      resPips += '<div class="fg-resChip"><button class="fg-overflow" data-tab="resources">+' + overflowCount + '</button></div>';
    }

    // Move bar
    var moveLeft = eco.moveLeft != null ? eco.moveLeft : Math.floor((u.speed || 30) / 5);
    var moveMax = eco.moveMax != null ? eco.moveMax : Math.floor((u.speed || 30) / 5);
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

    // Close the drawer on any shelf re-render (tab change, turn change, etc.)
    closeDrawer();

    if (!s || !s.active || !s.iControl) {
      el.innerHTML = '<span class="fg-shelfEmpty">' + (s && s.active ? esc(s.active.name) + "\u2019s turn \u2014 watching." : "No active unit.") + '</span>';
      return;
    }

    // Resources tab: render cards instead of tiles
    if (activeTab === "resources") {
      renderResources(s);
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

      // Icon — resolved from registries (SpellIcons / ItemIcons)
      var svgMarkup = iconSvgFor(t, s._structural);
      var iconHtml = svgMarkup
        ? svgMarkup
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
        + iconHtml + bns + cost + '</div>';
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

  /* Resolve a tile's icon to inline SVG markup from the registries.
     Returns an SVG string, or null for letter-tile fallback.
     Uses ForgeKitDerive.resolveIcon (the full chain: inline → override →
     keyword → category → letter), then renders via whichever registry
     owns the resolved glyph name. */
  function iconSvgFor(tile, structural) {
    var name = null;
    if (window.ForgeKitDerive && window.ForgeKitDerive.resolveIcon) {
      name = window.ForgeKitDerive.resolveIcon(tile, structural || {});
    } else if (window.ForgeKitDerive) {
      name = window.ForgeKitDerive.iconFor(tile);
    }
    if (!name) return null;
    // Check SpellIcons first, then ItemIcons
    if (window.SpellIcons && window.SpellIcons.BODIES && window.SpellIcons.BODIES[name]) {
      return window.SpellIcons.iconSvg(name, 30);
    }
    if (window.ItemIcons && window.ItemIcons.BODIES && window.ItemIcons.BODIES[name]) {
      return window.ItemIcons.iconSvg(name, 30);
    }
    return null;
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

  // ── RESOURCES TAB (⬡) ───────────────────────────────────────────────
  /* Renders scrollable cards, one per pool. Tap toggles expanded detail. */
  function renderResources(s) {
    var el = document.getElementById("fgShelf");
    if (!el) return;
    var kit = s.kit || {};
    var pools = kit.pools || [];
    if (!pools.length) {
      el.innerHTML = '<span class="fg-shelfEmpty">No tracked resources.</span>';
      return;
    }
    el.innerHTML = '<div class="fg-resGrid">' + pools.map(function (p, idx) {
      var pips = "";
      for (var j = 0; j < p.max; j++) {
        pips += '<span class="fg-pp ki' + (j >= p.current ? " spent" : "") + '"></span>';
      }
      var dieBadge = p.die ? '<span class="rc-die">' + esc(p.die) + '</span>' : "";
      var toneClass = p.tone ? " tone-" + p.tone : "";
      var detail = '<div class="rc-detail">';
      if (p.recharge) detail += '<div><b>Recharge:</b> ' + esc(p.recharge) + '</div>';
      if (p.origin)   detail += '<div><b>Origin:</b> ' + esc(p.origin) + '</div>';
      if (p.source && p.source !== p.origin) detail += '<div><b>Source:</b> ' + esc(p.source) + '</div>';
      detail += '<div><b>Current:</b> ' + p.current + ' / ' + p.max + '</div>';
      detail += '</div>';
      return '<div class="fg-resCard' + toneClass + '" data-pool-idx="' + idx + '">'
        + '<div class="rc-label">' + esc(p.label) + '</div>'
        + '<div class="rc-pips">' + pips + '</div>'
        + dieBadge + detail + '</div>';
    }).join("") + '</div>';
    // Wire tap-to-expand
    el.querySelectorAll(".fg-resCard").forEach(function (card) {
      card.addEventListener("click", function () { card.classList.toggle("expanded"); });
    });
  }

  // ── DETAIL DRAWER ─────────────────────────────────────────────────────
  /* Long-press (touch) / right-click (desktop) on any tile → card above the bar.
     Anchored to #fgBar. Shows name, cost line, full description, Change Icon, Hide. */
  var _drawerEl = null;
  var _drawerTile = null;
  var _spellTextCache = {};

  function ensureDrawer() {
    if (_drawerEl) return _drawerEl;
    _drawerEl = document.createElement("div");
    _drawerEl.id = "fgDrawer";
    var bar = document.getElementById("fgBar");
    if (bar) bar.appendChild(_drawerEl);
    else document.body.appendChild(_drawerEl);
    // Close on click-outside
    document.addEventListener("click", function (e) {
      if (_drawerEl.style.display === "none") return;
      if (!_drawerEl.contains(e.target) && !e.target.closest(".fg-tile")) {
        closeDrawer();
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrawer();
    });
    return _drawerEl;
  }

  function closeDrawer() {
    if (_drawerEl) _drawerEl.style.display = "none";
    _drawerTile = null;
  }

  function openDrawer(tile, structural) {
    var dw = ensureDrawer();
    _drawerTile = tile;

    // ── cost line ──
    var costParts = [];
    if (tile.bonus) costParts.push("\u25b2 Bonus");
    else if (tile.free) costParts.push("\u2022 Free");
    else if (!tile.passive && !tile.universal) costParts.push("\u25c6 Action");
    if (tile.hit) costParts.push("+" + tile.hit + " to hit");
    if (tile.dc) costParts.push("DC " + tile.dc);
    if (tile.cost) {
      var keys = Object.keys(tile.cost);
      keys.forEach(function (k) { costParts.push(tile.cost[k] + "\u00d7 " + k); });
    }
    var concBadge = tile.conc ? '<span class="conc">CONC</span>' : "";

    // ── description ──
    var desc = "";
    if (tile.greyed && tile.greyReason) {
      desc = '<p class="fg-dw-grey">' + esc(tile.greyReason) + '</p>';
    } else if (!tile.spell && tile._src && tile._src.entries) {
      // Feature/feat with 5etools entries array — render rich text
      desc = _renderSpellEntries(tile._src);
    } else if (tile.desc) {
      desc = '<p>' + esc(tile.desc) + '</p>';
    } else if (tile.dmg) {
      // Attack tiles: format damage + rider
      desc = '<p>' + esc(tile.dmg);
      if (tile.dmgStack && tile.dmgStack.length) {
        desc += ' (' + tile.dmgStack.map(function (d) {
          return esc(d.dice + (d.bonus > 0 ? '+' + d.bonus : d.bonus < 0 ? d.bonus : '') + (d.type ? ' ' + d.type : ''));
        }).join(' + ') + ')';
      }
      if (tile.rider) desc += '<br>' + esc(tile.rider);
      desc += '</p>';
    }

    // For spells: attempt to load full text if we haven't already
    if (tile.spell && tile._src && tile._src.name && !tile.desc) {
      var spellName = tile._src.name;
      if (_spellTextCache[spellName]) {
        desc = _renderSpellEntries(_spellTextCache[spellName]);
      } else {
        desc = '<p><i>Loading spell text\u2026</i></p>';
        _loadSpellText(spellName, function (entries) {
          if (_drawerTile === tile && _drawerEl && _drawerEl.style.display !== "none") {
            var bodyEl = _drawerEl.querySelector(".fg-dw-body");
            if (bodyEl) bodyEl.innerHTML = entries ? _renderSpellEntries(entries) : '<p><i>Full text unavailable.</i></p>';
          }
        });
      }
    }

    // ── actions row ──
    var actionsHtml = '<div class="fg-dw-actions">';
    actionsHtml += '<button class="fg-dw-btn" data-dw-action="icon">\u270e Change icon</button>';
    actionsHtml += '<button class="fg-dw-btn" data-dw-action="hide">\u2716 Hide from bar</button>';
    actionsHtml += '</div>';

    dw.innerHTML = '<div class="fg-dw-head"><span class="fg-dw-name">' + esc(tile.label || tile.name || "?") + '</span>'
      + '<span class="fg-dw-cost">' + costParts.join(' \u00b7 ') + ' ' + concBadge + '</span></div>'
      + '<div class="fg-dw-body">' + desc + '</div>'
      + actionsHtml;
    dw.style.display = "block";

    // Wire drawer actions
    dw.querySelectorAll("[data-dw-action]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var action = btn.dataset.dwAction;
        if (action === "icon") {
          document.dispatchEvent(new CustomEvent("forge:openIconPicker", { detail: { tile: tile } }));
        } else if (action === "hide") {
          document.dispatchEvent(new CustomEvent("forge:hideTile", { detail: { tileId: tile.id } }));
          closeDrawer();
        }
      });
    });
  }

  /* Lazy-load spell text from soul-shards-data.js. Non-fatal on failure. */
  function _loadSpellText(spellName, cb) {
    if (_spellTextCache[spellName]) { cb(_spellTextCache[spellName]); return; }
    if (window.SoulShardsData && window.SoulShardsData.loadSpellMeta) {
      window.SoulShardsData.loadSpellMeta([spellName], { detail: true }).then(function (results) {
        var sp = (results || []).filter(function (r) { return r.name.toLowerCase() === spellName.toLowerCase(); })[0];
        if (sp && sp.entries) {
          _spellTextCache[spellName] = sp;
          cb(sp);
        } else { cb(null); }
      }).catch(function () { cb(null); });
    } else { cb(null); }
  }

  /* Render 5etools entries array to simple HTML. */
  function _renderSpellEntries(sp) {
    if (!sp || !sp.entries) return '<p><i>No description.</i></p>';
    var html = '';
    // Spell meta line
    var meta = [];
    if (sp.time && sp.time[0]) {
      var t = sp.time[0];
      meta.push('<b>Casting:</b> ' + (t.number || 1) + ' ' + (t.unit || 'action'));
    }
    if (sp.range) {
      var r = sp.range;
      if (r.type === 'point' && r.distance) meta.push('<b>Range:</b> ' + (r.distance.amount || 0) + ' ' + (r.distance.type || 'ft'));
      else if (r.type === 'special') meta.push('<b>Range:</b> special');
      else meta.push('<b>Range:</b> ' + (r.type || 'varies'));
    }
    if (sp.duration && sp.duration[0]) {
      var d = sp.duration[0];
      if (d.concentration) meta.push('<b>Duration:</b> Conc., ' + (d.duration ? (d.duration.amount + ' ' + d.duration.type) : ''));
      else if (d.type === 'instant') meta.push('<b>Duration:</b> Instantaneous');
      else if (d.duration) meta.push('<b>Duration:</b> ' + d.duration.amount + ' ' + d.duration.type);
    }
    if (sp.components) {
      var c = sp.components;
      var parts = [];
      if (c.v) parts.push('V');
      if (c.s) parts.push('S');
      if (c.m) parts.push('M' + (typeof c.m === 'string' ? ' (' + c.m + ')' : c.m && c.m.text ? ' (' + c.m.text + ')' : ''));
      meta.push('<b>Components:</b> ' + parts.join(', '));
    }
    if (meta.length) html += '<p style="font-size:11px;color:var(--hud-dim)">' + meta.join(' \u00b7 ') + '</p>';
    // Entries
    (sp.entries || []).forEach(function (e) {
      if (typeof e === 'string') html += '<p>' + _entryText(e) + '</p>';
      else if (e && e.type === 'entries' && e.entries) {
        html += '<p><b>' + esc(e.name || '') + '</b></p>';
        e.entries.forEach(function (sub) {
          if (typeof sub === 'string') html += '<p>' + _entryText(sub) + '</p>';
        });
      } else if (e && e.type === 'list' && e.items) {
        e.items.forEach(function (li) {
          html += '<p>\u2022 ' + (typeof li === 'string' ? _entryText(li) : esc(li.entry || JSON.stringify(li))) + '</p>';
        });
      }
    });
    if (sp.entriesHigherLevel) {
      (sp.entriesHigherLevel || []).forEach(function (e) {
        if (typeof e === 'string') html += '<p><i>' + _entryText(e) + '</i></p>';
        else if (e && e.entries) {
          html += '<p><b>' + esc(e.name || 'At Higher Levels') + '.</b> ';
          e.entries.forEach(function (sub) { if (typeof sub === 'string') html += _entryText(sub) + ' '; });
          html += '</p>';
        }
      });
    }
    return html || '<p><i>No description.</i></p>';
  }

  /* Strip 5etools inline tags like {@damage 1d6} → 1d6, {@condition blinded} → blinded */
  function _entryText(s) {
    return esc(String(s || '').replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/g, '$1'));
  }

  // ── TILE INTERACTIONS (drawer trigger) ─────────────────────────────────
  /* Wire long-press (touch) / right-click (desktop) on tiles to open the drawer. */
  function wireTileInteractions() {
    var _longTimer = null;
    document.addEventListener("contextmenu", function (e) {
      var tile = e.target.closest(".fg-tile");
      if (!tile) return;
      e.preventDefault();
      _openDrawerForTile(tile);
    });
    document.addEventListener("touchstart", function (e) {
      var tile = e.target.closest(".fg-tile");
      if (!tile) return;
      _longTimer = setTimeout(function () { _openDrawerForTile(tile); }, 500);
    }, { passive: true });
    document.addEventListener("touchend", function () { clearTimeout(_longTimer); }, { passive: true });
    document.addEventListener("touchmove", function () { clearTimeout(_longTimer); }, { passive: true });

    // Overflow chip clicks → switch to resources tab
    document.addEventListener("click", function (e) {
      var ov = e.target.closest(".fg-overflow");
      if (!ov) return;
      activeTab = "resources";
      if (_lastState) renderForgeBar(_lastState);
    });
  }

  function _openDrawerForTile(tileEl) {
    var idx = +tileEl.dataset.tileIdx;
    if (isNaN(idx) || !_lastState || !_lastState.kit) return;
    var kit = _lastState.kit;
    var tiles = (kit.tabs && kit.tabs[activeTab]) || [];
    var tile = tiles[idx];
    if (!tile) return;
    openDrawer(tile, _lastState._structural || {});
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
