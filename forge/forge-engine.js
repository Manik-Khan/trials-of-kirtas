/* ── forge-engine.js ──────────────────────────────────────────────────
   Battle Forge ENGINE. Turns the proven dungeon generator (forge-dungeon)
   into a single, reliable, combat-ready pipeline:

     params ──▶ generate() ──▶ finished MAP (bridge contract + spawns)

   CONTROL     DM params: seed, biome, size, height mode + verticality,
               party/foe counts, water handling.
   COMPLETION  one call yields walls + per-tile heights + PC & foe spawns,
               ready to hand straight to tactics-geometry via map-bridge.
   RELIABILITY every returned map is validated: connected, spawnable, and
               PC↔foe mutually reachable — or it retries the seed. It never
               hands back a broken battlefield.

   Depends on forge-dungeon.js and map-bridge.js.
   Dual export: browser (window.ForgeEngine) + node.                        */
(function (root, factory) {
  var FD = (typeof require !== "undefined") ? require("./forge-dungeon.js") : root.ForgeDungeon;
  var MB = (typeof require !== "undefined") ? require("./map-bridge.js") : root.MapBridge;
  var GF = (typeof require !== "undefined") ? require("./forge-generator-foundation.js") : root.ForgeGeneratorFoundation;
  var api = factory(FD, MB, GF);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeEngine = api;
})(typeof self !== "undefined" ? self : this, function (FD, MB, GF) {

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
  function chebyshev(a, b) { return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r)); }

  var DEFAULTS = {
    roomCount: 8, loopChance: 0.2, decorDensity: 0.7,
    themeKey: null,                 // null → random biome
    heightMode: "tiered",           // "tiered" | "flat"
    verticality: 5,                 // feet per height tier (5 == one walkable step)
    party: 4, foes: 5,
    poolBlocks: false, waterBlocks: true,
    retries: 24
  };

  /* per-tile height (in tiers): rooms take a depth tier, corridors/edges are
     relaxed from their neighbours so the field flows instead of stepping hard. */
  function tierField(d) {
    var cols = d.W, rows = d.H, n = cols * rows, F = MB.CELL.FLOOR, P = MB.CELL.POOL;
    var maxD = Math.max(1, d.maxDepth || Math.max.apply(null, d.rooms.map(function (r) { return r.depth; })));
    var tierOf = function (r) { return Math.round((1 - r.depth / maxD) * 5); };  // entrance high → deep low
    var roomTier = {}; d.rooms.forEach(function (r) { roomTier[r.id] = tierOf(r); });
    var h = new Float32Array(n).fill(-1);
    for (var i = 0; i < n; i++) {
      var v = d.grid[i];
      if (v === F || v === P) {
        var rid = d.roomId ? d.roomId[i] : -1;
        h[i] = (rid >= 0 && roomTier[rid] != null) ? roomTier[rid] : -1;
      }
    }
    for (var pass = 0; pass < 6; pass++) {              // relax unset (corridor) cells from neighbours
      for (var y = 1; y < rows - 1; y++) for (var x = 1; x < cols - 1; x++) {
        var k = y * cols + x; if (h[k] >= 0 || d.grid[k] === MB.CELL.WALL || d.grid[k] === MB.CELL.VOID) continue;
        var s = 0, c = 0, nb = [[1,0],[-1,0],[0,1],[0,-1]];
        for (var e = 0; e < 4; e++) { var j = (y + nb[e][1]) * cols + (x + nb[e][0]); if (h[j] >= 0) { s += h[j]; c++; } }
        if (c) h[k] = Math.round(s / c);
      }
    }
    for (var m = 0; m < n; m++) h[m] = Math.max(0, h[m] < 0 ? 0 : h[m]);
    return h;
  }

  function bfsReach(map, start) {
    var seen = new Set(), q = [start]; seen.add(start.c + "," + start.r);
    var nb = [[1,0],[-1,0],[0,1],[0,-1]];
    while (q.length) {
      var n = q.shift();
      for (var i = 0; i < 4; i++) {
        var c = n.c + nb[i][0], r = n.r + nb[i][1], key = c + "," + r;
        if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) continue;
        if (seen.has(key) || map.wall[idx(map.cols, c, r)]) continue;
        seen.add(key); q.push({ c: c, r: r });
      }
    }
    return seen;
  }
  function nearestOpen(map, cx, cy, want, taken) {
    var out = [], R = Math.max(map.cols, map.rows);
    for (var rad = 0; rad <= R && out.length < want; rad++) {
      for (var dy = -rad; dy <= rad; dy++) for (var dx = -rad; dx <= rad; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        var c = cx + dx, r = cy + dy, key = c + "," + r;
        if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) continue;
        if (map.wall[idx(map.cols, c, r)] || taken.has(key)) continue;
        taken.add(key); out.push({ c: c, r: r });
        if (out.length >= want) return out;
      }
    }
    return out;
  }

  function build(d, p) {
    var map = MB.dungeonToMap(d, { poolBlocks: p.poolBlocks });
    var cols = map.cols;
    if (p.heightMode === "tiered") {
      var tf = tierField(d);
      for (var i = 0; i < tf.length; i++) map.h[i] = map.wall[i] ? 0 : tf[i] * p.verticality;
    } // flat mode leaves h at 0

    var taken = new Set();
    var entrance = d.rooms.filter(function (r) { return r.type === "entrance"; })[0] || d.rooms[0];
    var pcs = nearestOpen(map, Math.round(entrance.cx), Math.round(entrance.cy), p.party, taken)
      .map(function (s) { return { c: s.c, r: s.r, side: "pc" }; });

    // foe spawns: prefer the generator's own spawn points, away from the entrance room, deeper first
    var eid = entrance.id;
    var cand = (d.spawns || []).map(function (s) { return { c: s.x, r: s.y, roomId: s.roomId, tier: s.tier }; })
      .filter(function (s) { return s.roomId !== eid && !map.wall[idx(cols, s.c, s.r)] && !taken.has(s.c + "," + s.r); })
      .sort(function (a, b) { return (a.tier || 0) - (b.tier || 0); });   // lower tier == deeper == higher difficulty
    var foes = [];
    for (var j = 0; j < cand.length && foes.length < p.foes; j++) {
      var key = cand[j].c + "," + cand[j].r; if (taken.has(key)) continue;
      taken.add(key); foes.push({ c: cand[j].c, r: cand[j].r, side: "foe" });
    }
    if (foes.length < p.foes && d.boss != null) {                          // top up near the boss room
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

  /* the reliability gate: everything a combat map must satisfy */
  function verify(map) {
    if (!MB.validate(map).ok) return false;
    var pcs = map.spawns.filter(function (s) { return s.side === "pc"; });
    var foes = map.spawns.filter(function (s) { return s.side === "foe"; });
    if (!pcs.length || !foes.length) return false;
    if (map.spawns.some(function (s) { return map.wall[idx(map.cols, s.c, s.r)]; })) return false;
    var reach = bfsReach(map, { c: pcs[0].c, r: pcs[0].r });               // PC↔foe mutual reachability
    return map.spawns.every(function (s) { return reach.has(s.c + "," + s.r); });
  }

  function randomSeed() { return (Math.random() * 0xffffffff) >>> 0; }

  /* the one call: params → a finished, verified, combat-ready map */
  function generate(params) {
    var p = Object.assign({}, DEFAULTS, params || {});
    if (p.themeKey != null && FD.THEME_KEYS.indexOf(p.themeKey) < 0) {
      throw new Error("forge-engine: unknown themeKey \"" + p.themeKey + "\" (expected one of: " + FD.THEME_KEYS.join(", " ) + ")");
    }
    var seed = (p.seed != null ? p.seed : randomSeed()) >>> 0;
    var rng = mulberry32(seed ^ 0x9e3779b9);
    var themes = FD.THEME_KEYS;
    for (var attempt = 0; attempt < p.retries; attempt++) {
      var s = (seed + attempt * 0x9e3779b1) >>> 0;
      var theme = p.themeKey || themes[Math.floor(rng() * themes.length)];
      var d = FD.generateDungeon({
        seed: s, roomCount: p.roomCount, loopChance: p.loopChance,
        decorDensity: p.decorDensity, themeKey: theme
      });
      if (!d || !d.valid) continue;
      var map = build(d, Object.assign({}, p, { themeKey: theme }));
      if (verify(map)) { map.meta.attempts = attempt + 1; map.meta.requestedSeed = seed; return map; }
    }
    throw new Error("forge-engine: no valid combat map after " + p.retries + " attempts (seed " + seed + ")");
  }

  /* Session load is snapshot-first. A present snapshot is authoritative and
     must verify; only an envelope with NO mapSnapshot may use the legacy recipe. */
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
    loadEncounter: loadEncounter,
    randomSeed: randomSeed,
    THEME_KEYS: FD.THEME_KEYS,
    DEFAULTS: DEFAULTS,
    _internals: { tierField: tierField, bfsReach: bfsReach, verify: verify }
  };
});
