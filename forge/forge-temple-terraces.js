/* ── forge-temple-terraces.js ─────────────────────────────────────────
   Intent-owned Temple Terraces scene generator. Pure data; no DOM or THREE.
   Dual export: browser (window.ForgeTempleTerraces) + Node.              */
(function (root, factory) {
  var GF = typeof require !== "undefined" ? require("./forge-generator-foundation.js") : root.ForgeGeneratorFoundation;
  var MB = typeof require !== "undefined" ? require("./map-bridge.js") : root.MapBridge;
  var api = factory(GF, MB);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeTempleTerraces = api;
})(typeof self !== "undefined" ? self : this, function (GF, MB) {
  "use strict";

  if (!GF || !MB || !MB.CELL) throw new Error("forge-temple-terraces: generator dependencies are unavailable");

  var VERSION = 1;
  var CELL = MB.CELL;
  var PROFILES = Object.freeze({
    temple: "temple-masonry",
    druidic: "druidic-overgrown-stone",
    tundra: "tundra-frost-stone",
    volcanic: "volcanic-basalt",
    cavern: "cavern-carved-rock",
    grass: "grassland-weathered-ruin",
    swamp: "swamp-sunken-stone"
  });
  var VARIANTS = Object.freeze(["axial", "switchback", "ring"]);

  function constructionProfile(themeKey) {
    if (!Object.prototype.hasOwnProperty.call(PROFILES, themeKey)) {
      throw new Error("forge-temple-terraces: unknown theme \"" + themeKey + "\"");
    }
    return PROFILES[themeKey];
  }

  function clampInt(v, min, max) { return Math.max(min, Math.min(max, Math.round(Number(v) || 0))); }
  function idx(cols, c, r) { return r * cols + c; }
  function key(c, r) { return c + "," + r; }
  function inBounds(d, c, r) { return c >= 0 && r >= 0 && c < d.W && r < d.H; }
  function inside(b, c, r) { return c >= b.l && c <= b.r && r >= b.t && r <= b.b; }
  function boundary(b, c, r) { return inside(b, c, r) && (c === b.l || c === b.r || r === b.t || r === b.b); }
  function clone(value) { return GF._internals.clonePlain(value); }

  function room(id, role, elevationFt, cells) {
    var minC = Infinity, minR = Infinity, maxC = -Infinity, maxR = -Infinity;
    cells.forEach(function (p) {
      minC = Math.min(minC, p.c); minR = Math.min(minR, p.r);
      maxC = Math.max(maxC, p.c); maxR = Math.max(maxR, p.r);
    });
    return {
      id: id,
      type: role === "approach" ? "entrance" : (role === "summit" ? "boss" : "combat"),
      tier: elevationFt / 5,
      x: minC, y: minR, w: maxC - minC + 1, h: maxR - minR + 1,
      cx: Math.round((minC + maxC) / 2), cy: Math.round((minR + maxR) / 2)
    };
  }

  function layoutTemple(options) {
    options = options || {};
    var size = 40 + 2 * Math.floor((clampInt(options.roomCount, 4, 16) - 4) / 2);
    var W = size, H = size, n = W * H;
    var grid = new Array(n).fill(CELL.VOID);
    var h = new Array(n).fill(0);
    var roomId = new Array(n).fill(-1);
    var variant = VARIANTS[(Number(options.layoutSeed) >>> 0) % VARIANTS.length];
    var outer = { l: 3, t: 3, r: W - 4, b: H - 7 };
    var upperBand = { l: 8, t: 8, r: W - 9, b: H - 12 };
    var upper = { l: upperBand.l + 1, t: upperBand.t + 1, r: upperBand.r - 1, b: upperBand.b - 1 };
    var summitBand = { l: 14, t: 14, r: W - 15, b: H - 18 };
    var summit = { l: summitBand.l + 1, t: summitBand.t + 1, r: summitBand.r - 1, b: summitBand.b - 1 };
    var mid = Math.floor(W / 2);
    var approach = { l: mid - 5, t: outer.b, r: mid + 4, b: H - 2 };
    var approachBand = { l: approach.l, t: outer.b, r: approach.r, b: outer.b };

    function paintRect(b, cell, elevationFt) {
      for (var r = b.t; r <= b.b; r++) for (var c = b.l; c <= b.r; c++) {
        var i = idx(W, c, r); grid[i] = cell; h[i] = elevationFt;
      }
    }
    paintRect(outer, CELL.FLOOR, 5);
    paintRect(approach, CELL.FLOOR, 0);
    for (var ac = approachBand.l; ac <= approachBand.r; ac++) grid[idx(W, ac, approachBand.t)] = CELL.WALL;
    for (var r = upperBand.t; r <= upperBand.b; r++) for (var c = upperBand.l; c <= upperBand.r; c++) {
      if (boundary(upperBand, c, r)) grid[idx(W, c, r)] = CELL.WALL;
    }
    paintRect(upper, CELL.FLOOR, 10);
    for (var sr = summitBand.t; sr <= summitBand.b; sr++) for (var sc = summitBand.l; sc <= summitBand.r; sc++) {
      if (boundary(summitBand, sc, sr)) grid[idx(W, sc, sr)] = CELL.WALL;
    }
    paintRect(summit, CELL.FLOOR, 15);

    var regions = [
      { id: "approach", role: "approach", elevationFt: 0, cells: [] },
      { id: "lower-court", role: "lower-court", elevationFt: 5, cells: [] },
      { id: "upper-court", role: "upper-court", elevationFt: 10, cells: [] },
      { id: "summit-sanctuary", role: "summit", elevationFt: 15, cells: [] }
    ];
    var regionLookup = {};
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var j = idx(W, x, y);
      if (grid[j] !== CELL.FLOOR) continue;
      var regionIndex = inside(summit, x, y) ? 3
        : (inside(upper, x, y) ? 2 : (inside(approach, x, y) ? 0 : 1));
      regions[regionIndex].cells.push({ c: x, r: y });
      regionLookup[key(x, y)] = regions[regionIndex].id;
      roomId[j] = regionIndex;
    }
    var rooms = regions.map(function (region, regionIndex) {
      return room(regionIndex, region.role, region.elevationFt, region.cells);
    });
    var dungeon = {
      W: W, H: H, grid: grid, roomId: roomId,
      corridor: new Array(n).fill(0), doorway: new Array(n).fill(0),
      bfs: new Array(n).fill(-1), maxBfs: 0,
      rooms: rooms, props: [], spawns: [], torches: [], pools: [], lakeCells: [],
      lakeMask: new Array(n).fill(0), arches: [], entrance: null, boss: null,
      valid: true, stats: {}, name: "Temple Terraces",
      params: { themeKey: options.themeKey || "temple" }
    };
    return {
      dungeon: dungeon,
      h: h,
      connectors: [],
      ledges: [],
      intent: {
        version: VERSION,
        archetype: "temple-terraces",
        variant: variant,
        regions: regions,
        routes: [],
        connectorPurposes: {}
      },
      constructionProfile: null,
      _bounds: { approach: approachBand, upper: upperBand, summit: summitBand },
      _regionLookup: regionLookup
    };
  }

  function stairPath(bounds, side, offset, lowFt, highFt) {
    var midC = Math.floor((bounds.l + bounds.r) / 2) + offset;
    var midR = Math.floor((bounds.t + bounds.b) / 2) + offset;
    var middleFt = (lowFt + highFt) / 2;
    if (side === "north") return [
      { c: midC, r: bounds.t - 1, elevationFt: lowFt },
      { c: midC, r: bounds.t, elevationFt: middleFt },
      { c: midC, r: bounds.t + 1, elevationFt: highFt }
    ];
    if (side === "west") return [
      { c: bounds.l - 1, r: midR, elevationFt: lowFt },
      { c: bounds.l, r: midR, elevationFt: middleFt },
      { c: bounds.l + 1, r: midR, elevationFt: highFt }
    ];
    if (side === "east") return [
      { c: bounds.r + 1, r: midR, elevationFt: lowFt },
      { c: bounds.r, r: midR, elevationFt: middleFt },
      { c: bounds.r - 1, r: midR, elevationFt: highFt }
    ];
    return [
      { c: midC, r: bounds.b + 1, elevationFt: lowFt },
      { c: midC, r: bounds.b, elevationFt: middleFt },
      { c: midC, r: bounds.b - 1, elevationFt: highFt }
    ];
  }

  function buildStair(id, routeId, role, fromRegion, toRegion, path, profile) {
    var first = path[0], last = path[path.length - 1];
    return {
      id: id,
      kind: "stairs",
      from: Object.assign({}, first),
      to: Object.assign({}, last),
      path: path.map(function (p) { return Object.assign({}, p); }),
      widthFt: 10,
      clearanceFt: null,
      movementCostFt: (path.length - 1) * 5,
      requires: { climb: false, jump: false, swim: false, fly: false },
      oneWay: false,
      blocksWhenClosed: false,
      state: "open",
      deltaFt: Math.abs(Number(last.elevationFt) - Number(first.elevationFt)),
      source: "archetype-intent",
      purpose: { routeId: routeId, role: role, fromRegionId: fromRegion, toRegionId: toRegion },
      render: { generated: true, constructionProfile: profile }
    };
  }

  function routeSides(variant, secondary) {
    if (variant === "switchback") return secondary ? ["south", "east", "west"] : ["south", "west", "east"];
    if (variant === "ring") return secondary ? ["south", "south", "west"] : ["south", "east", "north"];
    return ["south", "south", "south"];
  }

  function buildRoutes(scene, options) {
    var profile = scene.constructionProfile;
    var heightBias = ((Number(options.heightSeed) >>> 0) % 3) - 1;
    var routes = [{
      id: "primary-ascent", role: "primary-ascent", required: true,
      regionIds: ["approach", "lower-court", "upper-court", "summit-sanctuary"],
      connectorIds: []
    }];
    if (scene.dungeon.W >= 44) routes.push({
      id: "secondary-route", role: "secondary-route", required: false,
      regionIds: ["lower-court", "upper-court", "summit-sanctuary"],
      connectorIds: []
    });
    routes.forEach(function (route, routeIndex) {
      var secondary = routeIndex > 0;
      var sides = routeSides(scene.intent.variant, secondary);
      var offset = (secondary && scene.intent.variant === "axial" ? -5 : (secondary ? 3 : 0)) + heightBias;
      var specs = [
        { bounds: scene._bounds.approach, from: "approach", to: "lower-court", low: 0, high: 5, suffix: "approach-lower" },
        { bounds: scene._bounds.upper, from: "lower-court", to: "upper-court", low: 5, high: 10, suffix: "lower-upper" },
        { bounds: scene._bounds.summit, from: "upper-court", to: "summit-sanctuary", low: 10, high: 15, suffix: "upper-summit" }
      ];
      if (secondary) specs.shift();
      specs.forEach(function (spec, specIndex) {
        var sideIndex = secondary ? specIndex + 1 : specIndex;
        var id = route.id + "-" + spec.suffix;
        var path = stairPath(spec.bounds, sides[sideIndex], offset, spec.low, spec.high);
        var connector = buildStair(id, route.id, route.role, spec.from, spec.to, path, profile);
        scene.connectors.push(connector);
        route.connectorIds.push(id);
        scene.intent.connectorPurposes[id] = clone(connector.purpose);
        path.forEach(function (p, pointIndex) {
          var i = idx(scene.dungeon.W, p.c, p.r);
          scene.dungeon.grid[i] = CELL.FLOOR;
          scene.h[i] = p.elevationFt;
          var regionId = pointIndex === 0 ? spec.from : spec.to;
          scene._regionLookup[key(p.c, p.r)] = regionId;
          scene.dungeon.roomId[i] = ["approach", "lower-court", "upper-court", "summit-sanctuary"].indexOf(regionId);
        });
      });
    });
    scene.intent.routes = routes;
  }

  function applyTempleDecor(scene, options) {
    var summit = scene.intent.regions.filter(function (r) { return r.id === "summit-sanctuary"; })[0];
    var blocked = {};
    scene.connectors.forEach(function (c) { c.path.forEach(function (p) { blocked[key(p.c, p.r)] = true; }); });
    var cells = summit.cells;
    var candidates = [cells[0], cells[cells.length - 1], cells[Math.floor(cells.length / 3)], cells[Math.floor(cells.length * 2 / 3)]];
    var count = Math.max(0, Math.min(candidates.length, Math.round(Number(options.decorDensity) * candidates.length)));
    var shift = (Number(options.decorSeed) >>> 0) % candidates.length;
    for (var i = 0; i < count; i++) {
      var p = candidates[(i + shift) % candidates.length];
      if (!p || blocked[key(p.c, p.r)]) continue;
      scene.dungeon.props.push({ kind: "pillar", x: p.c, y: p.r, rot: 0, scale: 1, roomId: 3 });
    }
  }

  function validateScene(scene) {
    var errors = [], d = scene && scene.dungeon, intent = scene && scene.intent;
    var connectors = scene && scene.connectors || [];
    if (!d || !d.valid) errors.push("dungeon document is missing or invalid");
    if (!intent || intent.archetype !== "temple-terraces") errors.push("Temple intent is missing");
    if (!d) return { ok: false, errors: errors };
    var n = d.W * d.H;
    if (!Array.isArray(d.grid) || d.grid.length !== n || !Array.isArray(scene.h) || scene.h.length !== n) errors.push("Temple cell arrays are malformed");
    var regionIds = {};
    (intent && intent.regions || []).forEach(function (r) {
      if (regionIds[r.id]) errors.push("duplicate region " + r.id);
      regionIds[r.id] = r;
      if (!Array.isArray(r.cells) || r.cells.length < 16) errors.push("region " + r.id + " has no usable platform");
    });
    var primary = (intent && intent.routes || []).filter(function (r) { return r.role === "primary-ascent" && r.required; });
    if (primary.length !== 1) errors.push("Temple requires exactly one primary ascent");
    else if (primary[0].regionIds.join(",") !== "approach,lower-court,upper-court,summit-sanctuary") errors.push("primary ascent omits a required Temple region");
    var purposes = intent && intent.connectorPurposes || {};
    var connectorCells = {};
    connectors.forEach(function (c) {
      var p = purposes[c.id];
      if (!p || p.routeId !== (c.purpose && c.purpose.routeId)) errors.push("connector " + c.id + " lacks matching route purpose");
      if (!regionIds[p && p.fromRegionId] || !regionIds[p && p.toRegionId]) errors.push("connector " + c.id + " names an unknown region");
      if (!Array.isArray(c.path) || c.path.length < 3) errors.push("connector " + c.id + " is not an architectural stair run");
      (c.path || []).forEach(function (point, pointIndex) {
        connectorCells[key(point.c, point.r)] = true;
        if (!inBounds(d, point.c, point.r)) errors.push("connector " + c.id + " leaves the map");
        else {
          var i = idx(d.W, point.c, point.r);
          if (d.grid[i] !== CELL.FLOOR) errors.push("connector " + c.id + " does not cut a retaining-wall gap");
          if (scene.h[i] !== point.elevationFt) errors.push("connector " + c.id + " height record disagrees with its path");
        }
        if (pointIndex > 0) {
          var prior = c.path[pointIndex - 1];
          if (Math.abs(prior.c - point.c) + Math.abs(prior.r - point.r) !== 1) errors.push("connector " + c.id + " path is not cardinally continuous");
        }
      });
      if (c.path && c.path.length) {
        var first = c.path[0], last = c.path[c.path.length - 1];
        var fromRegion = p && regionIds[p.fromRegionId], toRegion = p && regionIds[p.toRegionId];
        if (fromRegion && toRegion && (first.elevationFt !== fromRegion.elevationFt || last.elevationFt !== toRegion.elevationFt)) {
          errors.push("connector " + c.id + " endpoint elevation disagrees with its regions");
        }
        [first, last].forEach(function (landing) {
          var open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(function (step) {
            var c2 = landing.c + step[0], r2 = landing.r + step[1];
            return inBounds(d, c2, r2) && d.grid[idx(d.W, c2, r2)] === CELL.FLOOR;
          }).length;
          if (open < 2) errors.push("connector " + c.id + " has no clear landing");
        });
      }
    });
    (d.props || []).forEach(function (prop) {
      if (connectorCells[key(prop.x != null ? prop.x : prop.c, prop.y != null ? prop.y : prop.r)]) errors.push("decor obstructs an authored connector");
    });
    if (intent && intent.regions && intent.regions.length) {
      var firstCells = Array.isArray(intent.regions[0].cells) ? intent.regions[0].cells : [];
      var start = firstCells[0], seen = {}, queue = start ? [start] : [];
      if (start) seen[key(start.c, start.r)] = true;
      while (queue.length) {
        var current = queue.shift();
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (step) {
          var c2 = current.c + step[0], r2 = current.r + step[1], k = key(c2, r2);
          if (!seen[k] && inBounds(d, c2, r2) && d.grid[idx(d.W, c2, r2)] === CELL.FLOOR) {
            seen[k] = true; queue.push({ c: c2, r: r2 });
          }
        });
      }
      intent.regions.forEach(function (region) {
        if (!region.cells.some(function (cell) { return seen[key(cell.c, cell.r)]; })) errors.push("region " + region.id + " is unreachable");
      });
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function localRepair(scene) {
    if (!scene || !scene.dungeon) return null;
    var repaired = clone(scene), blocked = {};
    repaired.connectors.forEach(function (connector) {
      connector.path.forEach(function (p) {
        blocked[key(p.c, p.r)] = true;
        if (inBounds(repaired.dungeon, p.c, p.r)) {
          var i = idx(repaired.dungeon.W, p.c, p.r);
          repaired.dungeon.grid[i] = CELL.FLOOR;
          repaired.h[i] = p.elevationFt;
        }
      });
    });
    repaired.dungeon.props = repaired.dungeon.props.filter(function (p) {
      return !blocked[key(p.x != null ? p.x : p.c, p.y != null ? p.y : p.r)];
    });
    return repaired;
  }

  function generate(options) {
    options = options || {};
    if (options.themeKey == null) options = Object.assign({}, options, { themeKey: "temple" });
    var scene = layoutTemple(options);
    scene.constructionProfile = constructionProfile(options.themeKey);
    buildRoutes(scene, options);
    applyTempleDecor(scene, options);
    var verdict = validateScene(scene);
    if (!verdict.ok) { scene = localRepair(scene); verdict = scene ? validateScene(scene) : verdict; }
    if (!scene || !verdict.ok) throw new Error("forge-temple-terraces: invalid scene — " + verdict.errors.join("; "));
    scene.dungeon.spawns = [];
    delete scene._bounds;
    delete scene._regionLookup;
    return scene;
  }

  return {
    VERSION: VERSION,
    PROFILES: PROFILES,
    constructionProfile: constructionProfile,
    generate: generate,
    validateScene: validateScene,
    _internals: { layoutTemple: layoutTemple, buildStair: buildStair, localRepair: localRepair }
  };
});
