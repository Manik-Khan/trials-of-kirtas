/* Reviewed artwork -> current Forge map + local combat proof.
   Browser: window.ForgeImageCombatHandoffProof. Node: module.exports. */
(function (root, factory) {
  var Deploy = typeof module !== "undefined" && module.exports ? require("../forge/forge-deployment.js") : root.ForgeDeployment;
  var TG = typeof module !== "undefined" && module.exports ? require("../forge/tactics-geometry.js") : root.TacticsGeo;
  var Combat = typeof module !== "undefined" && module.exports ? require("../forge/forge-combat-rules.js") : root.ForgeCombatRules;
  var Bridge = typeof module !== "undefined" && module.exports ? require("../forge/map-bridge.js") : root.MapBridge;
  var api = factory(Deploy, TG, Combat, Bridge);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeImageCombatHandoffProof = api;
})(typeof self !== "undefined" ? self : this, function (Deploy, TG, Combat, Bridge) {
  "use strict";

  var FALLBACK_COLORS = {
    ground: "#927d58", building: "#9d7355", wall: "#8c8980", tent: "#c39186",
    tree: "#648150", water: "#397f91", roof: "#a96352", bridge: "#c08b4f", stairs: "#b9ad8b"
  };
  var PARTY = [
    { unit: "vesperian", name: "Vesperian", side: "pc", hp: 24, hpMax: 24, ac: 15, hit: 5, damage: 6, initMod: 3, color: "#7fb4a2" },
    { unit: "caim", name: "Caim", side: "pc", hp: 31, hpMax: 31, ac: 16, hit: 6, damage: 7, initMod: 4, color: "#d4b45f" },
    { unit: "liadan", name: "Liadan", side: "pc", hp: 22, hpMax: 22, ac: 14, hit: 5, damage: 6, initMod: 2, color: "#99a8d1" }
  ];
  var FOES = [
    { unit: "raider-1", name: "Market Raider 1", side: "foe", hp: 12, hpMax: 12, ac: 13, hit: 4, damage: 5, initMod: 2, color: "#b76d64" },
    { unit: "raider-2", name: "Market Raider 2", side: "foe", hp: 12, hpMax: 12, ac: 13, hit: 4, damage: 5, initMod: 2, color: "#b76d64" },
    { unit: "raider-3", name: "Market Raider 3", side: "foe", hp: 12, hpMax: 12, ac: 13, hit: 4, damage: 5, initMod: 1, color: "#b76d64" }
  ];

  function copy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function idx(cols, c, r) { return r * cols + c; }
  function key(c, r) { return c + "," + r; }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function hash32(value) {
    var text = String(value), hash = 2166136261;
    for (var i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }
  function colorHex(red, green, blue) {
    function part(value) { return clamp(Math.round(Number(value) || 0), 0, 255).toString(16).padStart(2, "0"); }
    return "#" + part(red) + part(green) + part(blue);
  }
  function analysisColor(cell, fallback) {
    var evidence = cell && cell.evidence;
    return evidence && Number.isFinite(Number(evidence.r))
      ? colorHex(evidence.r, evidence.g, evidence.b) : fallback;
  }
  function regionColor(region) {
    return region && region.palette && region.palette.primary || FALLBACK_COLORS[region && region.type] || "#888888";
  }
  function linePath(cells) {
    if (!cells || !cells.length) return [];
    var byKey = {}, points = cells.map(function (cell) { return { c: cell[0], r: cell[1] }; });
    points.forEach(function (point) { byKey[key(point.c, point.r)] = point; });
    function distances(start) {
      var queue = [start], seen = {}; seen[key(start.c, start.r)] = { d: 0, from: null };
      while (queue.length) {
        var at = queue.shift();
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(function (step) {
          var nextKey = key(at.c + step[0], at.r + step[1]);
          if (!byKey[nextKey] || seen[nextKey]) return;
          seen[nextKey] = { d: seen[key(at.c, at.r)].d + 1, from: key(at.c, at.r) };
          queue.push(byKey[nextKey]);
        });
      }
      return seen;
    }
    function farthest(start) {
      var seen = distances(start), far = start;
      Object.keys(seen).forEach(function (pointKey) {
        if (seen[pointKey].d > seen[key(far.c, far.r)].d) far = byKey[pointKey];
      });
      return { point: far, seen: seen };
    }
    var a = farthest(points[0]).point, scan = farthest(a), b = scan.point, path = [], cursor = key(b.c, b.r);
    while (cursor) {
      var parts = cursor.split(",").map(Number); path.unshift({ c: parts[0], r: parts[1] });
      cursor = scan.seen[cursor] && scan.seen[cursor].from;
    }
    return path;
  }
  function scenePalette(analysis) {
    var counts = {};
    (analysis && analysis.cells || []).forEach(function (cell) {
      var color = analysisColor(cell, "#927d58");
      counts[color] = (counts[color] || 0) + 1;
    });
    return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 8);
  }

  function reviewToMap(review, analysis) {
    if (!review || review.schema !== "forge-structure-review/v1" || !review.grid) throw new Error("A reviewed structure map is required.");
    var cols = review.grid.cols, rows = review.grid.rows, n = cols * rows;
    var map = {
      cols: cols, rows: rows,
      h: new Array(n).fill(0), wall: new Array(n).fill(false), occ: new Array(n).fill(0),
      coverShape: new Array(n).fill(null), spawns: [], props: [], connectors: [], ledges: [],
      terrain: new Array(n),
      meta: {
        source: "forge-structure-review/v1", name: review.scene || "Reviewed artwork",
        cellFt: 5, palette: scenePalette(analysis), regionColors: {},
        importAuthority: "dm-confirmed-structures", artworkRulesAuthority: false,
        limitations: { simultaneousSurfaces: false, bridgeUnderpassDeferred: 0 }
      }
    };
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var sourceCell = analysis && analysis.cells && analysis.cells[idx(cols, c, r)];
      map.terrain[idx(cols, c, r)] = {
        type: sourceCell && sourceCell.material || "ground", walkable: true, difficult: false,
        blocksMovement: false, source: "imported-palette-only",
        color: analysisColor(sourceCell, FALLBACK_COLORS.ground)
      };
    }
    var authored = review.regions.filter(function (region) { return region.source === "dm-authored"; });
    authored.forEach(function (region) {
      var color = regionColor(region); map.meta.regionColors[region.id] = color;
      var cells = region.cells.filter(function (cell) {
        return cell[0] >= 0 && cell[1] >= 0 && cell[0] < cols && cell[1] < rows;
      });
      if (region.type === "stairs") {
        var path = linePath(cells), rise = Number(region.topFt || 0) - Number(region.baseFt || 0);
        path.forEach(function (point, index) {
          var t = path.length <= 1 ? 1 : index / (path.length - 1), i = idx(cols, point.c, point.r);
          map.h[i] = Number(region.baseFt || 0) + rise * t; map.wall[i] = false; map.occ[i] = 0;
          map.terrain[i] = Object.assign({}, map.terrain[i], { type: "stairs", walkable: true, color: color, regionId: region.id });
        });
        if (path.length >= 2) map.connectors.push({
          id: "connector-" + region.id, kind: "stairs", state: "open", oneWay: false,
          from: copy(path[0]), to: copy(path[path.length - 1]),
          path: path.map(function (point, index) {
            var t = path.length <= 1 ? 1 : index / (path.length - 1);
            return { c: point.c, r: point.r, elevationFt: Number(region.baseFt || 0) + rise * t };
          }), requires: { climb: false }
        });
        return;
      }
      cells.forEach(function (cell) {
        var i = idx(cols, cell[0], cell[1]), height = Math.max(0, Number(region.topFt || 0) - Number(region.baseFt || 0));
        map.terrain[i] = Object.assign({}, map.terrain[i], { type: region.type, color: color, regionId: region.id });
        if (region.type === "water") {
          map.wall[i] = true; map.occ[i] = 0;
          map.terrain[i] = Object.assign({}, map.terrain[i], { walkable: false, blocksMovement: true });
        } else if (region.type === "building" || region.type === "wall" || region.type === "tent") {
          map.wall[i] = true; map.occ[i] = height;
          map.coverShape[i] = { kind: "full", source: "imported-" + region.type, heightFt: height };
          map.terrain[i] = Object.assign({}, map.terrain[i], { walkable: false, blocksMovement: true });
        } else if (region.type === "tree") {
          map.occ[i] = Math.max(map.occ[i], height);
          map.coverShape[i] = { kind: "circle", source: "imported-tree", radius: 0.34, heightFt: height };
        } else if (region.type === "roof" || region.type === "bridge") {
          map.h[i] = Number(region.topFt || 0); map.wall[i] = false; map.occ[i] = 0;
          map.terrain[i] = Object.assign({}, map.terrain[i], { walkable: true, blocksMovement: false, effectiveSurface: "elevated" });
        }
      });
      if (region.type === "bridge") map.meta.limitations.bridgeUnderpassDeferred++;
    });
    var validation = Bridge && Bridge.validate ? Bridge.validate(map) : { ok: true, errors: [] };
    return {
      map: map, validation: validation,
      receipt: {
        authoredRegions: authored.length,
        blockedCells: map.wall.filter(Boolean).length,
        elevatedCells: map.h.filter(function (height) { return height > 0; }).length,
        connectors: map.connectors.length,
        paletteColors: map.meta.palette.length,
        deferredUnderpasses: map.meta.limitations.bridgeUnderpassDeferred
      }
    };
  }

  function placementComponents(map) {
    var blocked = Deploy.deploymentBlocked(map), unseen = {}, components = [];
    for (var r = 0; r < map.rows; r++) for (var c = 0; c < map.cols; c++) {
      if (!map.wall[idx(map.cols, c, r)] && !blocked[key(c, r)]) unseen[key(c, r)] = { c: c, r: r };
    }
    while (Object.keys(unseen).length) {
      var firstKey = Object.keys(unseen)[0], queue = [unseen[firstKey]], cells = []; delete unseen[firstKey];
      while (queue.length) {
        var at = queue.shift(); cells.push(at);
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(function (step) {
          var nextKey = key(at.c + step[0], at.r + step[1]);
          if (!unseen[nextKey]) return;
          queue.push(unseen[nextKey]); delete unseen[nextKey];
        });
      }
      components.push(cells);
    }
    return components.sort(function (a, b) { return b.length - a.length; });
  }
  function deployCombatants(map, party, foes) {
    party = party || PARTY; foes = foes || FOES;
    var component = placementComponents(map)[0] || [];
    if (component.length < party.length + foes.length) return { ok: false, errors: ["The reviewed map has too little connected open ground for this test encounter."] };
    var partyAnchor = component.slice().sort(function (a, b) { return a.c + a.r - b.c - b.r; })[Math.floor(component.length * 0.08)] || component[0];
    var preferredDistance = Math.min(15, Math.max(8, Math.max(map.cols, map.rows) - 1));
    var foeAnchor = component.slice().sort(function (a, b) {
      var ad = Math.max(Math.abs(a.c - partyAnchor.c), Math.abs(a.r - partyAnchor.r));
      var bd = Math.max(Math.abs(b.c - partyAnchor.c), Math.abs(b.r - partyAnchor.r));
      return Math.abs(ad - preferredDistance) - Math.abs(bd - preferredDistance) || bd - ad;
    })[0] || component[component.length - 1];
    var groups = [
      { id: "import-party", label: "Party", role: "party", unitIds: party.map(function (unit) { return unit.unit; }), anchor: partyAnchor, formationSeed: 41 },
      { id: "import-foes", label: "Raiders", role: "enemy", unitIds: foes.map(function (unit) { return unit.unit; }), anchor: foeAnchor, formationSeed: 97 }
    ];
    var draft = Deploy.planDraft(map, groups), record = Deploy.deploymentRecord(groups, draft);
    if (draft.ok) map.spawns = Object.keys(draft.positions).map(function (unit) {
      var at = draft.positions[unit];
      return { c: at.c, r: at.r, side: party.some(function (candidate) { return candidate.unit === unit; }) ? "pc" : "foe", key: unit };
    });
    return { ok: draft.ok, draft: draft, record: record, groups: groups, errors: draft.errors || [] };
  }

  function createFight(map, deployment, party, foes) {
    party = party || PARTY; foes = foes || FOES;
    if (!deployment || !deployment.record || !deployment.record.resolved) throw new Error("Resolved deployment is required.");
    var definitions = party.concat(foes), roster = definitions.map(function (unit) {
      return { unit: unit.unit, name: unit.name, kind: unit.side === "foe" ? "foe" : "pc" };
    });
    var placed = Deploy.applyToRoster(roster, deployment.record);
    var byId = {}; definitions.forEach(function (unit) { byId[unit.unit] = unit; });
    var units = placed.map(function (row) {
      var source = byId[row.unit], initiative = 1 + hash32(row.unit + "|initiative") % 20 + source.initMod;
      return Object.assign(copy(source), { c: row.pos.c, r: row.pos.r, initiative: initiative, alive: true, moved: false, acted: false });
    }).sort(function (a, b) { return b.initiative - a.initiative || b.initMod - a.initMod; });
    return { map: map, units: units, turn: 0, round: 1, eventIndex: 0, log: ["Initiative: " + units.map(function (unit) { return unit.name + " " + unit.initiative; }).join(" · ")] };
  }
  function activeUnit(fight) { return fight && fight.units[fight.turn % fight.units.length]; }
  function occupied(fight, except) {
    return new Set(fight.units.filter(function (unit) { return unit.alive && unit.unit !== except; }).map(function (unit) { return key(unit.c, unit.r); }));
  }
  function reachableForActive(fight) {
    var active = activeUnit(fight);
    return active && active.alive ? TG.movementReach(fight.map, Object.assign({ speed: 30 }, active), occupied(fight, active.unit), 6) : {};
  }
  function moveActive(fight, c, r) {
    var next = copy(fight), active = activeUnit(next), reachable = reachableForActive(next), destination = reachable[key(c, r)];
    if (!active || active.moved || !destination) return { ok: false, fight: fight, message: active && active.moved ? "This combatant has already moved this turn." : "That square is not reachable this turn." };
    var path = TG.pathTo(reachable, active, c, r); active.c = c; active.r = r; active.moved = true;
    next.log.push(active.name + " moved " + path.length * 5 + " ft to " + key(c, r) + ".");
    return { ok: true, fight: next, path: path, message: next.log[next.log.length - 1] };
  }
  function resolveAttack(fight, targetId) {
    var next = copy(fight), attacker = activeUnit(next), target = next.units.find(function (unit) { return unit.unit === targetId; });
    if (!attacker || !target || !target.alive || attacker.side === target.side || attacker.acted) return { ok: false, fight: fight, message: "Choose a living opponent for the active combatant." };
    var distanceFt = TG.range3d(next.map, attacker, target), action = { kind: "attack", label: "Test strike", rng: 18, hit: attacker.hit, dmg: String(attacker.damage) };
    if (!TG.inRange(next.map, attacker, target, 90)) return { ok: false, fight: fight, message: target.name + " is beyond the 90-ft test range." };
    var sight = TG.losVerdict(next.map, attacker, target);
    if (!sight.canTarget) return { ok: false, fight: fight, message: target.name + " has total cover." };
    if (!Combat.requireDamage(action).ok) return { ok: false, fight: fight, message: "The attack has no valid damage expression." };
    var hostileAdjacent = next.units.some(function (unit) {
      return unit.alive && unit.side !== attacker.side && TG.chebyshev(attacker, unit) <= 1;
    });
    var sources = Combat.attackRollSources({ attacker: attacker, target: target, action: action, distanceFt: distanceFt, hostileAdjacent: hostileAdjacent, flankingMode: "advantage", flanked: false });
    var first = 1 + hash32(attacker.unit + "|" + target.unit + "|" + next.eventIndex + "|a") % 20;
    var second = 1 + hash32(attacker.unit + "|" + target.unit + "|" + next.eventIndex + "|b") % 20;
    var die = sources.advantage ? Math.max(first, second) : sources.disadvantage ? Math.min(first, second) : first;
    var total = die + attacker.hit + Number(sources.attackBonus || 0), defense = target.ac + (Number.isFinite(sight.acBonus) ? sight.acBonus : 0);
    var hit = die === 20 || die !== 1 && total >= defense, damage = hit ? attacker.damage + (die === 20 ? attacker.damage : 0) : 0;
    target.hp = Math.max(0, target.hp - damage); target.alive = target.hp > 0; attacker.acted = true; next.eventIndex++;
    var message = attacker.name + " rolled " + die + " + " + attacker.hit + " vs AC " + defense
      + (hit ? " — " + damage + " damage to " + target.name + "." : " — miss.")
      + (sight.cover === "none" ? "" : " Cover: " + sight.cover + ".");
    next.log.push(message);
    return { ok: true, fight: next, hit: hit, damage: damage, sight: sight, sources: sources, message: message };
  }
  function endTurn(fight) {
    var next = copy(fight), prior = activeUnit(next), guard = 0;
    if (!next.units.some(function (unit) { return unit.alive && unit.side === "pc"; }) || !next.units.some(function (unit) { return unit.alive && unit.side === "foe"; })) return next;
    do {
      next.turn = (next.turn + 1) % next.units.length;
      if (next.turn === 0) next.round++;
      guard++;
    } while (!activeUnit(next).alive && guard <= next.units.length);
    var active = activeUnit(next); active.moved = false; active.acted = false;
    next.log.push((prior ? prior.name + " ended the turn. " : "") + "Round " + next.round + ": " + active.name + " is active.");
    return next;
  }

  return Object.freeze({
    FALLBACK_COLORS: FALLBACK_COLORS, PARTY: PARTY, FOES: FOES,
    reviewToMap: reviewToMap, placementComponents: placementComponents, deployCombatants: deployCombatants,
    createFight: createFight, activeUnit: activeUnit, reachableForActive: reachableForActive,
    moveActive: moveActive, resolveAttack: resolveAttack, endTurn: endTurn,
    regionColor: regionColor, linePath: linePath
  });
});
