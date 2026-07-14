/* ── forge-engine.js ──────────────────────────────────────────────────
   Battle Forge ENGINE. Turns forge-dungeon into one deterministic,
   validated combat-map pipeline.

   Phase 2d adds true stage ownership. New parameter records run the current
   legacy room-and-corridor grammar through five isolated streams:

     layout → height → semantics → decor → foes

   A retry advances only the stage that failed. Version-1 parameter records
   keep the old monolithic profile so snapshot-less legacy sessions remain
   reproducible. Snapshots remain authoritative on load.

   Depends on forge-dungeon.js, map-bridge.js, and
   forge-generator-foundation.js. Dual browser/Node export.               */
(function (root, factory) {
  var FD = (typeof require !== "undefined") ? require("./forge-dungeon.js") : root.ForgeDungeon;
  var MB = (typeof require !== "undefined") ? require("./map-bridge.js") : root.MapBridge;
  var GF = (typeof require !== "undefined") ? require("./forge-generator-foundation.js") : root.ForgeGeneratorFoundation;
  var api = factory(FD, MB, GF);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeEngine = api;
})(typeof self !== "undefined" ? self : this, function (FD, MB, GF) {
  "use strict";

  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function idx(cols, c, r) { return r * cols + c; }
  function key(c, r) { return c + "," + r; }
  function copyObject(value) {
    if (GF && GF._internals && typeof GF._internals.clonePlain === "function") return GF._internals.clonePlain(value);
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
  function stable(value) {
    if (GF && GF._internals && typeof GF._internals.stableStringify === "function") return GF._internals.stableStringify(value);
    return JSON.stringify(value);
  }
  function fp(value) {
    var h = GF && typeof GF.hash32 === "function" ? GF.hash32(stable(value)) : 0;
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  function shuffle(a, rng) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function stageAttemptSeed(seed, stage, attempt) {
    if (GF && typeof GF.stageAttemptSeed === "function") return GF.stageAttemptSeed(seed, stage, attempt);
    return ((seed >>> 0) + Math.imul((attempt + 1) >>> 0, 0x9e3779b1)) >>> 0;
  }

  var DEFAULTS = {
    roomCount: 8, loopChance: 0.2, decorDensity: 0.7,
    themeKey: null,
    heightMode: "tiered",
    verticality: 5,
    party: 4, foes: 5,
    poolBlocks: false, waterBlocks: true,
    retries: 24,
    generatorProfile: "stage-owned-legacy"
  };

  function bfsReach(map, start) {
    var seen = new Set(), q = [start]; seen.add(key(start.c, start.r));
    var nb = [[1,0],[-1,0],[0,1],[0,-1]];
    while (q.length) {
      var n = q.shift();
      for (var i = 0; i < 4; i++) {
        var c = n.c + nb[i][0], r = n.r + nb[i][1], k = key(c, r);
        if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) continue;
        if (seen.has(k) || map.wall[idx(map.cols, c, r)]) continue;
        seen.add(k); q.push({ c: c, r: r });
      }
    }
    return seen;
  }

  function verify(map) {
    var validation = MB.validate(map);
    if (!validation || !validation.ok) return false;
    var pcs = (map.spawns || []).filter(function (s) { return s.side === "pc"; });
    var foes = (map.spawns || []).filter(function (s) { return s.side === "foe"; });
    if (!pcs.length || !foes.length) return false;
    if (map.spawns.some(function (s) {
      return s.c < 0 || s.r < 0 || s.c >= map.cols || s.r >= map.rows || map.wall[idx(map.cols, s.c, s.r)];
    })) return false;
    var reach = bfsReach(map, pcs[0]);
    return map.spawns.every(function (s) { return reach.has(key(s.c, s.r)); });
  }

  function randomSeed() { return (Math.random() * 0xffffffff) >>> 0; }

  function generationParams(params) {
    var source = params || {};
    if (GF && typeof GF.recipeParams === "function" &&
        (source.parameters || source.parameterRecord || source.schema === GF.PARAMETER_SCHEMA)) {
      source = GF.recipeParams(source.schema === GF.PARAMETER_SCHEMA ? { parameters: source } : source);
    }
    var p = Object.assign({}, DEFAULTS, source);
    var seed = (p.seed != null ? p.seed : randomSeed()) >>> 0;
    p.seed = seed;
    if (GF && typeof GF.assertArchetype === "function") p.archetype = GF.assertArchetype(p.archetype);
    if (GF && typeof GF.assertGeneratorProfile === "function") p.generatorProfile = GF.assertGeneratorProfile(p.generatorProfile);
    p.stageSeeds = GF && typeof GF.stageSeeds === "function" ? GF.stageSeeds(seed, p.stageSeeds) : (p.stageSeeds || {});
    return p;
  }

  function chooseTheme(p) {
    if (p.themeKey != null) {
      if (FD.THEME_KEYS.indexOf(p.themeKey) < 0) {
        throw new Error("forge-engine: unknown themeKey \"" + p.themeKey + "\" (expected one of: " + FD.THEME_KEYS.join(", ") + ")");
      }
      return p.themeKey;
    }
    var seed = p.stageSeeds && p.stageSeeds.layout != null ? p.stageSeeds.layout : p.seed;
    var rng = mulberry32((seed ^ 0x41c6ce57) >>> 0);
    return FD.THEME_KEYS[Math.floor(rng() * FD.THEME_KEYS.length)];
  }

  /* ── Legacy monolithic profile (version-1 recipe compatibility) ───── */
  function legacyTierField(d) {
    var cols = d.W, rows = d.H, n = cols * rows, F = MB.CELL.FLOOR, P = MB.CELL.POOL;
    var maxD = Math.max(1, d.maxDepth || Math.max.apply(null, d.rooms.map(function (r) { return r.depth; })));
    var tierOf = function (r) { return Math.round((1 - r.depth / maxD) * 5); };
    var roomTier = {}; d.rooms.forEach(function (r) { roomTier[r.id] = tierOf(r); });
    var h = new Float32Array(n).fill(-1);
    for (var i = 0; i < n; i++) {
      var v = d.grid[i];
      if (v === F || v === P) {
        var rid = d.roomId ? d.roomId[i] : -1;
        h[i] = (rid >= 0 && roomTier[rid] != null) ? roomTier[rid] : -1;
      }
    }
    relaxHeights(d, h);
    return h;
  }

  function nearestOpen(map, cx, cy, want, taken) {
    var out = [], R = Math.max(map.cols, map.rows);
    for (var rad = 0; rad <= R && out.length < want; rad++) {
      for (var dy = -rad; dy <= rad; dy++) for (var dx = -rad; dx <= rad; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        var c = cx + dx, r = cy + dy, k = key(c, r);
        if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) continue;
        if (map.wall[idx(map.cols, c, r)] || taken.has(k)) continue;
        taken.add(k); out.push({ c: c, r: r });
        if (out.length >= want) return out;
      }
    }
    return out;
  }

  function legacyBuild(d, p) {
    var map = MB.dungeonToMap(d, { poolBlocks: p.poolBlocks });
    if (p.heightMode === "tiered") {
      var tf = legacyTierField(d);
      for (var i = 0; i < tf.length; i++) map.h[i] = map.wall[i] ? 0 : tf[i] * p.verticality;
    }
    var taken = new Set();
    var entrance = d.rooms.filter(function (r) { return r.type === "entrance"; })[0] || d.rooms[0];
    var pcs = nearestOpen(map, Math.round(entrance.cx), Math.round(entrance.cy), p.party, taken)
      .map(function (s) { return { c: s.c, r: s.r, side: "pc" }; });
    var eid = entrance.id;
    var cand = (d.spawns || []).map(function (s) { return { c: s.x, r: s.y, roomId: s.roomId, tier: s.tier }; })
      .filter(function (s) { return s.roomId !== eid && !map.wall[idx(map.cols, s.c, s.r)] && !taken.has(key(s.c, s.r)); })
      .sort(function (a, b) { return (a.tier || 0) - (b.tier || 0); });
    var foes = [];
    for (var j = 0; j < cand.length && foes.length < p.foes; j++) {
      var k = key(cand[j].c, cand[j].r); if (taken.has(k)) continue;
      taken.add(k); foes.push({ c: cand[j].c, r: cand[j].r, side: "foe" });
    }
    if (foes.length < p.foes && d.boss != null) {
      var boss = d.rooms.filter(function (r) { return r.id === d.boss; })[0];
      if (boss) nearestOpen(map, Math.round(boss.cx), Math.round(boss.cy), p.foes - foes.length, taken)
        .forEach(function (s) { foes.push({ c: s.c, r: s.r, side: "foe" }); });
    }
    map.spawns = pcs.concat(foes);
    map.meta = Object.assign(map.meta || {}, {
      source: "forge-engine", seed: d.seed, biome: p.themeKey, name: d.name,
      heightMode: p.heightMode, party: pcs.length, foes: foes.length
    });
    return map;
  }

  function generateLegacyDetailed(p) {
    var seed = p.seed >>> 0, rng = mulberry32(seed ^ 0x9e3779b9), themes = FD.THEME_KEYS;
    for (var attempt = 0; attempt < p.retries; attempt++) {
      var s = (seed + attempt * 0x9e3779b1) >>> 0;
      var theme = p.themeKey || themes[Math.floor(rng() * themes.length)];
      var d = FD.generateDungeon({
        seed: s, roomCount: p.roomCount, loopChance: p.loopChance,
        decorDensity: p.decorDensity, themeKey: theme
      });
      if (!d || !d.valid) continue;
      var effective = Object.assign({}, p, { seed: seed, themeKey: theme, generatorProfile: "legacy-dungeon" });
      var map = legacyBuild(d, effective);
      if (!verify(map)) continue;
      map.meta.attempts = attempt + 1;
      map.meta.requestedSeed = seed;
      if (GF && typeof GF.attachMeta === "function") GF.attachMeta(map, effective, d);
      return { map: map, dungeon: d, parameters: GF ? GF.parameterRecord(effective) : effective,
        stageAttempts: { layout: attempt + 1, height: 1, semantics: 1, decor: 1, foes: 1 }, stageFingerprints: null };
    }
    throw new Error("forge-engine: no valid combat map after " + p.retries + " attempts (seed " + seed + ")");
  }

  /* ── Stage-owned legacy grammar ─────────────────────────────────── */
  function graphFacts(d) {
    var N = d.rooms.length, adj = Array.from({ length: N }, function () { return []; });
    (d.edges || []).forEach(function (e, i) {
      if (!e || e.a < 0 || e.b < 0 || e.a >= N || e.b >= N) return;
      adj[e.a].push({ b: e.b, i: i }); adj[e.b].push({ b: e.a, i: i });
    });
    function distFrom(src) {
      var out = new Int32Array(N).fill(-1), q = [src]; out[src] = 0;
      for (var h = 0; h < q.length; h++) {
        var a = q[h];
        for (var j = 0; j < adj[a].length; j++) {
          var b = adj[a][j].b;
          if (out[b] < 0) { out[b] = out[a] + 1; q.push(b); }
        }
      }
      return out;
    }
    var boss = 0;
    for (var i = 1; i < N; i++) {
      var area = Number(d.rooms[i].w || 0) * Number(d.rooms[i].h || 0);
      var best = Number(d.rooms[boss].w || 0) * Number(d.rooms[boss].h || 0);
      if (area > best) boss = i;
    }
    var db = distFrom(boss), entrance = -1, bestD = -1;
    for (var k = 0; k < N; k++) {
      if (k !== boss && adj[k].length === 1 && db[k] > bestD) { bestD = db[k]; entrance = k; }
    }
    if (entrance < 0) {
      for (var k2 = 0; k2 < N; k2++) if (k2 !== boss && db[k2] > bestD) { bestD = db[k2]; entrance = k2; }
    }
    if (entrance < 0) entrance = boss === 0 && N > 1 ? 1 : 0;
    var depth = distFrom(entrance), maxDepth = 1;
    for (var x = 0; x < N; x++) if (depth[x] > maxDepth) maxDepth = depth[x];
    var parent = new Int32Array(N).fill(-1), parentEdge = new Int32Array(N).fill(-1), seen = new Uint8Array(N), qq = [entrance];
    seen[entrance] = 1;
    for (var qh = 0; qh < qq.length; qh++) {
      var aa = qq[qh];
      for (var z = 0; z < adj[aa].length; z++) {
        var link = adj[aa][z];
        if (!seen[link.b]) { seen[link.b] = 1; parent[link.b] = aa; parentEdge[link.b] = link.i; qq.push(link.b); }
      }
    }
    var criticalEdges = {}, criticalRooms = {}, cur = boss;
    while (cur >= 0) {
      criticalRooms[cur] = true;
      if (parentEdge[cur] >= 0) criticalEdges[parentEdge[cur]] = true;
      if (cur === entrance) break;
      cur = parent[cur];
    }
    return { adj: adj, entrance: entrance, boss: boss, depth: depth, maxDepth: maxDepth,
      criticalEdges: criticalEdges, criticalRooms: criticalRooms };
  }

  function applySemantics(d, semanticsSeed, facts) {
    facts = facts || graphFacts(d);
    var TYPE = FD.TYPE || {
      ENTRANCE: "entrance", COMBAT: "combat", ELITE: "elite", TREASURE: "treasure", SHRINE: "shrine", BOSS: "boss"
    };
    var rng = mulberry32((semanticsSeed ^ 0xb5297a4d) >>> 0);
    (d.edges || []).forEach(function (e, i) { e.isCritical = !!facts.criticalEdges[i]; });
    d.rooms.forEach(function (r, i) {
      r.type = TYPE.COMBAT || "combat";
      r.depth = Math.max(0, facts.depth[i]);
      r.difficulty = Math.min(1, 0.15 + 0.85 * (r.depth / facts.maxDepth));
      delete r.lake; delete r.grave; delete r.semanticMark;
    });
    d.rooms[facts.entrance].type = TYPE.ENTRANCE || "entrance";
    d.rooms[facts.entrance].difficulty = 0;
    d.rooms[facts.boss].type = TYPE.BOSS || "boss";
    d.rooms[facts.boss].difficulty = 1;

    var leaves = [];
    d.rooms.forEach(function (r, i) {
      if (i !== facts.entrance && i !== facts.boss && facts.adj[i].length === 1) leaves.push(i);
    });
    leaves.sort(function (a, b) { return d.rooms[b].depth - d.rooms[a].depth || a - b; });
    leaves.slice(0, 4).forEach(function (i) { d.rooms[i].type = TYPE.TREASURE || "treasure"; });

    var shrines = [], elites = [];
    d.rooms.forEach(function (r, i) {
      if (r.type !== (TYPE.COMBAT || "combat")) return;
      if (!facts.criticalRooms[i] && r.depth > facts.maxDepth * 0.3 && r.depth < facts.maxDepth * 0.8) shrines.push(i);
      if (facts.criticalRooms[i] && r.depth >= facts.maxDepth * 0.55 && r.depth <= facts.maxDepth * 0.85) elites.push(i);
    });
    shuffle(shrines, rng).slice(0, 2).forEach(function (i) { d.rooms[i].type = TYPE.SHRINE || "shrine"; });
    shuffle(elites, rng).slice(0, 2).forEach(function (i) {
      if (d.rooms[i].type === (TYPE.COMBAT || "combat")) d.rooms[i].type = TYPE.ELITE || "elite";
    });
    /* First-class objectives arrive in a later slice, but the semantics stream
       already owns a deterministic candidate mark so changing this seed has a
       visible, testable semantic result without touching topology. */
    var marks = d.rooms.map(function (r, i) { return { r: r, i: i }; }).filter(function (x) {
      return x.i !== facts.entrance && x.i !== facts.boss && x.r.type === (TYPE.COMBAT || "combat");
    });
    if (marks.length) marks[Math.floor(rng() * marks.length)].r.semanticMark = "objective-candidate";

    var theme = FD.THEMES && d.params ? FD.THEMES[d.params.themeKey] : null;
    if (theme && theme.lakes) {
      var lakeCandidates = d.rooms.map(function (r, i) { return { i: i, area: Number(r.w || 0) * Number(r.h || 0) }; })
        .filter(function (x) { var r = d.rooms[x.i]; return r.type === (TYPE.COMBAT || "combat") && x.area >= 9; });
      shuffle(lakeCandidates, rng).slice(0, 2).forEach(function (x) { d.rooms[x.i].lake = true; });
    }
    if (theme && theme.graveyards) {
      var graveCandidates = d.rooms.map(function (r, i) { return { i: i, area: Number(r.w || 0) * Number(r.h || 0) }; })
        .filter(function (x) { var r = d.rooms[x.i]; return r.type === (TYPE.COMBAT || "combat") && x.area >= 8; });
      shuffle(graveCandidates, rng).slice(0, 3).forEach(function (x) { d.rooms[x.i].grave = true; });
    }

    d.entrance = facts.entrance; d.boss = facts.boss; d.maxDepth = facts.maxDepth;
    if (d.stats) d.stats.critLen = Object.keys(facts.criticalEdges).length;
    return facts;
  }

  var SEMANTIC_PROP = {
    ring: 1, bossCrystal: 1, shrineCrystal: 1, chest: 1, banner: 1
  };
  function semanticProps(d, decorSeed) {
    var out = [], rng = mulberry32((decorSeed ^ 0x1b56c4e9) >>> 0), TYPE = FD.TYPE || {};
    d.rooms.forEach(function (r) {
      var x = Math.round(r.cx), y = Math.round(r.cy);
      if (r.type === (TYPE.ENTRANCE || "entrance")) out.push({ kind: "ring", x: x, y: y, rot: 0, scale: 1, roomId: r.id });
      else if (r.type === (TYPE.BOSS || "boss")) out.push({ kind: "bossCrystal", x: x, y: y, rot: rng() * Math.PI * 2, scale: 1, roomId: r.id });
      else if (r.type === (TYPE.SHRINE || "shrine")) out.push({ kind: "shrineCrystal", x: x, y: y, rot: rng() * Math.PI * 2, scale: 1, roomId: r.id });
      else if (r.type === (TYPE.TREASURE || "treasure")) out.push({ kind: "chest", x: x, y: y, rot: rng() * Math.PI * 2, scale: 1, roomId: r.id });
    });
    return out;
  }

  function applyDecor(d, candidateProps, candidateTorches, decorSeed, density) {
    var rng = mulberry32((decorSeed ^ 0x68e31da4) >>> 0), out = semanticProps(d, decorSeed), seen = {};
    out.forEach(function (p) { seen[p.kind + ":" + p.x + ":" + p.y] = true; });
    (candidateProps || []).forEach(function (p, index) {
      if (!p || SEMANTIC_PROP[p.kind]) return;
      var chance = Math.max(0, Math.min(1, Number(density)));
      /* Structural columns remain present at low density; flat dressing scales
         linearly with the authoring knob. */
      if (p.kind === "pillar" || p.kind === "column" || p.kind === "roots") chance = 0.35 + 0.65 * chance;
      if (rng() > chance) return;
      var q = Object.assign({}, p), k = q.kind + ":" + q.x + ":" + q.y;
      if (seen[k]) return;
      if (q.rot != null) q.rot = rng() * Math.PI * 2;
      if (q.scale != null) q.scale = Math.max(0.2, Number(q.scale || 1) * (0.9 + rng() * 0.2));
      q.stageIndex = index;
      seen[k] = true; out.push(q);
    });
    d.props = out;
    var torches = (candidateTorches || []).map(function (t) { return Object.assign({}, t); });
    shuffle(torches, rng);
    d.torches = torches.slice(0, Math.round(torches.length * Math.max(0, Math.min(1, Number(density)))));
    return d;
  }

  function relaxHeights(d, h) {
    var cols = d.W, rows = d.H, WALL = MB.CELL.WALL, VOID = MB.CELL.VOID;
    for (var pass = 0; pass < 6; pass++) {
      for (var y = 1; y < rows - 1; y++) for (var x = 1; x < cols - 1; x++) {
        var k = y * cols + x;
        if (h[k] >= 0 || d.grid[k] === WALL || d.grid[k] === VOID) continue;
        var s = 0, count = 0, nb = [[1,0],[-1,0],[0,1],[0,-1]];
        for (var e = 0; e < 4; e++) {
          var j = (y + nb[e][1]) * cols + (x + nb[e][0]);
          if (h[j] >= 0) { s += h[j]; count++; }
        }
        if (count) h[k] = Math.round(s / count);
      }
    }
    for (var i = 0; i < h.length; i++) h[i] = Math.max(0, h[i] < 0 ? 0 : h[i]);
    return h;
  }

  function heightField(d, p, heightSeed, facts) {
    var n = d.W * d.H, out = new Float32Array(n);
    if (p.heightMode === "flat") return out;
    facts = facts || graphFacts(d);
    var rng = mulberry32((heightSeed ^ 0x7f4a7c15) >>> 0), reverse = rng() < 0.5;
    var maxD = Math.max(1, facts.maxDepth || 1), roomTier = {};
    d.rooms.forEach(function (r, index) {
      var ratio = Math.max(0, Number(facts.depth[index] || 0)) / maxD;
      roomTier[r.id] = Math.round((reverse ? ratio : 1 - ratio) * 5);
    });
    var F = MB.CELL.FLOOR, P = MB.CELL.POOL, h = new Float32Array(n).fill(-1);
    for (var i = 0; i < n; i++) {
      if (d.grid[i] === F || d.grid[i] === P) {
        var rid = d.roomId ? d.roomId[i] : -1;
        h[i] = rid >= 0 && roomTier[rid] != null ? roomTier[rid] : -1;
      }
    }
    relaxHeights(d, h);
    for (var m = 0; m < n; m++) out[m] = h[m] * p.verticality;
    out._orientation = reverse ? "boss-high" : "entrance-high";
    return out;
  }

  function openCells(d, map, roomFilter) {
    var out = [], FLOOR = MB.CELL.FLOOR, POOL = MB.CELL.POOL;
    for (var r = 0; r < map.rows; r++) for (var c = 0; c < map.cols; c++) {
      var i = idx(map.cols, c, r), rid = d.roomId ? d.roomId[i] : -1;
      if (map.wall[i] || (d.grid[i] !== FLOOR && d.grid[i] !== POOL)) continue;
      if (!roomFilter || roomFilter(rid, c, r)) out.push({ c: c, r: r, roomId: rid });
    }
    return out;
  }

  function pickSpread(candidates, count, taken, minSep, rng) {
    var pool = shuffle(candidates.slice(), rng), out = [];
    function clear(q, sep) {
      if (taken.has(key(q.c, q.r))) return false;
      for (var i = 0; i < out.length; i++) if (Math.max(Math.abs(out[i].c - q.c), Math.abs(out[i].r - q.r)) <= sep) return false;
      return true;
    }
    for (var sep = minSep; sep >= 0 && out.length < count; sep--) {
      for (var j = 0; j < pool.length && out.length < count; j++) {
        var q = pool[j]; if (!clear(q, sep)) continue;
        taken.add(key(q.c, q.r)); out.push(q);
      }
    }
    return out;
  }

  function placeSpawns(map, d, p, foesSeed) {
    var rng = mulberry32((foesSeed ^ 0x94d049bb) >>> 0), taken = new Set();
    var entranceId = d.rooms[d.entrance] ? d.rooms[d.entrance].id : d.entrance;
    var bossId = d.rooms[d.boss] ? d.rooms[d.boss].id : d.boss;
    var pcCandidates = openCells(d, map, function (rid) { return rid === entranceId; });
    var pcs = pickSpread(pcCandidates, p.party, taken, 1, rng);
    if (pcs.length < p.party) {
      var er = d.rooms[d.entrance] || d.rooms[0];
      nearestOpen(map, Math.round(er.cx), Math.round(er.cy), p.party - pcs.length, taken).forEach(function (s) { pcs.push(s); });
    }
    var deepThreshold = Math.max(1, Math.floor((d.maxDepth || 1) * 0.55));
    var foeCandidates = openCells(d, map, function (rid) {
      if (rid < 0 || rid === entranceId) return false;
      var room = d.rooms.filter(function (r) { return r.id === rid; })[0];
      return rid === bossId || (room && Number(room.depth || 0) >= deepThreshold);
    });
    var foes = pickSpread(foeCandidates, p.foes, taken, 2, rng);
    if (foes.length < p.foes) {
      var br = d.rooms[d.boss] || d.rooms[d.rooms.length - 1];
      nearestOpen(map, Math.round(br.cx), Math.round(br.cy), p.foes - foes.length, taken).forEach(function (s) { foes.push(s); });
    }
    map.spawns = pcs.slice(0, p.party).map(function (s) { return { c: s.c, r: s.r, side: "pc", roomId: s.roomId == null ? entranceId : s.roomId }; })
      .concat(foes.slice(0, p.foes).map(function (s) { return { c: s.c, r: s.r, side: "foe", roomId: s.roomId == null ? bossId : s.roomId }; }));
    return map;
  }

  function stageFingerprints(d, map) {
    return {
      layout: fp({ W: d.W, H: d.H, grid: Array.from(d.grid || []), rooms: d.rooms.map(function (r) {
        return { id: r.id, cx: r.cx, cy: r.cy, w: r.w, h: r.h, shape: r.shape || null };
      }), edges: (d.edges || []).map(function (e) { return { a: e.a, b: e.b, isLoop: !!e.isLoop }; }) }),
      height: fp(Array.from(map.h || [])),
      semantics: fp({ entrance: d.entrance, boss: d.boss, maxDepth: d.maxDepth,
        rooms: d.rooms.map(function (r) { return { id: r.id, type: r.type, depth: r.depth, difficulty: r.difficulty, lake: !!r.lake, grave: !!r.grave, semanticMark: r.semanticMark || null }; }),
        critical: (d.edges || []).map(function (e) { return !!e.isCritical; }) }),
      decor: fp({ props: map.props || [], torches: d.torches || [] }),
      foes: fp(map.spawns || [])
    };
  }

  function generateStagedDetailed(p) {
    var theme = chooseTheme(p), seeds = p.stageSeeds, maxLayout = Math.max(1, p.retries), maxFoes = Math.max(1, Math.min(16, p.retries));
    for (var layoutAttempt = 0; layoutAttempt < maxLayout; layoutAttempt++) {
      var layoutSeed = stageAttemptSeed(seeds.layout, "layout", layoutAttempt);
      var d = FD.generateDungeon({
        seed: layoutSeed, roomCount: p.roomCount, loopChance: p.loopChance,
        /* Candidate decor is generated densely, then the decor stage owns the
           final selection. */
        decorDensity: 1, themeKey: theme
      });
      if (!d || !d.valid) continue;
      var candidateProps = (d.props || []).map(function (q) { return Object.assign({}, q); });
      var candidateTorches = (d.torches || []).map(function (q) { return Object.assign({}, q); });
      /* Structural graph facts are topology-derived, not a random stage. They
         let height run before semantic labels without borrowing semantics RNG. */
      var facts = graphFacts(d);
      var heights = heightField(d, p, seeds.height, facts);
      applySemantics(d, seeds.semantics, facts);
      applyDecor(d, candidateProps, candidateTorches, seeds.decor, p.decorDensity);
      var map = MB.dungeonToMap(d, { poolBlocks: p.poolBlocks });
      for (var i = 0; i < heights.length; i++) map.h[i] = map.wall[i] ? 0 : heights[i];

      for (var foeAttempt = 0; foeAttempt < maxFoes; foeAttempt++) {
        placeSpawns(map, d, p, stageAttemptSeed(seeds.foes, "foes", foeAttempt));
        if (!verify(map)) continue;
        var attempts = { layout: layoutAttempt + 1, height: 1, semantics: 1, decor: 1, foes: foeAttempt + 1 };
        var fingerprints = stageFingerprints(d, map);
        map.meta = Object.assign(map.meta || {}, {
          source: "forge-engine", seed: layoutSeed, requestedSeed: p.seed, biome: theme, name: d.name,
          heightMode: p.heightMode, party: p.party, foes: p.foes,
          attempts: layoutAttempt + 1,
          stageOwnership: { version: 1, profile: "stage-owned-legacy", seeds: copyObject(seeds), attempts: attempts, fingerprints: fingerprints }
        });
        var effective = Object.assign({}, p, { themeKey: theme, generatorProfile: "stage-owned-legacy" });
        if (GF && typeof GF.attachMeta === "function") GF.attachMeta(map, effective, d);
        return { map: map, dungeon: d, parameters: GF ? GF.parameterRecord(effective) : effective,
          stageAttempts: attempts, stageFingerprints: fingerprints };
      }
    }
    throw new Error("forge-engine: no valid staged combat map after " + p.retries + " layout attempts (seed " + p.seed + ")");
  }

  function generateDetailed(params) {
    var p = generationParams(params);
    if (p.generatorProfile === "legacy-dungeon") return generateLegacyDetailed(p);
    return generateStagedDetailed(p);
  }

  function generate(params) { return generateDetailed(params).map; }

  function loadEncounter(envelope) {
    if (!GF || typeof GF.resolveEncounter !== "function") {
      throw new Error("forge-engine: generator foundation did not load");
    }
    var resolved = GF.resolveEncounter(envelope, generate);
    var result = MB.validate(resolved.map);
    if (!result || !result.ok) {
      var why = result && (result.why || result.errors && result.errors.join(", "));
      throw new Error("forge-engine: saved combat map is invalid" + (why ? " — " + why : ""));
    }
    return resolved.map;
  }

  return {
    generate: generate,
    generateDetailed: generateDetailed,
    loadEncounter: loadEncounter,
    randomSeed: randomSeed,
    THEME_KEYS: FD.THEME_KEYS,
    DEFAULTS: DEFAULTS,
    _internals: {
      generationParams: generationParams,
      graphFacts: graphFacts,
      applySemantics: applySemantics,
      applyDecor: applyDecor,
      heightField: heightField,
      placeSpawns: placeSpawns,
      stageFingerprints: stageFingerprints,
      verify: verify,
      bfsReach: bfsReach,
      legacyTierField: legacyTierField
    }
  };
});
