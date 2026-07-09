/* ── map-bridge.js ────────────────────────────────────────────────────
   The seam between the map generators (Battle Forge dungeon + the
   topography heightfield) and the combat engine (tactics-geometry.js).

   Both generators already index their grids row-major as y*W+x, which is
   exactly r*cols+c in the combat MAP contract, so this is a straight
   translation — no re-indexing, no rewrite.

   Combat MAP contract (consumed by tactics-geometry.js):
     { cols, rows, h:[feet]|Float, wall:[bool], occ:[feet] }  indexed r*cols+c
   `occ[i]` is the height in FEET of whatever stands on cell i, above h[i]:
   0 for open ground, 4.5 for a boulder, 10.5 for a temple wall. Sight is
   h+occ against the 3D ray, so a pit can never block and a rise always can.
   The heights are the generator's own — SKINS.wallH and the flavour scales
   that the biome renderer already draws with — not numbers invented here.
   plus optional passthrough this layer adds for the renderer/turn setup:
     { spawns:[{c,r,side,key?}], props:[{kind,c,r,rot,scale}], meta:{...} }

   Dual export: browser (window.MapBridge) + node (module.exports).        */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MapBridge = api;
})(typeof self !== "undefined" ? self : this, function () {

  var FEET_PER_LEVEL = 5;   // one height tier === one 5-ft step (matches STEP_FT)
  var UNITS_TO_FEET  = 5;   // the renderer's world unit is one 5-ft square

  /* Biome wall heights, lifted verbatim from SKINS.wallH in the Battle Forge
     biome mock (world units). ×5 = feet. A grass bank is 7 ft: total cover
     from the ground, clear from one tier up. A temple wall is 10.5 ft.
     Keyed by the generator's own theme names (forge-dungeon.js THEMES), which
     are the biome names. `volcanic` has no SKINS entry yet — 1.7 is a placeholder
     until the renderer authors one. Ideally forge-dungeon grows a `wallH` field
     so the generator and the renderer stop holding this number in two places. */
  var BIOME_WALL_UNITS = {
    grass: 1.4, druidic: 1.6, tundra: 1.5, swamp: 1.25,
    temple: 2.1, cavern: 1.9, volcanic: 1.7
  };
  var DEFAULT_WALL_UNITS = 2.0;

  /* Prop occluder heights in world units, before the prop's own `scale`.
     Anything absent from this table is flat dressing and occludes nothing —
     moss, cracks, bones, banners, icicles hanging from a ceiling. */
  var PROP_UNITS = {
    pillar: 3.0, column: 3.0, bossCrystal: 1.8, shrineCrystal: 1.4,
    stalagmite: 1.0, crystalCluster: 0.8, rock: 0.9, boulder: 0.9,
    tree: 1.1, cypress: 1.2, snowpine: 1.1, bare: 1.0,
    reed: 0.7, grass: 0.5, mushroom: 0.4,
    chest: 0.6, grave: 0.7, torch: 0.0, debris: 0.3
  };

  function wallFeetFor(themeKey, override) {
    if (override != null) return override;
    var u = BIOME_WALL_UNITS[themeKey];
    return (u != null ? u : DEFAULT_WALL_UNITS) * UNITS_TO_FEET;
  }
  function propFeet(p, table) {
    var u = (table && table[p.kind] != null) ? table[p.kind] : PROP_UNITS[p.kind];
    if (u == null) return 0;
    return u * (p.scale || 1) * UNITS_TO_FEET;
  }
  /* Rasterise the prop list onto occ[]: the tallest thing in a cell wins. */
  function stampProps(map, props, table) {
    if (!props || !props.length || !map.occ) return map;
    for (var i = 0; i < props.length; i++) {
      var p = props[i];
      var c = (p.c != null ? p.c : p.x), r = (p.r != null ? p.r : p.y);
      if (c == null || r == null) continue;
      if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) continue;
      var j = r * map.cols + c, ft = propFeet(p, table);
      if (ft > map.occ[j]) map.occ[j] = ft;
    }
    return map;
  }

  // dungeon grid cell constants (from generateDungeon)
  var VOID = 0, FLOOR = 1, WALL = 2, POOL = 3;
  // heightfield terrain-type constants (from the FIELD builder)
  var T_WATER = 0, T_GRASS = 1, T_STONE = 2, T_PLAZA = 3, T_ROCK = 4;

  function makeBlank(cols, rows) {
    var n = cols * rows;
    return { cols: cols, rows: rows, h: new Array(n).fill(0),
             wall: new Array(n).fill(false), occ: new Array(n).fill(0) };
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
    var wallFt = wallFeetFor(opts.themeKey || (d.params && d.params.themeKey), opts.wallFeet);
    for (var i = 0; i < grid.length; i++) {
      var cell = grid[i];
      map.wall[i] = (cell === WALL || cell === VOID || (poolBlocks && cell === POOL));
      // VOID is off-map rock: opaque. A WALL is a real wall of a known height,
      // so a shooter high enough, or standing back far enough, can see over it.
      map.occ[i] = (cell === VOID) ? Infinity : (cell === WALL ? wallFt : 0);
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
    stampProps(map, map.props, opts.propHeights);
    map.meta = { source: "dungeon", name: d.name, seed: d.seed,
                 themeKey: d.params && d.params.themeKey,
                 wallFeet: wallFt };
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
    var rockFt = opts.rockFeet != null ? opts.rockFeet : wallFeetFor(opts.themeKey, opts.wallFeet);
    for (var i = 0; i < cols * rows; i++) {
      map.h[i] = Math.round(f.height[i]) * fpl;                 // quantise to the 5-ft grid
      map.wall[i] = (waterBlocks && f.type && f.type[i] === T_WATER)
                 || (f.foot && !f.foot[i])
                 || (f.type && f.type[i] === T_ROCK);
      // Terrain occludes by its own height alone — the heightfield IS the
      // geometry. T_ROCK additionally carries a wall on top of its tier.
      map.occ[i] = (f.type && f.type[i] === T_ROCK) ? rockFt : 0;
    }
    map.props = normProps(f.props);
    stampProps(map, map.props, opts.propHeights);
    map.meta = { source: "heightfield", rockFeet: rockFt };
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
      if (map.occ && map.occ.length !== n) errs.push("occ[] length !== cols*rows");
    }
    return { ok: errs.length === 0, errors: errs };
  }

  return {
    FEET_PER_LEVEL: FEET_PER_LEVEL,
    BIOME_WALL_UNITS: BIOME_WALL_UNITS, PROP_UNITS: PROP_UNITS,
    wallFeetFor: wallFeetFor, propFeet: propFeet, stampProps: stampProps,
    dungeonToMap: dungeonToMap,
    fieldToMap: fieldToMap,
    validate: validate,
    CELL: { VOID: VOID, FLOOR: FLOOR, WALL: WALL, POOL: POOL },
    TYPE: { T_WATER: T_WATER, T_GRASS: T_GRASS, T_STONE: T_STONE, T_PLAZA: T_PLAZA, T_ROCK: T_ROCK }
  };
});
