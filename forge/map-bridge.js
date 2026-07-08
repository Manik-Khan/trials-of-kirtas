/* ── map-bridge.js ────────────────────────────────────────────────────
   The seam between the map generators (Battle Forge dungeon + the
   topography heightfield) and the combat engine (tactics-geometry.js).

   Both generators already index their grids row-major as y*W+x, which is
   exactly r*cols+c in the combat MAP contract, so this is a straight
   translation — no re-indexing, no rewrite.

   Combat MAP contract (consumed by tactics-geometry.js):
     { cols, rows, h:[feet]|Float, wall:[bool] }   indexed r*cols+c
   plus optional passthrough this layer adds for the renderer/turn setup:
     { spawns:[{c,r,side,key?}], props:[{kind,c,r,rot,scale}], meta:{...} }

   Dual export: browser (window.MapBridge) + node (module.exports).        */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MapBridge = api;
})(typeof self !== "undefined" ? self : this, function () {

  var FEET_PER_LEVEL = 5;   // one height tier === one 5-ft step (matches STEP_FT)

  // dungeon grid cell constants (from generateDungeon)
  var VOID = 0, FLOOR = 1, WALL = 2, POOL = 3;
  // heightfield terrain-type constants (from the FIELD builder)
  var T_WATER = 0, T_GRASS = 1, T_STONE = 2, T_PLAZA = 3, T_ROCK = 4;

  function makeBlank(cols, rows) {
    var n = cols * rows;
    return { cols: cols, rows: rows, h: new Array(n).fill(0), wall: new Array(n).fill(false) };
  }
  function normSpawns(list) {
    if (!list || !list.length) return [];
    return list.map(function (s) {
      return {
        c: (s.c != null ? s.c : s.x),
        r: (s.r != null ? s.r : s.y),
        side: s.side || null,
        key: s.key || s.id || null
      };
    }).filter(function (s) { return s.c != null && s.r != null; });
  }
  function normProps(list) {
    if (!list || !list.length) return [];
    return list.map(function (p) {
      return { kind: p.kind, c: (p.c != null ? p.c : p.x), r: (p.r != null ? p.r : p.y),
               rot: p.rot || 0, scale: p.scale || 1 };
    });
  }

  /* Battle Forge dungeon → combat MAP.
     opts.tiered   : use the depth tier for height (entrance high → deep low)
     opts.tierOf   : (room)=>level, when tiered; else flat
     opts.poolBlocks (default false): treat water pools as impassable       */
  function dungeonToMap(d, opts) {
    opts = opts || {};
    var cols = d.W, rows = d.H, grid = d.grid;
    var map = makeBlank(cols, rows);
    var poolBlocks = !!opts.poolBlocks;
    for (var i = 0; i < grid.length; i++) {
      var cell = grid[i];
      map.wall[i] = (cell === WALL || cell === VOID || (poolBlocks && cell === POOL));
    }
    // optional height tiers, keyed by the room each floor tile belongs to
    if (opts.tiered && typeof opts.tierOf === "function" && d.roomId && d.rooms) {
      var roomById = {};
      d.rooms.forEach(function (rm) { roomById[rm.id] = rm; });
      for (var j = 0; j < grid.length; j++) {
        if (map.wall[j]) continue;
        var rm2 = roomById[d.roomId[j]];
        map.h[j] = (rm2 ? opts.tierOf(rm2) : 0) * FEET_PER_LEVEL;
      }
    }
    map.spawns = normSpawns(d.spawns && d.spawns.length ? d.spawns
      : [].concat(d.entrance ? [{ x: d.entrance.x, y: d.entrance.y, side: "pc" }] : [],
                  d.boss ? [{ x: d.boss.x, y: d.boss.y, side: "foe", key: "boss" }] : []));
    map.props = normProps(d.props);
    map.meta = { source: "dungeon", name: d.name, seed: d.seed, themeKey: d.params && d.params.themeKey };
    return map;
  }

  /* Topography heightfield (FIELD) → combat MAP.
     opts.feetPerLevel (default 5): feet per height unit
     opts.waterBlocks  (default true): deep-water tiles are impassable       */
  function fieldToMap(f, opts) {
    opts = opts || {};
    var cols = f.W, rows = f.H;
    var fpl = opts.feetPerLevel != null ? opts.feetPerLevel : FEET_PER_LEVEL;
    var waterBlocks = opts.waterBlocks !== false;
    var map = makeBlank(cols, rows);
    for (var i = 0; i < cols * rows; i++) {
      map.h[i] = Math.round(f.height[i]) * fpl;                 // quantise to the 5-ft grid
      map.wall[i] = waterBlocks && f.type && f.type[i] === T_WATER;
    }
    map.props = normProps(f.props);
    map.meta = { source: "heightfield" };
    return map;
  }

  /* Cheap integrity check so a bad generator payload fails loud, not weird. */
  function validate(map) {
    var errs = [];
    if (!map || typeof map.cols !== "number" || typeof map.rows !== "number") errs.push("missing cols/rows");
    else {
      var n = map.cols * map.rows;
      if (!map.h || map.h.length !== n) errs.push("h[] length !== cols*rows");
      if (!map.wall || map.wall.length !== n) errs.push("wall[] length !== cols*rows");
    }
    return { ok: errs.length === 0, errors: errs };
  }

  return {
    FEET_PER_LEVEL: FEET_PER_LEVEL,
    dungeonToMap: dungeonToMap,
    fieldToMap: fieldToMap,
    validate: validate,
    CELL: { VOID: VOID, FLOOR: FLOOR, WALL: WALL, POOL: POOL },
    TYPE: { T_WATER: T_WATER, T_GRASS: T_GRASS, T_STONE: T_STONE, T_PLAZA: T_PLAZA, T_ROCK: T_ROCK }
  };
});
