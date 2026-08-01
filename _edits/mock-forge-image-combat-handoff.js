(function () {
  "use strict";
  var Core = window.ForgeImageCombatHandoffProof, TG = window.TacticsGeo;
  var ui = {};
  ["sourceName","sourceReceipt","palette","mapReceipt","placeCombatants","startFight","sceneName","boardWrap","board","empty","status","turnTitle","turnHelp","attackNearest","endTurn","roundLabel","roster","feed","fatal"].forEach(function (id) {
    ui[id] = document.getElementById(id);
  });
  var context = ui.board.getContext("2d"), state = {
    handoff: null, image: null, compiled: null, deployment: null, fight: null, view: "rules", layout: null
  };

  function setStatus(message) { ui.status.textContent = message; }
  function hashKey() {
    var match = location.hash.match(/(?:^#|&)handoff=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
  function loadHandoff() {
    var storageKey = hashKey(), raw = storageKey && sessionStorage.getItem(storageKey);
    if (!raw) throw new Error("No local Structure Review handoff was found in this browser tab.");
    var handoff = JSON.parse(raw);
    if (!handoff || handoff.contract !== "forge-image-combat-handoff/v1") throw new Error("The artwork handoff contract is missing.");
    state.handoff = handoff;
    state.compiled = Core.reviewToMap(handoff.review, handoff.analysis);
    if (!state.compiled.validation.ok) throw new Error("The current Forge map rejected this review: " + state.compiled.validation.errors.join("; "));
    var dataUrl = handoff.underlayKey && sessionStorage.getItem(handoff.underlayKey);
    if (dataUrl) {
      state.image = new Image(); state.image.onload = renderBoard; state.image.src = dataUrl;
    }
    renderSource(); renderMapReceipt(); renderAll();
    ui.empty.hidden = true; ui.placeCombatants.disabled = false;
    setStatus("Confirmed structure meaning is now a current Forge map. Place combatants to test its open ground.");
  }
  function renderSource() {
    var source = state.handoff.source || {}, receipt = state.compiled.receipt;
    ui.sourceName.textContent = String(source.name || state.handoff.review.scene || "Reviewed artwork").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    ui.sceneName.textContent = state.handoff.review.scene || "Reviewed artwork";
    ui.sourceReceipt.textContent = (source.width || "?") + " × " + (source.height || "?") + " source pixels · "
      + receipt.authoredRegions + " confirmed structure" + (receipt.authoredRegions === 1 ? "" : "s") + " · local only";
    ui.palette.replaceChildren();
    state.compiled.map.meta.palette.forEach(function (color) {
      var swatch = document.createElement("i"); swatch.style.background = color; swatch.title = color; ui.palette.appendChild(swatch);
    });
  }
  function renderMapReceipt() {
    var receipt = state.compiled.receipt, rows = [
      ["Grid", state.compiled.map.cols + " × " + state.compiled.map.rows],
      ["Blocked", receipt.blockedCells + " squares"],
      ["Elevated", receipt.elevatedCells + " squares"],
      ["Connectors", String(receipt.connectors)],
      ["Artwork colors", receipt.paletteColors + " retained"]
    ];
    ui.mapReceipt.replaceChildren();
    rows.forEach(function (item) {
      var row = document.createElement("div"), label = document.createElement("span"), value = document.createElement("b");
      label.textContent = item[0]; value.textContent = item[1]; row.append(label, value); ui.mapReceipt.appendChild(row);
    });
    if (receipt.deferredUnderpasses) {
      var warning = document.createElement("p");
      warning.textContent = receipt.deferredUnderpasses + " bridge underpass" + (receipt.deferredUnderpasses === 1 ? " is" : "es are") + " visibly retained but deferred as simultaneous occupancy.";
      ui.mapReceipt.appendChild(warning);
    }
  }
  function boardLayout() {
    var map = state.compiled.map, pad = 28;
    var cell = Math.max(5, Math.min((ui.board.width - pad * 2) / map.cols, (ui.board.height - pad * 2) / map.rows));
    var width = cell * map.cols, height = cell * map.rows;
    return { cell: cell, x: (ui.board.width - width) / 2, y: (ui.board.height - height) / 2, width: width, height: height };
  }
  function tint(color, amount) {
    var value = String(color || "#777777").replace("#", "");
    var red = parseInt(value.slice(0,2),16), green = parseInt(value.slice(2,4),16), blue = parseInt(value.slice(4,6),16);
    return "rgb(" + Math.round(red * amount) + "," + Math.round(green * amount) + "," + Math.round(blue * amount) + ")";
  }
  function drawArtwork(layout, alpha) {
    if (!state.image) return;
    var grid = state.handoff.review.grid, analysis = state.handoff.analysis;
    context.save(); context.globalAlpha = alpha;
    context.drawImage(state.image,
      layout.x + (-grid.originX / grid.cellPx) * layout.cell,
      layout.y + (-grid.originY / grid.cellPx) * layout.cell,
      (analysis.width / grid.cellPx) * layout.cell,
      (analysis.height / grid.cellPx) * layout.cell);
    context.restore();
  }
  function drawGrid(layout, strong) {
    var map = state.compiled.map;
    context.save(); context.beginPath();
    for (var c = 0; c <= map.cols; c++) { var x = layout.x + c * layout.cell; context.moveTo(x, layout.y); context.lineTo(x, layout.y + layout.height); }
    for (var r = 0; r <= map.rows; r++) { var y = layout.y + r * layout.cell; context.moveTo(layout.x, y); context.lineTo(layout.x + layout.width, y); }
    context.strokeStyle = strong ? "rgba(247,222,145,.34)" : "rgba(247,222,145,.16)"; context.lineWidth = strong ? 1 : .65; context.stroke(); context.restore();
  }
  function drawRules(layout, alpha) {
    var map = state.compiled.map;
    context.save(); context.globalAlpha = alpha;
    for (var r = 0; r < map.rows; r++) for (var c = 0; c < map.cols; c++) {
      var i = r * map.cols + c, terrain = map.terrain[i] || {}, color = terrain.color || "#927d58";
      context.fillStyle = map.wall[i] ? tint(color, .48) : tint(color, .86);
      context.fillRect(layout.x + c * layout.cell, layout.y + r * layout.cell, layout.cell + .5, layout.cell + .5);
      if (map.wall[i]) {
        context.strokeStyle = "rgba(245,232,200,.20)"; context.lineWidth = 1;
        context.beginPath(); context.moveTo(layout.x + c * layout.cell, layout.y + (r + 1) * layout.cell);
        context.lineTo(layout.x + (c + 1) * layout.cell, layout.y + r * layout.cell); context.stroke();
      }
      if (map.h[i] > 0 && layout.cell >= 15) {
        context.fillStyle = "rgba(12,17,15,.74)"; context.font = "700 " + Math.max(7, Math.min(11, layout.cell * .28)) + "px ui-monospace";
        context.textAlign = "center"; context.fillText(Math.round(map.h[i]) + "′", layout.x + (c + .5) * layout.cell, layout.y + (r + .62) * layout.cell);
      }
    }
    context.restore();
  }
  function unitsForDisplay() {
    if (state.fight) return state.fight.units;
    if (!state.deployment || !state.deployment.draft || !state.deployment.draft.ok) return [];
    var defs = Core.PARTY.concat(Core.FOES), byId = {};
    defs.forEach(function (unit) { byId[unit.unit] = unit; });
    return Object.keys(state.deployment.draft.positions).map(function (unit) {
      return Object.assign({}, byId[unit], state.deployment.draft.positions[unit], { alive: true });
    });
  }
  function drawReachable(layout) {
    if (!state.fight || state.view !== "combat") return;
    var reachable = Core.reachableForActive(state.fight);
    context.save(); context.fillStyle = "rgba(118,173,142,.24)";
    Object.keys(reachable).forEach(function (cellKey) {
      var point = cellKey.split(",").map(Number);
      context.fillRect(layout.x + point[0] * layout.cell, layout.y + point[1] * layout.cell, layout.cell, layout.cell);
    });
    context.restore();
  }
  function drawTokens(layout) {
    var active = state.fight && Core.activeUnit(state.fight);
    unitsForDisplay().forEach(function (unit) {
      var x = layout.x + (unit.c + .5) * layout.cell, y = layout.y + (unit.r + .5) * layout.cell;
      context.save(); context.globalAlpha = unit.alive === false ? .35 : 1;
      context.fillStyle = unit.color; context.strokeStyle = active && active.unit === unit.unit ? "#fff0a8" : "rgba(7,10,9,.9)";
      context.lineWidth = active && active.unit === unit.unit ? Math.max(3, layout.cell * .12) : Math.max(1.5, layout.cell * .07);
      context.beginPath(); context.arc(x, y, Math.max(4, layout.cell * .34), 0, Math.PI * 2); context.fill(); context.stroke();
      context.fillStyle = "#111612"; context.font = "700 " + Math.max(7, layout.cell * .28) + "px ui-sans-serif"; context.textAlign = "center";
      context.fillText(unit.name.charAt(0), x, y + Math.max(2, layout.cell * .1)); context.restore();
    });
  }
  function renderBoard() {
    context.clearRect(0, 0, ui.board.width, ui.board.height);
    var gradient = context.createLinearGradient(0, 0, 0, ui.board.height); gradient.addColorStop(0, "#24322c"); gradient.addColorStop(1, "#080c0a");
    context.fillStyle = gradient; context.fillRect(0, 0, ui.board.width, ui.board.height);
    if (!state.compiled) return;
    var layout = state.layout = boardLayout();
    context.save(); context.beginPath(); context.rect(layout.x, layout.y, layout.width, layout.height); context.clip();
    if (state.view === "artwork") drawArtwork(layout, 1);
    else if (state.view === "rules") drawRules(layout, 1);
    else { drawArtwork(layout, .28); drawRules(layout, .76); drawReachable(layout); }
    drawGrid(layout, state.view !== "artwork");
    if (state.view === "combat" || state.deployment) drawTokens(layout);
    context.restore();
    context.strokeStyle = "rgba(212,180,95,.5)"; context.strokeRect(layout.x, layout.y, layout.width, layout.height);
  }
  function renderRoster() {
    var units = unitsForDisplay(), active = state.fight && Core.activeUnit(state.fight);
    ui.roster.replaceChildren();
    if (!units.length) { ui.roster.innerHTML = "<p>No combatants placed.</p>"; return; }
    units.slice().sort(function (a, b) { return state.fight ? b.initiative - a.initiative : a.side.localeCompare(b.side); }).forEach(function (unit) {
      var row = document.createElement("div"), swatch = document.createElement("i"), copy = document.createElement("span");
      var name = document.createElement("strong"), detail = document.createElement("small"), hp = document.createElement("em");
      row.className = "unit" + (active && active.unit === unit.unit ? " active" : "") + (unit.alive === false ? " dead" : "");
      swatch.style.background = unit.color; name.textContent = unit.name;
      detail.textContent = (unit.side === "pc" ? "Party" : "Enemy") + " · " + unit.c + "," + unit.r + (unit.initiative ? " · init " + unit.initiative : "");
      hp.textContent = unit.hp != null ? unit.hp + "/" + unit.hpMax : "placed"; copy.append(name, detail); row.append(swatch, copy, hp); ui.roster.appendChild(row);
    });
  }
  function renderFight() {
    var active = state.fight && Core.activeUnit(state.fight);
    ui.roundLabel.textContent = state.fight ? "Round " + state.fight.round : state.deployment ? "Placed" : "—";
    ui.turnTitle.textContent = active ? active.name + " is active" : state.deployment ? "Ready for initiative" : "Not in combat";
    ui.turnHelp.textContent = active ? "Click a green square to move, click an opponent to attack, or use the quick action below." : "Place combatants, then roll initiative.";
    ui.attackNearest.disabled = !active; ui.endTurn.disabled = !active;
    ui.feed.replaceChildren();
    (state.fight && state.fight.log || []).slice().reverse().forEach(function (message) {
      var row = document.createElement("p"); row.textContent = message; ui.feed.appendChild(row);
    });
    if (!state.fight) ui.feed.innerHTML = "<p>Movement, range, height, line of sight, cover, and attack results appear here.</p>";
  }
  function renderAll() { renderBoard(); renderRoster(); renderFight(); }
  function setView(view) {
    state.view = view;
    document.querySelectorAll("[data-view]").forEach(function (button) { button.classList.toggle("active", button.dataset.view === view); });
    renderBoard();
  }
  function placeCombatants() {
    state.deployment = Core.deployCombatants(state.compiled.map);
    if (!state.deployment.ok) { setStatus(state.deployment.errors.join(" ")); return; }
    state.fight = null; ui.startFight.disabled = false; setView("combat"); renderAll();
    setStatus("The current Forge deployment authority placed three party members and three raiders without stacking or entering blocked cells.");
  }
  function startFight() {
    state.fight = Core.createFight(state.compiled.map, state.deployment); setView("combat"); renderAll();
    setStatus("Local test fight started. Nothing here writes to a character sheet or shared session.");
  }
  function nearestEnemy() {
    var active = state.fight && Core.activeUnit(state.fight);
    var enemies = active && state.fight.units.filter(function (unit) { return unit.alive && unit.side !== active.side; }).sort(function (a, b) {
      return TG.range3d(state.fight.map, active, a) - TG.range3d(state.fight.map, active, b);
    });
    return enemies && (enemies.find(function (unit) {
      return TG.inRange(state.fight.map, active, unit, 90) && TG.losVerdict(state.fight.map, active, unit).canTarget;
    }) || enemies[0]);
  }
  function attack(target) {
    if (!target) return;
    var result = Core.resolveAttack(state.fight, target.unit);
    if (result.ok) state.fight = result.fight;
    setStatus(result.message); renderAll();
  }
  function canvasCell(event) {
    if (!state.layout) return null;
    var rect = ui.board.getBoundingClientRect(), x = (event.clientX - rect.left) * ui.board.width / rect.width, y = (event.clientY - rect.top) * ui.board.height / rect.height;
    var c = Math.floor((x - state.layout.x) / state.layout.cell), r = Math.floor((y - state.layout.y) / state.layout.cell);
    return c >= 0 && r >= 0 && c < state.compiled.map.cols && r < state.compiled.map.rows ? { c: c, r: r } : null;
  }

  ui.placeCombatants.addEventListener("click", placeCombatants);
  ui.startFight.addEventListener("click", startFight);
  ui.attackNearest.addEventListener("click", function () { attack(nearestEnemy()); });
  ui.endTurn.addEventListener("click", function () { if (!state.fight) return; state.fight = Core.endTurn(state.fight); setStatus(Core.activeUnit(state.fight).name + " is active."); renderAll(); });
  document.querySelectorAll("[data-view]").forEach(function (button) { button.addEventListener("click", function () { setView(button.dataset.view); }); });
  ui.board.addEventListener("click", function (event) {
    if (!state.fight || state.view !== "combat") return;
    var at = canvasCell(event); if (!at) return;
    var target = state.fight.units.find(function (unit) { return unit.alive && unit.c === at.c && unit.r === at.r; });
    if (target && target.side !== Core.activeUnit(state.fight).side) { attack(target); return; }
    if (target) { setStatus(target.name + " already occupies that square."); return; }
    var result = Core.moveActive(state.fight, at.c, at.r);
    if (result.ok) state.fight = result.fight;
    setStatus(result.message); renderAll();
  });

  try {
    if (!Core || !Core.reviewToMap || !window.ForgeDeployment || !TG || !window.ForgeCombatRules || !window.MapBridge) throw new Error("A required Forge authority did not load.");
    loadHandoff();
  } catch (error) {
    console.error(error); ui.fatal.textContent = "Artwork combat handoff could not start: " + error.message; ui.fatal.classList.add("on");
  }
})();
