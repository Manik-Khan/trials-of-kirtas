(function () {
  "use strict";
  var Core = window.ForgePortalStairsProof;
  var ui = {
    directions: document.getElementById("directions"), routes: document.getElementById("routes"),
    receipt: document.getElementById("receipt"), sceneTitle: document.getElementById("sceneTitle"),
    plan: document.getElementById("plan"), height: document.getElementById("height"),
    auditGrid: document.getElementById("auditGrid"), selectedDetail: document.getElementById("selectedDetail"),
    showAll: document.getElementById("showAll")
  };
  var state = { seed: 1847, candidate: 0, selected: null };
  var palette = { 0: "#5f625a", 5: "#7d6e51", 10: "#89634f", 15: "#765264", 20: "#60547a" };

  function selectedConnection(scene) {
    return state.selected ? scene.connections.find(function (connection) { return connection.id === state.selected; }) : null;
  }
  function isHighlighted(connection) { return !state.selected || connection.id === state.selected; }
  function fit(canvas, grid, pad) {
    return Math.min((canvas.width - pad * 2) / grid.cols, (canvas.height - pad * 2) / grid.rows);
  }
  function lineForSide(ctx, x, y, size, side) {
    if (side === "N") { ctx.moveTo(x, y); ctx.lineTo(x + size, y); }
    if (side === "E") { ctx.moveTo(x + size, y); ctx.lineTo(x + size, y + size); }
    if (side === "S") { ctx.moveTo(x, y + size); ctx.lineTo(x + size, y + size); }
    if (side === "W") { ctx.moveTo(x, y); ctx.lineTo(x, y + size); }
  }
  function renderPlan(scene) {
    var ctx = ui.plan.getContext("2d"), pad = 28, size = fit(ui.plan, scene.grid, pad), ox = (ui.plan.width - scene.grid.cols * size) / 2;
    var oy = (ui.plan.height - scene.grid.rows * size) / 2;
    ctx.clearRect(0, 0, ui.plan.width, ui.plan.height); ctx.fillStyle = "#09100e"; ctx.fillRect(0, 0, ui.plan.width, ui.plan.height);
    ctx.strokeStyle = "rgba(130,145,134,.11)"; ctx.lineWidth = 1;
    for (var c = 0; c <= scene.grid.cols; c++) { ctx.beginPath(); ctx.moveTo(ox + c * size, oy); ctx.lineTo(ox + c * size, oy + scene.grid.rows * size); ctx.stroke(); }
    for (var r = 0; r <= scene.grid.rows; r++) { ctx.beginPath(); ctx.moveTo(ox, oy + r * size); ctx.lineTo(ox + scene.grid.cols * size, oy + r * size); ctx.stroke(); }
    scene.rooms.forEach(function (room) {
      ctx.fillStyle = palette[room.elevationFt] || "#665c56";
      ctx.fillRect(ox + room.c * size, oy + room.r * size, room.w * size, room.h * size);
      ctx.fillStyle = "#eee2c7"; ctx.font = "600 " + Math.max(10, size * .42) + "px Georgia"; ctx.textAlign = "center";
      ctx.fillText(room.label, ox + (room.c + room.w / 2) * size, oy + (room.r + room.h / 2) * size - 2);
      ctx.fillStyle = "#d5b66c"; ctx.font = Math.max(9, size * .34) + "px Arial";
      ctx.fillText(room.elevationFt + " ft", ox + (room.c + room.w / 2) * size, oy + (room.r + room.h / 2) * size + 13);
    });
    scene.connections.forEach(function (connection) {
      ctx.globalAlpha = isHighlighted(connection) ? 1 : .13;
      connection.path.forEach(function (cell) {
        ctx.fillStyle = connection.kind === "stairs" && connection.stairPath.some(function (stair) { return stair.c === cell.c && stair.r === cell.r; }) ? "#d0aa59" : "#57988f";
        ctx.fillRect(ox + cell.c * size + size * .18, oy + cell.r * size + size * .18, size * .64, size * .64);
      });
      if (connection.kind === "stairs") {
        ctx.strokeStyle = "#f3df9c"; ctx.lineWidth = 2;
        connection.stairPath.forEach(function (cell) {
          var x = ox + cell.c * size, y = oy + cell.r * size;
          ctx.beginPath(); ctx.moveTo(x + size * .23, y + size * .5); ctx.lineTo(x + size * .77, y + size * .5); ctx.stroke();
        });
      }
      ctx.globalAlpha = 1;
    });
    ctx.strokeStyle = "#b3ab98"; ctx.lineWidth = Math.max(2, size * .12); ctx.beginPath();
    scene.walls.forEach(function (wall) { lineForSide(ctx, ox + wall.c * size, oy + wall.r * size, size, wall.side); }); ctx.stroke();
    scene.connections.forEach(function (connection) {
      ctx.globalAlpha = isHighlighted(connection) ? 1 : .2;
      connection.portals.forEach(function (portal) {
        var x = ox + portal.c * size, y = oy + portal.r * size;
        ctx.strokeStyle = "#7ed2c5"; ctx.lineWidth = Math.max(3, size * .22); ctx.beginPath(); lineForSide(ctx, x, y, size, portal.side); ctx.stroke();
      });
      ctx.globalAlpha = 1;
    });
  }
  function isoPoint(scene, c, r, elevationFt) {
    var scale = Math.min(26, 690 / (scene.grid.cols + scene.grid.rows));
    return { x: ui.height.width / 2 + (c - r) * scale, y: 105 + (c + r) * scale * .46 - elevationFt * 3.3, scale: scale };
  }
  function tile(ctx, scene, c, r, elevationFt, color, alpha) {
    var p = isoPoint(scene, c, r, elevationFt), s = p.scale, h = s * .46;
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + s, p.y + h); ctx.lineTo(p.x, p.y + h * 2); ctx.lineTo(p.x - s, p.y + h); ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = "rgba(245,229,197,.16)"; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
  }
  function renderHeight(scene) {
    var ctx = ui.height.getContext("2d"); ctx.clearRect(0, 0, ui.height.width, ui.height.height); ctx.fillStyle = "#09100e"; ctx.fillRect(0, 0, ui.height.width, ui.height.height);
    var entries = Object.keys(scene.floor).map(function (key) { var parts = key.split(",").map(Number); return { c: parts[0], r: parts[1], elevationFt: scene.floor[key] }; });
    entries.sort(function (a, b) { return (a.c + a.r) - (b.c + b.r); });
    entries.forEach(function (cell) {
      var owner = scene.roomLookup[Core.cellKey(cell.c, cell.r)], connection = scene.connections.find(function (item) { return item.path.some(function (part) { return part.c === cell.c && part.r === cell.r; }); });
      var active = !connection || isHighlighted(connection), color = owner ? (palette[cell.elevationFt] || "#665c56") : connection && connection.kind === "stairs" ? "#c9a251" : "#4b8079";
      tile(ctx, scene, cell.c, cell.r, cell.elevationFt, color, active ? 1 : .12);
    });
    scene.connections.forEach(function (connection) {
      if (!isHighlighted(connection)) return;
      connection.stairPath.forEach(function (cell) {
        var p = isoPoint(scene, cell.c, cell.r, cell.elevationFt), s = p.scale;
        ctx.strokeStyle = "#f2dfa2"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - s * .55, p.y + s * .49); ctx.lineTo(p.x + s * .55, p.y + s * .49); ctx.stroke();
      });
    });
    scene.walls.forEach(function (wall) {
      var p = isoPoint(scene, wall.c, wall.r, wall.elevationFt), s = p.scale, h = s * .46, lift = 18;
      ctx.strokeStyle = "rgba(190,184,169,.62)"; ctx.lineWidth = 3;
      ctx.beginPath();
      if (wall.side === "N") { ctx.moveTo(p.x - s, p.y + h); ctx.lineTo(p.x, p.y); }
      if (wall.side === "E") { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + s, p.y + h); }
      if (wall.side === "S") { ctx.moveTo(p.x - s, p.y + h); ctx.lineTo(p.x, p.y + h * 2); }
      if (wall.side === "W") { ctx.moveTo(p.x, p.y + h * 2); ctx.lineTo(p.x + s, p.y + h); }
      ctx.stroke();
      ctx.globalAlpha = .22; ctx.translate(0, -lift); ctx.stroke(); ctx.translate(0, lift); ctx.globalAlpha = 1;
    });
  }
  function renderControls(scene) {
    var labels = ["Processional", "Vault", "Warren"];
    ui.directions.innerHTML = labels.map(function (label, index) {
      return '<button type="button" data-candidate="' + index + '" class="' + (state.candidate === index ? "active" : "") + '"><b>' + label + '</b><small>' + (index === 0 ? "A deliberate climb" : index === 1 ? "A loop with a raised hub" : "Branches at several heights") + '</small></button>';
    }).join("");
    ui.routes.innerHTML = scene.connections.map(function (connection) {
      var a = scene.rooms.find(function (room) { return room.id === connection.roomA; });
      var b = scene.rooms.find(function (room) { return room.id === connection.roomB; });
      return '<button type="button" data-route="' + connection.id + '" class="' + (state.selected === connection.id ? "active" : "") + '"><b>' + a.label + ' → ' + b.label + '</b><small>' + (connection.kind === "stairs" ? connection.lowFt + ' → ' + connection.highFt + ' ft · ' + connection.tiers + ' stair tier' + (connection.tiers === 1 ? "" : "s") : 'level passage') + '</small></button>';
    }).join("");
    ui.directions.querySelectorAll("button").forEach(function (button) { button.onclick = function () { state.candidate = Number(button.dataset.candidate); state.selected = null; render(); }; });
    ui.routes.querySelectorAll("button").forEach(function (button) { button.onclick = function () { state.selected = button.dataset.route; render(); }; });
  }
  function renderAudit(scene) {
    var stairs = scene.connections.filter(function (connection) { return connection.kind === "stairs"; });
    ui.auditGrid.innerHTML = [
      [scene.rooms.length, "rooms"], [scene.portals.length, "open portals"], [stairs.length, "stair runs"], [scene.audit.tactical.reachable + "/" + scene.audit.tactical.open, "reachable cells"]
    ].map(function (item) { return "<div><b>" + item[0] + "</b><span>" + item[1] + "</span></div>"; }).join("");
    var connection = selectedConnection(scene);
    ui.selectedDetail.innerHTML = connection
      ? "<b>" + (connection.kind === "stairs" ? "Portal-owned stair" : "Portal-owned passage") + "</b><p>Low landing: " + connection.lowLanding.c + "," + connection.lowLanding.r + " at " + connection.lowFt + " ft.<br>High entrance: " + connection.highLanding.c + "," + connection.highLanding.r + " at " + connection.highFt + " ft.<br>No wall segment crosses either entrance.</p>"
      : "<b>All connections</b><p>Select any route on the left to isolate its entrances, corridor, protected landing, and stair runway.</p>";
  }
  function render() {
    var scene = Core.generate(state.seed, state.candidate);
    ui.sceneTitle.textContent = scene.label + " · Seed " + scene.seed;
    ui.receipt.textContent = scene.audit.ok ? "Accepted · " + scene.connections.length + " routes · " + scene.fingerprint : "Rejected";
    renderControls(scene); renderAudit(scene); renderPlan(scene); renderHeight(scene);
  }
  ui.showAll.onclick = function () { state.selected = null; render(); };
  render();
})();
