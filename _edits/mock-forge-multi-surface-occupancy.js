(function () {
  "use strict";
  var Core = window.ForgeMultiSurfaceProof, ui = {};
  ["sameCellTitle","sameCellDetail","viewTitle","proofStage","board","heightPreview","status","selectedName","positionReadout","climbSpeed","movementHelp","occupancyCount","roster","sightList","sightResult","roundTrip","resetScene","snapshotReceipt","fatal"].forEach(function (id) {
    ui[id] = document.getElementById(id);
  });
  var boardContext = ui.board.getContext("2d"), heightContext = ui.heightPreview.getContext("2d");
  var state = { scene: null, units: null, selectedId: "mira", layer: "all", view: "split", boardHits: [], lastSightId: null };

  function setStatus(message) { ui.status.textContent = message; }
  function selectedUnit() { return state.units.find(function (unit) { return unit.id === state.selectedId; }); }
  function surfaceKind(surfaceId) {
    var surface = Core.surfaceById(state.scene, surfaceId);
    return surface && surface.kind === "ground" ? "ground" : "raised";
  }
  function visibleSurface(position) { return state.layer === "all" || surfaceKind(position.surfaceId) === state.layer; }
  function shortSurface(id) { return id.replace(/^surface-/, "").replace(/-/g, " "); }
  function reset() {
    state.scene = Core.createScene(); state.units = Core.createUnits(); state.selectedId = "mira"; state.lastSightId = null;
    ui.snapshotReceipt.textContent = "No snapshot round-trip yet.";
    setStatus("Mira and Vale legally occupy the same grid coordinate on different surfaces.");
    renderAll();
  }

  function boardLayout() {
    var margin = 54, width = ui.board.width - margin * 2, height = ui.board.height - margin * 2;
    var cell = Math.min(width / state.scene.cols, height / state.scene.rows);
    return { cell: cell, x: (ui.board.width - cell * state.scene.cols) / 2, y: (ui.board.height - cell * state.scene.rows) / 2 };
  }
  function roundedRect(context, x, y, w, h, radius) {
    context.beginPath(); context.roundRect(x, y, w, h, radius); context.closePath();
  }
  function drawDiamond(context, x, y, radius) {
    context.beginPath(); context.moveTo(x, y - radius); context.lineTo(x + radius, y); context.lineTo(x, y + radius); context.lineTo(x - radius, y); context.closePath();
  }
  function drawBoardSurface(layout) {
    var ctx = boardContext, cell = layout.cell;
    ctx.fillStyle = "#0b100e"; ctx.fillRect(0, 0, ui.board.width, ui.board.height);
    for (var r = 0; r < state.scene.rows; r++) for (var c = 0; c < state.scene.cols; c++) {
      var x = layout.x + c * cell, y = layout.y + r * cell;
      ctx.fillStyle = (c + r) % 2 ? "#655f4f" : "#716956"; ctx.fillRect(x, y, cell, cell);
      ctx.strokeStyle = "rgba(237,225,190,.15)"; ctx.strokeRect(x, y, cell, cell);
    }
    var bridge = Core.surfaceById(state.scene, "surface-market-bridge");
    bridge.cells.forEach(function (point) {
      var x = layout.x + point.c * cell, y = layout.y + point.r * cell;
      ctx.fillStyle = state.layer === "ground" ? "rgba(182,128,78,.18)" : "rgba(182,128,78,.88)"; ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
      ctx.strokeStyle = "rgba(245,207,133,.82)"; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
      ctx.strokeStyle = "rgba(82,48,26,.38)"; ctx.lineWidth = 1;
      for (var plank = 1; plank < 4; plank++) { ctx.beginPath(); ctx.moveTo(x + 3, y + plank * cell / 4); ctx.lineTo(x + cell - 3, y + plank * cell / 4); ctx.stroke(); }
    });
    var stairs = Core.surfaceById(state.scene, "surface-east-stairs");
    stairs.cells.forEach(function (point) {
      var x = layout.x + point.c * cell, y = layout.y + point.r * cell;
      ctx.fillStyle = "rgba(186,161,120,.84)"; ctx.fillRect(x + 3, y + 3, cell - 6, cell - 6);
      ctx.fillStyle = "#171d1a"; ctx.font = Math.max(9, cell * .18) + "px ui-monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(point.elevationFt + "′", x + cell / 2, y + cell / 2);
    });
    ctx.save(); ctx.strokeStyle = "rgba(247,223,167,.75)"; ctx.lineWidth = 3;
    [3,5].forEach(function (rowEdge) {
      ctx.beginPath(); ctx.moveTo(layout.x + 2 * cell, layout.y + rowEdge * cell); ctx.lineTo(layout.x + 10 * cell, layout.y + rowEdge * cell); ctx.stroke();
    });
    ctx.restore();
    ctx.fillStyle = "rgba(11,16,14,.82)"; roundedRect(ctx, layout.x + 2.2 * cell, layout.y + 3.15 * cell, cell * 2.7, cell * .52, 5); ctx.fill();
    ctx.fillStyle = "#f2d88e"; ctx.font = Math.max(9, cell * .18) + "px ui-monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("BRIDGE DECK · 20 FT", layout.x + 2.35 * cell, layout.y + 3.41 * cell);
  }
  function markerOffset(position) { return position.surfaceId === "surface-ground" ? -0.16 : 0.16; }
  function drawReach(layout) {
    var unit = selectedUnit(), reach = Core.reachable(state.scene, unit, state.units, unit.speedFt), ctx = boardContext;
    state.boardHits = [];
    Object.keys(reach).forEach(function (key) {
      var record = reach[key], position = record.position;
      if (!visibleSurface(position)) return;
      var offset = markerOffset(position), x = layout.x + (position.c + .5 + offset) * layout.cell, y = layout.y + (position.r + .5 - offset) * layout.cell;
      if (position.surfaceId === "surface-ground") {
        ctx.beginPath(); ctx.arc(x, y, layout.cell * .12, 0, Math.PI * 2); ctx.fillStyle = "rgba(116,171,153,.72)"; ctx.fill(); ctx.strokeStyle = "#b9e4d5"; ctx.stroke();
      } else {
        drawDiamond(ctx, x, y, layout.cell * .13); ctx.fillStyle = "rgba(212,180,95,.78)"; ctx.fill(); ctx.strokeStyle = "#f0d789"; ctx.stroke();
      }
      state.boardHits.push({ kind: "move", x: x, y: y, radius: layout.cell * .22, position: position, costFt: record.costFt });
    });
  }
  function drawUnits(layout) {
    var ctx = boardContext;
    state.units.forEach(function (unit) {
      var position = Core.unitPosition(unit); if (!visibleSurface(position)) return;
      var offset = markerOffset(position), x = layout.x + (unit.c + .5 + offset) * layout.cell, y = layout.y + (unit.r + .5 - offset) * layout.cell;
      ctx.beginPath(); ctx.arc(x, y, layout.cell * .22, 0, Math.PI * 2); ctx.fillStyle = unit.color; ctx.fill();
      ctx.lineWidth = unit.id === state.selectedId ? 4 : 2; ctx.strokeStyle = unit.id === state.selectedId ? "#f2d88e" : "rgba(17,22,18,.9)"; ctx.stroke();
      ctx.fillStyle = "#101411"; ctx.font = "700 " + Math.max(9, layout.cell * .19) + "px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(unit.name[0], x, y);
      ctx.fillStyle = "rgba(10,14,12,.9)"; roundedRect(ctx, x - layout.cell * .32, y + layout.cell * .25, layout.cell * .64, layout.cell * .22, 3); ctx.fill();
      ctx.fillStyle = "#eee7d6"; ctx.font = Math.max(7, layout.cell * .12) + "px ui-monospace"; ctx.fillText(unit.elevationFt + "′", x, y + layout.cell * .36);
      state.boardHits.push({ kind: "unit", x: x, y: y, radius: layout.cell * .28, unitId: unit.id });
    });
    var pair = state.units.filter(function (unit) { return unit.c === 5 && unit.r === 4; });
    if (pair.length === 2 && state.layer === "all") {
      var bx = layout.x + 5.5 * layout.cell, by = layout.y + 4.5 * layout.cell;
      ctx.strokeStyle = "#eee7d6"; ctx.lineWidth = 1; ctx.setLineDash([4,3]); ctx.beginPath(); ctx.moveTo(bx - .16 * layout.cell, by + .16 * layout.cell); ctx.lineTo(bx + .16 * layout.cell, by - .16 * layout.cell); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  function renderBoard() {
    var layout = boardLayout(); drawBoardSurface(layout); drawReach(layout); drawUnits(layout);
  }

  function isoPoint(c, r, elevationFt) {
    return { x: 472 + (c - r) * 31, y: 172 + (c + r) * 15.5 - elevationFt * 4.4 };
  }
  function polygon(ctx, points, fill, stroke) {
    ctx.beginPath(); points.forEach(function (point, index) { if (index) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y); }); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function isoTile(ctx, c, r, z, fill, alpha) {
    var a = isoPoint(c, r, z), b = isoPoint(c + 1, r, z), d = isoPoint(c, r + 1, z), e = isoPoint(c + 1, r + 1, z);
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; polygon(ctx, [a,b,e,d], fill, "rgba(240,226,190,.18)"); ctx.restore();
  }
  function isoPrism(ctx, c, r, bottomFt, topFt, fill, alpha) {
    var tb = isoPoint(c + 1, r, topFt), te = isoPoint(c + 1, r + 1, topFt), bb = isoPoint(c + 1, r, bottomFt), be = isoPoint(c + 1, r + 1, bottomFt);
    var tl = isoPoint(c, r + 1, topFt), bl = isoPoint(c, r + 1, bottomFt);
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    polygon(ctx, [tb,te,be,bb], "#795331", "rgba(21,16,11,.45)"); polygon(ctx, [tl,te,be,bl], "#674528", "rgba(21,16,11,.45)"); isoTile(ctx, c, r, topFt, fill, 1); ctx.restore();
  }
  function drawHeightPreview() {
    var ctx = heightContext; ctx.clearRect(0, 0, ui.heightPreview.width, ui.heightPreview.height); ctx.fillStyle = "#0b100e"; ctx.fillRect(0, 0, ui.heightPreview.width, ui.heightPreview.height);
    var cells = [];
    for (var r = 0; r < state.scene.rows; r++) for (var c = 0; c < state.scene.cols; c++) cells.push({ c: c, r: r });
    cells.sort(function (a, b) { return a.c + a.r - b.c - b.r; }).forEach(function (cell) { isoTile(ctx, cell.c, cell.r, 0, (cell.c + cell.r) % 2 ? "#625d4d" : "#706854", 1); });
    Core.surfaceById(state.scene, "surface-east-stairs").cells.slice().sort(function (a, b) { return a.c + a.r - b.c - b.r; }).forEach(function (cell) {
      isoPrism(ctx, cell.c, cell.r, 0, cell.elevationFt, "#baa178", .95);
    });
    var bridge = Core.surfaceById(state.scene, "surface-market-bridge");
    bridge.cells.slice().sort(function (a, b) { return a.c + a.r - b.c - b.r; }).forEach(function (cell) {
      isoPrism(ctx, cell.c, cell.r, 19, 20, "#b6804e", state.layer === "ground" ? .28 : .78);
    });
    ctx.save(); ctx.strokeStyle = "#e6c981"; ctx.lineWidth = 3;
    [[2,3,10,3],[2,5,10,5]].forEach(function (edge) { var a = isoPoint(edge[0],edge[1],22.5), b = isoPoint(edge[2],edge[3],22.5); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); });
    ctx.restore();
    state.units.slice().sort(function (a, b) { return a.c + a.r - b.c - b.r || a.elevationFt - b.elevationFt; }).forEach(function (unit) {
      if (!visibleSurface(Core.unitPosition(unit))) return;
      var base = isoPoint(unit.c + .5, unit.r + .5, unit.elevationFt), head = isoPoint(unit.c + .5, unit.r + .5, unit.elevationFt + 5);
      ctx.strokeStyle = unit.color; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(base.x,base.y); ctx.lineTo(head.x,head.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(head.x, head.y, unit.id === state.selectedId ? 9 : 7, 0, Math.PI * 2); ctx.fillStyle = unit.color; ctx.fill(); ctx.strokeStyle = unit.id === state.selectedId ? "#f2d88e" : "#101411"; ctx.lineWidth = unit.id === state.selectedId ? 4 : 2; ctx.stroke();
      ctx.fillStyle = "rgba(8,12,10,.9)"; roundedRect(ctx, head.x + 8, head.y - 13, 112, 25, 4); ctx.fill();
      ctx.fillStyle = "#eee7d6"; ctx.font = "11px system-ui"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(unit.name + " · " + unit.elevationFt + " ft", head.x + 15, head.y);
    });
    ctx.strokeStyle = "rgba(238,231,214,.72)"; ctx.fillStyle = "#eee7d6"; ctx.font = "10px ui-monospace"; ctx.textAlign = "right";
    for (var ft = 0; ft <= 25; ft += 5) { var y = 600 - ft * 12; ctx.beginPath(); ctx.moveTo(70,y); ctx.lineTo(88,y); ctx.stroke(); ctx.fillText(ft + " ft", 64, y); }
    ctx.beginPath(); ctx.moveTo(80,600); ctx.lineTo(80,300); ctx.stroke();
  }

  function renderSelected() {
    var unit = selectedUnit(), position = Core.unitPosition(unit), reach = Core.reachable(state.scene, unit, state.units, unit.speedFt);
    ui.selectedName.textContent = unit.name;
    ui.positionReadout.innerHTML = [
      ["Grid column", unit.c + ", " + unit.r], ["Height", unit.elevationFt + " ft"],
      ["Surface ID", shortSurface(unit.surfaceId)], ["Position key", Core.positionKey(position)]
    ].map(function (row) { return "<div><span>" + row[0] + "</span><b>" + row[1] + "</b></div>"; }).join("");
    ui.climbSpeed.checked = unit.climbSpeedFt > 0;
    ui.movementHelp.textContent = unit.climbSpeedFt > 0
      ? Object.keys(reach).length + " reachable surface positions. Climbing uses the creature's own speed."
      : Object.keys(reach).length + " reachable surface positions. Ordinary climbing costs two feet for every foot climbed.";
  }
  function renderRoster() {
    ui.roster.innerHTML = state.units.map(function (unit) {
      return "<button type=\"button\" class=\"unit " + (unit.id === state.selectedId ? "active" : "") + "\" data-unit=\"" + unit.id + "\"><i style=\"background:" + unit.color + "\"></i><span><strong>" + unit.name + "</strong><small>" + shortSurface(unit.surfaceId) + " · cell " + unit.c + "," + unit.r + "</small></span><em>" + unit.elevationFt + "′</em></button>";
    }).join("");
    ui.roster.querySelectorAll("[data-unit]").forEach(function (button) { button.addEventListener("click", function () { selectUnit(button.dataset.unit); }); });
    ui.occupancyCount.textContent = Core.occupiedPositions(state.units).size + " surface positions";
  }
  function renderSight() {
    var source = selectedUnit();
    ui.sightList.innerHTML = state.units.filter(function (unit) { return unit.id !== source.id; }).map(function (unit) {
      return "<button type=\"button\" data-sight=\"" + unit.id + "\">" + unit.name + " · " + unit.elevationFt + "′</button>";
    }).join("");
    ui.sightList.querySelectorAll("[data-sight]").forEach(function (button) { button.addEventListener("click", function () { inspectSight(button.dataset.sight); }); });
    if (state.lastSightId && state.lastSightId !== state.selectedId && state.units.some(function (unit) { return unit.id === state.lastSightId; })) inspectSight(state.lastSightId, true);
    else ui.sightResult.textContent = "Choose another combatant to test true 3D range, deck occlusion, and rail cover.";
  }
  function inspectSight(targetId, quiet) {
    var source = selectedUnit(), target = state.units.find(function (unit) { return unit.id === targetId; });
    if (!target) return; state.lastSightId = targetId;
    var verdict = Core.sightVerdict(state.scene, source, target), culprit = Object.keys(verdict.culprits).join(", ") || "none";
    var coverLabel = verdict.cover === "none" ? "clear · no cover" : verdict.cover + " cover";
    ui.sightResult.innerHTML = "<b>" + source.name + " → " + target.name + ": " + (verdict.canTarget ? coverLabel : "total cover") + "</b><br>" + verdict.distanceFt.toFixed(1) + " ft in 3D · " + verdict.blockedSamples + "/" + verdict.samples + " body samples blocked · culprit: " + culprit + ".";
    if (!quiet) setStatus(source.name + " checks " + target.name + ": " + (verdict.canTarget ? coverLabel : "the bridge blocks the shot") + ".");
  }
  function renderSameCell() {
    var pair = state.units.filter(function (unit) { return unit.c === 5 && unit.r === 4; });
    ui.sameCellTitle.textContent = pair.length === 2 ? "Two creatures share 5,4" : "The opening overlap has moved";
    ui.sameCellDetail.textContent = pair.length === 2 ? pair[0].name + " is at " + pair[0].elevationFt + " ft. " + pair[1].name + " is at " + pair[1].elevationFt + " ft." : "Reset the scene to restore the above/below demonstration.";
  }
  function renderAll() { renderBoard(); drawHeightPreview(); renderSelected(); renderRoster(); renderSight(); renderSameCell(); }
  function selectUnit(id) {
    if (!state.units.some(function (unit) { return unit.id === id; })) return;
    state.selectedId = id; state.lastSightId = null; renderAll(); setStatus(selectedUnit().name + " selected on " + shortSurface(selectedUnit().surfaceId) + " at " + selectedUnit().elevationFt + " ft.");
  }
  function moveSelected(position) {
    var result = Core.moveUnit(state.scene, state.units, state.selectedId, position, selectedUnit().speedFt);
    if (result.ok) state.units = result.units;
    setStatus(result.message); renderAll();
  }
  function canvasPoint(event, canvas) {
    var rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  }
  function setView(view) {
    state.view = view; ui.proofStage.className = "proof-stage " + view;
    ui.viewTitle.textContent = view === "board" ? "Surface-aware tactical board" : view === "height" ? "Truthful height preview" : "Surface board + height preview";
    document.querySelectorAll("[data-view]").forEach(function (button) { button.classList.toggle("active", button.dataset.view === view); });
    requestAnimationFrame(renderAll);
  }
  function setLayer(layer) {
    state.layer = layer; document.querySelectorAll("[data-layer]").forEach(function (button) { button.classList.toggle("active", button.dataset.layer === layer); }); renderAll();
  }

  ui.board.addEventListener("click", function (event) {
    var point = canvasPoint(event, ui.board), hits = state.boardHits.filter(function (hit) { return Math.hypot(point.x - hit.x, point.y - hit.y) <= hit.radius; });
    var unitHit = hits.find(function (hit) { return hit.kind === "unit"; }), moveHit = hits.find(function (hit) { return hit.kind === "move"; });
    if (unitHit) selectUnit(unitHit.unitId); else if (moveHit) moveSelected(moveHit.position);
  });
  ui.climbSpeed.addEventListener("change", function () { selectedUnit().climbSpeedFt = ui.climbSpeed.checked ? 30 : 0; renderAll(); setStatus(selectedUnit().name + (ui.climbSpeed.checked ? " now uses a climbing speed." : " now pays ordinary doubled climbing cost.")); });
  ui.roundTrip.addEventListener("click", function () {
    var serialized = JSON.stringify(Core.createSnapshot(state.scene, state.units)), restored = Core.restoreSnapshot(JSON.parse(serialized));
    state.scene = restored.scene; state.units = restored.units; ui.snapshotReceipt.textContent = "Reloaded " + state.units.length + " exact surface positions from " + serialized.length + " bytes. No floor was inferred.";
    setStatus("Snapshot round-trip preserved both creatures at cell 5,4 on different surface IDs."); renderAll();
  });
  ui.resetScene.addEventListener("click", reset);
  document.querySelectorAll("[data-view]").forEach(function (button) { button.addEventListener("click", function () { setView(button.dataset.view); }); });
  document.querySelectorAll("[data-layer]").forEach(function (button) { button.addEventListener("click", function () { setLayer(button.dataset.layer); }); });
  window.addEventListener("resize", function () { requestAnimationFrame(renderAll); });

  try {
    if (!Core || !Core.createScene) throw new Error("The multi-surface proof core did not load.");
    reset();
  } catch (error) {
    console.error(error); ui.fatal.textContent = "Multi-surface proof could not start: " + error.message; ui.fatal.classList.add("on");
  }
})();
