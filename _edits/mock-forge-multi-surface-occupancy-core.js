/* Stable walk-surface identity proof.
   Browser: window.ForgeMultiSurfaceProof. Node: module.exports. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeMultiSurfaceProof = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

  function copy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function cellKey(c, r) { return Number(c) + "," + Number(r); }
  function positionKey(position) { return cellKey(position.c, position.r) + "@" + position.surfaceId; }
  function samePosition(a, b) {
    return !!a && !!b && a.c === b.c && a.r === b.r && a.surfaceId === b.surfaceId;
  }
  function inBounds(scene, c, r) { return c >= 0 && r >= 0 && c < scene.cols && r < scene.rows; }
  function surfaceById(scene, id) {
    return (scene.surfaces || []).find(function (surface) { return surface.id === id; }) || null;
  }
  function surfaceCell(surface, c, r) {
    return surface && (surface.cells || []).find(function (cell) { return cell.c === c && cell.r === r; }) || null;
  }
  function surfacePosition(scene, surfaceId, c, r) {
    var surface = surfaceById(scene, surfaceId), cell = surfaceCell(surface, c, r);
    if (!surface || !cell || surface.walkable === false || cell.walkable === false) return null;
    return { c: c, r: r, surfaceId: surfaceId, elevationFt: Number(cell.elevationFt != null ? cell.elevationFt : surface.elevationFt) || 0 };
  }
  function surfacesAt(scene, c, r) {
    return (scene.surfaces || []).map(function (surface) {
      return surfacePosition(scene, surface.id, c, r);
    }).filter(Boolean).sort(function (a, b) { return a.elevationFt - b.elevationFt; });
  }
  function unitPosition(unit) {
    return { c: unit.c, r: unit.r, surfaceId: unit.surfaceId, elevationFt: Number(unit.elevationFt) || 0 };
  }
  function positionExists(scene, position) {
    var found = surfacePosition(scene, position.surfaceId, position.c, position.r);
    return !!found && Math.abs(found.elevationFt - Number(position.elevationFt || 0)) < 1e-6;
  }
  function occupiedPositions(units, exceptId) {
    var occupied = new Set();
    (units || []).forEach(function (unit) {
      if (unit.alive !== false && unit.id !== exceptId) occupied.add(positionKey(unitPosition(unit)));
    });
    return occupied;
  }

  function groundCells(cols, rows) {
    var cells = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      if (c === 2 && r === 2 || c === 9 && r >= 5 && r <= 7) continue;
      cells.push({ c: c, r: r, elevationFt: 0, walkable: true });
    }
    return cells;
  }
  function bridgeCells() {
    var cells = [];
    for (var r = 3; r <= 4; r++) for (var c = 2; c <= 9; c++) {
      cells.push({ c: c, r: r, elevationFt: 20, walkable: true });
    }
    return cells;
  }
  function createScene() {
    var scene = {
      schema: "forge-multi-surface-scene/v1", version: 1, cols: 12, rows: 9, cellFt: 5,
      name: "Market bridge crossing",
      surfaces: [
        { id: "surface-ground", kind: "ground", label: "Market floor", elevationFt: 0, walkable: true, color: "#7d745d", cells: groundCells(12, 9) },
        { id: "surface-market-bridge", kind: "bridge-deck", label: "Timber bridge", elevationFt: 20, walkable: true, color: "#b6804e", deckThicknessFt: 1, clearanceFt: 19, cells: bridgeCells() },
        { id: "surface-east-stairs", kind: "stairs", label: "East stairs", walkable: true, color: "#baa178", cells: [
          { c: 9, r: 5, elevationFt: 15 }, { c: 9, r: 6, elevationFt: 10 }, { c: 9, r: 7, elevationFt: 5 }
        ] }
      ],
      connectors: [
        { id: "connector-east-stairs", kind: "stairs", state: "open", oneWay: false, requires: { climb: false }, path: [
          { c: 9, r: 4, surfaceId: "surface-market-bridge", elevationFt: 20 },
          { c: 9, r: 5, surfaceId: "surface-east-stairs", elevationFt: 15 },
          { c: 9, r: 6, surfaceId: "surface-east-stairs", elevationFt: 10 },
          { c: 9, r: 7, surfaceId: "surface-east-stairs", elevationFt: 5 },
          { c: 9, r: 8, surfaceId: "surface-ground", elevationFt: 0 }
        ] },
        { id: "connector-west-climb", kind: "climb", state: "open", oneWay: false, requires: { climb: true }, path: [
          { c: 2, r: 4, surfaceId: "surface-ground", elevationFt: 0 },
          { c: 2, r: 4, surfaceId: "surface-market-bridge", elevationFt: 20 }
        ] }
      ],
      rails: [
        { id: "rail-north", surfaceId: "surface-market-bridge", edge: "N", row: 3, fromC: 2, toC: 9, bottomFt: 20, heightFt: 2.5 },
        { id: "rail-south", surfaceId: "surface-market-bridge", edge: "S", row: 4, fromC: 2, toC: 9, bottomFt: 20, heightFt: 2.5 }
      ],
      volumes: [
        { id: "support-west", kind: "bridge-support", c: 2, r: 2, bottomFt: 0, topFt: 20, blocksMovement: true, blocksVision: true },
        { id: "support-east", kind: "bridge-support", c: 9, r: 5, bottomFt: 0, topFt: 15, blocksMovement: false, blocksVision: false }
      ],
      meta: { authority: "isolated-proof", positionContract: "{c,r,surfaceId,elevationFt}", simultaneousSurfaces: true }
    };
    return scene;
  }
  function createUnits() {
    return [
      { id: "mira", name: "Mira", side: "party", color: "#76ad9b", c: 5, r: 4, surfaceId: "surface-ground", elevationFt: 0, speedFt: 30, climbSpeedFt: 0, alive: true },
      { id: "vale", name: "Vale", side: "party", color: "#d7b85d", c: 5, r: 4, surfaceId: "surface-market-bridge", elevationFt: 20, speedFt: 30, climbSpeedFt: 0, alive: true },
      { id: "raider-ground", name: "Ground raider", side: "foe", color: "#bd7068", c: 8, r: 6, surfaceId: "surface-ground", elevationFt: 0, speedFt: 30, climbSpeedFt: 0, alive: true },
      { id: "raider-deck", name: "Bridge sentry", side: "foe", color: "#c88770", c: 8, r: 3, surfaceId: "surface-market-bridge", elevationFt: 20, speedFt: 30, climbSpeedFt: 0, alive: true }
    ];
  }

  function connectorSegments(scene) {
    var segments = [];
    (scene.connectors || []).forEach(function (connector) {
      if (connector.state === "closed" || connector.state === "broken") return;
      var path = connector.path || [];
      for (var i = 0; i < path.length - 1; i++) {
        segments.push({ connector: connector, from: path[i], to: path[i + 1] });
        if (!connector.oneWay) segments.push({ connector: connector, from: path[i + 1], to: path[i] });
      }
    });
    return segments;
  }
  function transitionCostFt(unit, from, to, connector) {
    var horizontal = Math.max(Math.abs(to.c - from.c), Math.abs(to.r - from.r)) * 5;
    var vertical = Math.abs(Number(to.elevationFt) - Number(from.elevationFt));
    if (connector && connector.kind === "climb") {
      return unit.climbSpeedFt > 0 ? Math.max(horizontal, vertical) : Math.max(horizontal, vertical) * 2;
    }
    return Math.max(5, horizontal, vertical);
  }
  function sameSurfaceNeighbors(scene, position) {
    var surface = surfaceById(scene, position.surfaceId), out = [];
    if (!surface) return out;
    DIRS.forEach(function (step) {
      var next = surfacePosition(scene, surface.id, position.c + step[0], position.r + step[1]);
      if (!next || Math.abs(next.elevationFt - position.elevationFt) > 5) return;
      out.push({ position: next, costFt: 5, via: "surface" });
    });
    return out;
  }
  function connectorNeighbors(scene, position, unit) {
    return connectorSegments(scene).filter(function (segment) {
      return samePosition(segment.from, position);
    }).map(function (segment) {
      return {
        position: copy(segment.to),
        costFt: transitionCostFt(unit, segment.from, segment.to, segment.connector),
        via: segment.connector.kind,
        connectorId: segment.connector.id
      };
    });
  }
  function neighbors(scene, position, unit) {
    return sameSurfaceNeighbors(scene, position).concat(connectorNeighbors(scene, position, unit));
  }
  function reachable(scene, unit, units, budgetFt) {
    budgetFt = budgetFt == null ? Number(unit.speedFt || 30) : Number(budgetFt);
    var start = unitPosition(unit), startKey = positionKey(start), occupied = occupiedPositions(units, unit.id);
    var seen = {}; seen[startKey] = { costFt: 0, from: null, position: start, via: "start" };
    var queue = [{ key: startKey, costFt: 0 }];
    while (queue.length) {
      queue.sort(function (a, b) { return a.costFt - b.costFt; });
      var current = queue.shift(), record = seen[current.key];
      if (!record || current.costFt !== record.costFt) continue;
      neighbors(scene, record.position, unit).forEach(function (next) {
        var key = positionKey(next.position), cost = record.costFt + next.costFt;
        if (cost > budgetFt || occupied.has(key)) return;
        if (!seen[key] || cost < seen[key].costFt) {
          seen[key] = { costFt: cost, from: current.key, position: copy(next.position), via: next.via, connectorId: next.connectorId || null };
          queue.push({ key: key, costFt: cost });
        }
      });
    }
    delete seen[startKey];
    return seen;
  }
  function pathTo(reach, unit, destination) {
    var path = [], key = positionKey(destination), home = positionKey(unitPosition(unit));
    while (key && key !== home) {
      var record = reach[key];
      if (!record) return [];
      path.unshift({ position: copy(record.position), costFt: record.costFt, via: record.via, connectorId: record.connectorId });
      key = record.from;
    }
    return path;
  }
  function moveUnit(scene, units, unitId, destination, budgetFt) {
    var next = copy(units), unit = next.find(function (candidate) { return candidate.id === unitId; });
    if (!unit) return { ok: false, units: units, message: "That combatant is not present." };
    var reach = reachable(scene, unit, next, budgetFt), record = reach[positionKey(destination)];
    if (!record) return { ok: false, units: units, message: "That walk surface is not reachable within this move." };
    var path = pathTo(reach, unit, destination);
    unit.c = destination.c; unit.r = destination.r; unit.surfaceId = destination.surfaceId; unit.elevationFt = destination.elevationFt;
    return { ok: true, units: next, path: path, costFt: record.costFt, message: unit.name + " moved " + record.costFt + " ft to " + destination.surfaceId + " at " + destination.elevationFt + " ft." };
  }

  function range3d(a, b) {
    var horizontalFt = Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r)) * 5;
    var verticalFt = Math.abs(Number(a.elevationFt || 0) - Number(b.elevationFt || 0));
    return Math.hypot(horizontalFt, verticalFt);
  }
  function pointInCell(point, cell) {
    return point.x >= cell.c && point.x <= cell.c + 1 && point.y >= cell.r && point.y <= cell.r + 1;
  }
  function railAtPoint(scene, point) {
    for (var i = 0; i < (scene.rails || []).length; i++) {
      var rail = scene.rails[i], nearEdge = rail.edge === "N" ? Math.abs(point.y - rail.row) <= 0.055 : Math.abs(point.y - (rail.row + 1)) <= 0.055;
      if (nearEdge && point.x >= rail.fromC && point.x <= rail.toC + 1 && point.z >= rail.bottomFt && point.z <= rail.bottomFt + rail.heightFt) return rail;
    }
    return null;
  }
  function blockerAtPoint(scene, point) {
    for (var i = 0; i < (scene.volumes || []).length; i++) {
      var volume = scene.volumes[i];
      if (volume.blocksVision && pointInCell(point, volume) && point.z >= volume.bottomFt && point.z <= volume.topFt) return { id: volume.id, kind: volume.kind };
    }
    var bridge = surfaceById(scene, "surface-market-bridge");
    if (bridge) {
      for (var j = 0; j < bridge.cells.length; j++) {
        var cell = bridge.cells[j], top = Number(cell.elevationFt), bottom = top - Number(bridge.deckThicknessFt || 1);
        if (pointInCell(point, cell) && point.z >= bottom && point.z <= top) return { id: bridge.id, kind: "bridge-deck" };
      }
    }
    var rail = railAtPoint(scene, point);
    return rail ? { id: rail.id, kind: "bridge-rail" } : null;
  }
  function rayBlocker(scene, start, end) {
    var steps = 180;
    for (var i = 2; i < steps - 2; i++) {
      var t = i / steps, point = {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        z: start.z + (end.z - start.z) * t
      };
      var blocker = blockerAtPoint(scene, point);
      if (blocker) return blocker;
    }
    return null;
  }
  function sightVerdict(scene, attacker, target) {
    var start = { x: attacker.c + 0.5, y: attacker.r + 0.5, z: Number(attacker.elevationFt || 0) + 5 };
    var levels = [0.75, 2.75, 4.75], blocked = [], culprits = {};
    levels.forEach(function (level) {
      var end = { x: target.c + 0.5, y: target.r + 0.5, z: Number(target.elevationFt || 0) + level };
      var blocker = rayBlocker(scene, start, end); blocked.push(blocker);
      if (blocker) culprits[blocker.kind] = (culprits[blocker.kind] || 0) + 1;
    });
    var count = blocked.filter(Boolean).length;
    return {
      canTarget: count < levels.length,
      cover: count === 0 ? "none" : count === 1 ? "half" : count === 2 ? "three-quarters" : "total",
      acBonus: count === 0 ? 0 : count === 1 ? 2 : count === 2 ? 5 : Infinity,
      blockedSamples: count,
      samples: levels.length,
      culprits: culprits,
      distanceFt: range3d(attacker, target)
    };
  }

  function validateScene(scene, units) {
    var errors = [], surfaceIds = new Set(), connectorIds = new Set(), positions = new Set();
    if (!scene || scene.schema !== "forge-multi-surface-scene/v1") errors.push("wrong scene schema");
    (scene && scene.surfaces || []).forEach(function (surface) {
      if (!surface.id || surfaceIds.has(surface.id)) errors.push("duplicate or missing surface ID");
      surfaceIds.add(surface.id);
      (surface.cells || []).forEach(function (cell) { if (!inBounds(scene, cell.c, cell.r)) errors.push("surface cell out of bounds"); });
    });
    (scene && scene.connectors || []).forEach(function (connector) {
      if (!connector.id || connectorIds.has(connector.id)) errors.push("duplicate or missing connector ID");
      connectorIds.add(connector.id);
      (connector.path || []).forEach(function (position) {
        if (!surfaceIds.has(position.surfaceId) || !positionExists(scene, position)) errors.push("connector references a missing surface position");
      });
    });
    (units || []).forEach(function (unit) {
      var position = unitPosition(unit), key = positionKey(position);
      if (!positionExists(scene, position)) errors.push("unit is not on a walk surface: " + unit.id);
      if (positions.has(key)) errors.push("two units occupy " + key);
      positions.add(key);
    });
    return { ok: errors.length === 0, errors: errors };
  }
  function createSnapshot(scene, units) {
    var validation = validateScene(scene, units);
    if (!validation.ok) throw new Error(validation.errors.join("; "));
    return {
      schema: "forge-multi-surface-snapshot/v1", version: 1,
      scene: copy(scene),
      units: (units || []).map(function (unit) {
        return Object.assign(copy(unit), { position: unitPosition(unit) });
      })
    };
  }
  function restoreSnapshot(snapshot) {
    if (!snapshot || snapshot.schema !== "forge-multi-surface-snapshot/v1") throw new Error("A multi-surface snapshot is required.");
    var scene = copy(snapshot.scene), units = (snapshot.units || []).map(function (unit) {
      var restored = copy(unit), position = restored.position || unitPosition(restored);
      restored.c = position.c; restored.r = position.r; restored.surfaceId = position.surfaceId; restored.elevationFt = position.elevationFt;
      delete restored.position;
      return restored;
    });
    var validation = validateScene(scene, units);
    if (!validation.ok) throw new Error(validation.errors.join("; "));
    return { scene: scene, units: units };
  }

  return Object.freeze({
    createScene: createScene, createUnits: createUnits, validateScene: validateScene,
    cellKey: cellKey, positionKey: positionKey, samePosition: samePosition, unitPosition: unitPosition,
    surfaceById: surfaceById, surfacePosition: surfacePosition, surfacesAt: surfacesAt,
    occupiedPositions: occupiedPositions, neighbors: neighbors, reachable: reachable, pathTo: pathTo, moveUnit: moveUnit,
    range3d: range3d, sightVerdict: sightVerdict, createSnapshot: createSnapshot, restoreSnapshot: restoreSnapshot
  });
});
