(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ForgePortalStairsProof = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var CARDINAL = [
    { side: "N", dc: 0, dr: -1 },
    { side: "E", dc: 1, dr: 0 },
    { side: "S", dc: 0, dr: 1 },
    { side: "W", dc: -1, dr: 0 }
  ];
  var OPPOSITE = { N: "S", E: "W", S: "N", W: "E" };

  function cellKey(c, r) { return c + "," + r; }
  function edgeKey(c, r, side) { return c + "," + r + "," + side; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function center(room) { return { c: room.c + (room.w - 1) / 2, r: room.r + (room.h - 1) / 2 }; }
  function inside(grid, cell) { return cell.c >= 0 && cell.r >= 0 && cell.c < grid.cols && cell.r < grid.rows; }
  function stepFor(side) { return CARDINAL.find(function (step) { return step.side === side; }); }
  function adjacent(a, b) { return Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1; }
  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    return "{" + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ":" + stableStringify(value[key]);
    }).join(",") + "}";
  }
  function fingerprint(value) {
    var text = stableStringify(value), hash = 2166136261;
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return "portal-" + (hash >>> 0).toString(16).padStart(8, "0");
  }
  function seededRandom(seed) {
    var value = (Math.abs(Math.trunc(Number(seed) || 1)) || 1) >>> 0;
    return function () {
      value += 0x6d2b79f5;
      var next = value;
      next = Math.imul(next ^ next >>> 15, next | 1);
      next ^= next + Math.imul(next ^ next >>> 7, next | 61);
      return ((next ^ next >>> 14) >>> 0) / 4294967296;
    };
  }
  function roomCells(room) {
    var out = [];
    for (var r = room.r; r < room.r + room.h; r++) for (var c = room.c; c < room.c + room.w; c++) {
      out.push({ c: c, r: r });
    }
    return out;
  }
  function boundarySide(room, c, r, side) {
    return side === "N" ? r === room.r
      : side === "S" ? r === room.r + room.h - 1
        : side === "W" ? c === room.c
          : c === room.c + room.w - 1;
  }
  function sidePreference(room, target) {
    var a = center(room), b = center(target), dx = b.c - a.c, dy = b.r - a.r;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ["E", dy >= 0 ? "S" : "N", dy >= 0 ? "N" : "S", "W"]
      : ["W", dy >= 0 ? "S" : "N", dy >= 0 ? "N" : "S", "E"];
    return dy >= 0 ? ["S", dx >= 0 ? "E" : "W", dx >= 0 ? "W" : "E", "N"]
      : ["N", dx >= 0 ? "E" : "W", dx >= 0 ? "W" : "E", "S"];
  }
  function portalCandidates(room, target, used) {
    var targetCenter = center(target), out = [];
    sidePreference(room, target).forEach(function (side) {
      var vertical = side === "E" || side === "W";
      var start = vertical ? room.r : room.c;
      var length = vertical ? room.h : room.w;
      var desired = Math.round(vertical ? targetCenter.r : targetCenter.c);
      desired = Math.max(start, Math.min(start + length - 1, desired));
      var offsets = [0, -1, 1, -2, 2, -3, 3];
      offsets.forEach(function (offset) {
        var along = desired + offset;
        if (along < start || along >= start + length) return;
        var c = vertical ? (side === "E" ? room.c + room.w - 1 : room.c) : along;
        var r = vertical ? along : (side === "S" ? room.r + room.h - 1 : room.r);
        if (!used[room.id + ":" + edgeKey(c, r, side)]) out.push({ roomId: room.id, c: c, r: r, side: side });
      });
    });
    return out;
  }
  function outsideOf(portal, distance) {
    var step = stepFor(portal.side);
    return { c: portal.c + step.dc * distance, r: portal.r + step.dr * distance };
  }
  function makeSpecs(seed) {
    var random = seededRandom(seed), lift = random() > 0.5 ? 5 : 0;
    return [
      {
        key: "processional", label: "Processional ascent", grid: { cols: 30, rows: 22 },
        rooms: [
          ["arrival", "Arrival court", 2, 8, 5, 5, 0], ["gallery", "Guard gallery", 10, 7, 6, 6, 5],
          ["sanctum", "High sanctum", 20, 6, 7, 8, 10 + lift], ["vestry", "Lower vestry", 11, 16, 5, 4, 0],
          ["watch", "Watch room", 22, 16, 5, 4, 5]
        ],
        edges: [["arrival", "gallery"], ["gallery", "sanctum"], ["gallery", "vestry"], ["sanctum", "watch"]]
      },
      {
        key: "vault", label: "Vault ring", grid: { cols: 30, rows: 22 },
        rooms: [
          ["west", "West gate", 2, 3, 5, 4, 0], ["north", "North archive", 12, 2, 6, 4, 5],
          ["east", "East reliquary", 23, 3, 5, 4, 10], ["south-east", "Sunken store", 22, 15, 6, 4, 0],
          ["south", "South chapel", 12, 16, 6, 4, 5], ["south-west", "Old guardroom", 2, 15, 5, 4, 0],
          ["hub", "Raised crossing", 12, 8, 6, 5, 10 + lift]
        ],
        edges: [["west", "north"], ["north", "east"], ["east", "south-east"], ["south-east", "south"],
          ["south", "south-west"], ["south-west", "west"], ["north", "hub"], ["hub", "south"]]
      },
      {
        key: "warren", label: "Branching warren", grid: { cols: 30, rows: 22 },
        rooms: [
          ["root", "Root hall", 2, 9, 6, 5, 0], ["fork", "Fork", 11, 8, 5, 6, 5],
          ["north-a", "North workshop", 20, 2, 7, 4, 10], ["north-b", "Upper store", 20, 8, 7, 4, 15],
          ["south-a", "Lower cistern", 19, 15, 7, 4, 0], ["spur", "Side cell", 10, 17, 5, 3, 0]
        ],
        edges: [["root", "fork"], ["fork", "north-a"], ["fork", "north-b"], ["fork", "south-a"], ["fork", "spur"]]
      }
    ].map(function (spec) {
      spec.rooms = spec.rooms.map(function (room) {
        return { id: room[0], label: room[1], c: room[2], r: room[3], w: room[4], h: room[5], elevationFt: room[6] };
      });
      return spec;
    });
  }
  function roomIndex(rooms) {
    var byCell = {}, byId = {};
    rooms.forEach(function (room) {
      byId[room.id] = room;
      roomCells(room).forEach(function (cell) { byCell[cellKey(cell.c, cell.r)] = room.id; });
    });
    return { byCell: byCell, byId: byId };
  }
  function reconstruct(cameFrom, goalKey) {
    var out = [], current = goalKey;
    while (current) {
      var parts = current.split(",");
      out.push({ c: Number(parts[0]), r: Number(parts[1]) });
      current = cameFrom[current];
    }
    return out.reverse();
  }
  function route(grid, start, goal, blocked, claimed, elevationFt) {
    var queue = [start], head = 0, cameFrom = {}, seen = {};
    seen[cellKey(start.c, start.r)] = true;
    while (head < queue.length) {
      var current = queue[head++], currentKey = cellKey(current.c, current.r);
      if (current.c === goal.c && current.r === goal.r) return reconstruct(cameFrom, currentKey);
      var ordered = CARDINAL.slice().sort(function (a, b) {
        var ad = Math.abs(current.c + a.dc - goal.c) + Math.abs(current.r + a.dr - goal.r);
        var bd = Math.abs(current.c + b.dc - goal.c) + Math.abs(current.r + b.dr - goal.r);
        return ad - bd;
      });
      ordered.forEach(function (step) {
        var next = { c: current.c + step.dc, r: current.r + step.dr }, nextKey = cellKey(next.c, next.r);
        if (!inside(grid, next) || seen[nextKey] || blocked[nextKey]) return;
        if (claimed[nextKey] !== undefined && claimed[nextKey] !== elevationFt) return;
        seen[nextKey] = true; cameFrom[nextKey] = currentKey; queue.push(next);
      });
    }
    return null;
  }
  function cellElevation(path, c, r) {
    var found = path.find(function (cell) { return cell.c === c && cell.r === r; });
    return found && found.elevationFt;
  }
  function chooseConnection(spec, roomA, roomB, state) {
    var low = roomA.elevationFt <= roomB.elevationFt ? roomA : roomB;
    var high = low === roomA ? roomB : roomA;
    var tiers = Math.abs(high.elevationFt - low.elevationFt) / 5;
    var lowCandidates = portalCandidates(low, high, state.usedPortals);
    var highCandidates = portalCandidates(high, low, state.usedPortals);
    for (var li = 0; li < lowCandidates.length; li++) for (var hi = 0; hi < highCandidates.length; hi++) {
      var lowPortal = lowCandidates[li], highPortal = highCandidates[hi];
      var lowOutside = outsideOf(lowPortal, 1), stairCells = [], approach;
      if (!inside(spec.grid, lowOutside) || state.rooms.byCell[cellKey(lowOutside.c, lowOutside.r)]) continue;
      if (tiers) {
        for (var distance = tiers; distance >= 0; distance--) {
          var stairCell = distance ? outsideOf(highPortal, distance) : { c: highPortal.c, r: highPortal.r };
          stairCells.push({ c: stairCell.c, r: stairCell.r, elevationFt: high.elevationFt - distance * 5 });
        }
        approach = outsideOf(highPortal, tiers + 1);
      } else approach = outsideOf(highPortal, 1);
      var reserved = tiers ? stairCells.slice(0, -1).concat([approach]) : [approach];
      if (!reserved.every(function (cell) {
        var key = cellKey(cell.c, cell.r), owner = state.rooms.byCell[key];
        return inside(spec.grid, cell) && !owner && (state.claimed[key] === undefined || state.claimed[key] === low.elevationFt);
      })) continue;
      var blocked = Object.assign({}, state.rooms.byCell);
      delete blocked[cellKey(lowOutside.c, lowOutside.r)];
      delete blocked[cellKey(approach.c, approach.r)];
      reserved.forEach(function (cell) { delete blocked[cellKey(cell.c, cell.r)]; });
      var middle = route(spec.grid, lowOutside, approach, blocked, state.claimed, low.elevationFt);
      if (!middle) continue;
      var path = [{ c: lowPortal.c, r: lowPortal.r, elevationFt: low.elevationFt }]
        .concat(middle.map(function (cell) { return { c: cell.c, r: cell.r, elevationFt: low.elevationFt }; }));
      if (tiers) stairCells.forEach(function (cell) {
        if (path[path.length - 1].c !== cell.c || path[path.length - 1].r !== cell.r) path.push(cell);
      });
      else path.push({ c: highPortal.c, r: highPortal.r, elevationFt: high.elevationFt });
      var conflict = path.some(function (cell) {
        var existing = state.claimed[cellKey(cell.c, cell.r)];
        return existing !== undefined && existing !== cell.elevationFt;
      });
      if (conflict) continue;
      return {
        id: "route-" + roomA.id + "-" + roomB.id, roomA: roomA.id, roomB: roomB.id,
        lowRoomId: low.id, highRoomId: high.id, lowFt: low.elevationFt, highFt: high.elevationFt,
        lowPortal: lowPortal, highPortal: highPortal, portals: [lowPortal, highPortal],
        path: path, stairPath: stairCells, approach: approach,
        lowLanding: tiers ? stairCells[0] : lowOutside,
        highLanding: { c: highPortal.c, r: highPortal.r, elevationFt: high.elevationFt },
        kind: tiers ? "stairs" : "level", tiers: tiers
      };
    }
    return null;
  }
  function wallsForRooms(rooms, roomLookup, portalEdges) {
    var walls = [];
    rooms.forEach(function (room) {
      roomCells(room).forEach(function (cell) {
        CARDINAL.forEach(function (step) {
          if (!boundarySide(room, cell.c, cell.r, step.side)) return;
          var portalKey = room.id + ":" + edgeKey(cell.c, cell.r, step.side);
          if (portalEdges[portalKey]) return;
          var neighbor = cellKey(cell.c + step.dc, cell.r + step.dr);
          if (roomLookup.byCell[neighbor] === room.id) return;
          walls.push({ roomId: room.id, c: cell.c, r: cell.r, side: step.side, elevationFt: room.elevationFt });
        });
      });
    });
    return walls;
  }
  function tacticalAudit(scene) {
    var floor = scene.floor, keys = Object.keys(floor);
    if (!keys.length) return { ok: false, reachable: 0, open: 0 };
    var seen = {}, queue = [keys[0]], head = 0; seen[keys[0]] = true;
    while (head < queue.length) {
      var current = queue[head++], parts = current.split(",").map(Number), currentFt = floor[current];
      CARDINAL.forEach(function (step) {
        var nextKey = cellKey(parts[0] + step.dc, parts[1] + step.dr);
        if (floor[nextKey] === undefined || seen[nextKey] || Math.abs(floor[nextKey] - currentFt) > 5) return;
        seen[nextKey] = true; queue.push(nextKey);
      });
    }
    return { ok: Object.keys(seen).length === keys.length, reachable: Object.keys(seen).length, open: keys.length };
  }
  function validateScene(scene) {
    var errors = [], portalEdges = {};
    scene.connections.forEach(function (connection) {
      connection.portals.forEach(function (portal) { portalEdges[portal.roomId + ":" + edgeKey(portal.c, portal.r, portal.side)] = true; });
      for (var i = 1; i < connection.path.length; i++) {
        if (!adjacent(connection.path[i - 1], connection.path[i])) errors.push(connection.id + " is not cardinal");
        if (Math.abs(connection.path[i - 1].elevationFt - connection.path[i].elevationFt) > 5) errors.push(connection.id + " rises more than 5 ft");
      }
      connection.stairPath.slice(0, -1).forEach(function (cell) {
        var owner = scene.roomLookup[cellKey(cell.c, cell.r)];
        if (owner) errors.push(connection.id + " puts stairs inside " + owner);
      });
      connection.path.slice(1, -1).forEach(function (cell) {
        var owner = scene.roomLookup[cellKey(cell.c, cell.r)];
        if (owner && owner !== connection.lowRoomId && owner !== connection.highRoomId) errors.push(connection.id + " crosses unrelated room " + owner);
      });
      if (cellElevation(connection.path, connection.lowLanding.c, connection.lowLanding.r) !== connection.lowFt) errors.push(connection.id + " low landing is wrong");
      if (cellElevation(connection.path, connection.highLanding.c, connection.highLanding.r) !== connection.highFt) errors.push(connection.id + " high landing is wrong");
    });
    scene.walls.forEach(function (wall) {
      if (portalEdges[wall.roomId + ":" + edgeKey(wall.c, wall.r, wall.side)]) errors.push("wall crosses portal");
    });
    var tactical = tacticalAudit(scene);
    if (!tactical.ok) errors.push("tactical floor is disconnected");
    return { ok: errors.length === 0, errors: errors, tactical: tactical };
  }
  function buildFromSpec(input) {
    var spec = clone(input), rooms = roomIndex(spec.rooms), state = { rooms: rooms, usedPortals: {}, claimed: {} };
    spec.rooms.forEach(function (room) {
      roomCells(room).forEach(function (cell) { state.claimed[cellKey(cell.c, cell.r)] = room.elevationFt; });
    });
    var connections = [];
    for (var i = 0; i < spec.edges.length; i++) {
      var roomA = rooms.byId[spec.edges[i][0]], roomB = rooms.byId[spec.edges[i][1]];
      if (!roomA || !roomB) return { ok: false, reason: "Unknown room in edge " + spec.edges[i].join(" → ") };
      var connection = chooseConnection(spec, roomA, roomB, state);
      if (!connection) return { ok: false, reason: "No legal portal and stair runway for " + roomA.label + " → " + roomB.label };
      connection.portals.forEach(function (portal) { state.usedPortals[portal.roomId + ":" + edgeKey(portal.c, portal.r, portal.side)] = true; });
      connection.path.forEach(function (cell) { state.claimed[cellKey(cell.c, cell.r)] = cell.elevationFt; });
      connections.push(connection);
    }
    var portalEdges = {};
    connections.forEach(function (connection) {
      connection.portals.forEach(function (portal) { portalEdges[portal.roomId + ":" + edgeKey(portal.c, portal.r, portal.side)] = true; });
    });
    var floor = Object.assign({}, state.claimed);
    var scene = {
      schema: "forge-portal-stairs-proof/v1", version: 1, key: spec.key, label: spec.label, grid: spec.grid,
      rooms: spec.rooms, edges: spec.edges, connections: connections,
      portals: connections.reduce(function (all, connection) { return all.concat(connection.portals); }, []),
      walls: wallsForRooms(spec.rooms, rooms, portalEdges), floor: floor, roomLookup: rooms.byCell
    };
    scene.audit = validateScene(scene);
    scene.fingerprint = fingerprint({ key: scene.key, rooms: scene.rooms, connections: scene.connections, walls: scene.walls });
    return scene.audit.ok ? { ok: true, scene: scene } : { ok: false, reason: scene.audit.errors.join("; "), scene: scene };
  }
  function generate(seed, candidate) {
    var specs = makeSpecs(seed), index = Math.max(0, Math.min(specs.length - 1, Math.trunc(Number(candidate) || 0)));
    var result = buildFromSpec(specs[index]);
    if (!result.ok) throw new Error(result.reason);
    result.scene.seed = Number(seed) || 1847;
    result.scene.candidate = index;
    result.scene.attempt = 1;
    return result.scene;
  }

  return {
    CARDINAL: CARDINAL, OPPOSITE: OPPOSITE,
    cellKey: cellKey, edgeKey: edgeKey, stableStringify: stableStringify, fingerprint: fingerprint,
    makeSpecs: makeSpecs, buildFromSpec: buildFromSpec, generate: generate,
    tacticalAudit: tacticalAudit, validateScene: validateScene
  };
});
