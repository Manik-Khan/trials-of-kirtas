/* Forge Blueprint / Diorama proof · pure document + compiler authority.
   Browser: window.ForgeBlueprintProof. Node: module.exports.
   The proof is intentionally isolated from the production Forge. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeBlueprintProof = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SCHEMA = "forge-blueprint/v1";
  var CARDINAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var MATERIALS = Object.freeze({
    nave: { label: "Pale nave stone", color: 0xb8ae98, dark: 0x655f56 },
    cloister: { label: "Mossed cloister", color: 0x7e8a70, dark: 0x465044 },
    crypt: { label: "Blue crypt stone", color: 0x7a858a, dark: 0x414a4d },
    timber: { label: "Old oak", color: 0x846b4f, dark: 0x4b3a2b },
    water: { label: "Holy channel", color: 0x557d83, dark: 0x294c52 }
  });
  var KIT = Object.freeze({
    floor: { footprint: [1, 1], connectors: ["n", "e", "s", "w"], rotations: [0, 90, 180, 270], heightFt: 0, cover: null, opacity: 0, theme: "ruined-abbey", variants: ["plain", "cracked", "mossed"] },
    wall: { footprint: [1, 1], connectors: [], rotations: [0, 90, 180, 270], heightFt: 10, cover: "full", opacity: 1, theme: "ruined-abbey", variants: ["straight", "ruined"] },
    corner: { footprint: [1, 1], connectors: [], rotations: [0, 90, 180, 270], heightFt: 10, cover: "full", opacity: 1, theme: "ruined-abbey", variants: ["intact", "broken"] },
    lowWall: { footprint: [1, 1], connectors: ["n", "e", "s", "w"], rotations: [0, 90, 180, 270], heightFt: 3.5, cover: "half", opacity: 0.55, theme: "ruined-abbey", variants: ["straight", "crumbled"] },
    door: { footprint: [1, 1], connectors: ["axis"], rotations: [0, 90, 180, 270], heightFt: 8, cover: null, opacity: 0.2, theme: "ruined-abbey", variants: ["oak", "iron"] },
    arch: { footprint: [1, 1], connectors: ["axis"], rotations: [0, 90, 180, 270], heightFt: 10, cover: null, opacity: 0.35, theme: "ruined-abbey", variants: ["round", "ruined"] },
    window: { footprint: [1, 1], connectors: [], rotations: [0, 90, 180, 270], heightFt: 10, cover: "three-quarters", opacity: 0.65, theme: "ruined-abbey", variants: ["lancet", "broken"] },
    stairs: { footprint: [2, 1], connectors: ["low", "high"], rotations: [0, 90, 180, 270], heightFt: 5, cover: null, opacity: 0, theme: "ruined-abbey", variants: ["stone"] },
    pillar: { footprint: [1, 1], connectors: [], rotations: [0, 90, 180, 270], heightFt: 10, cover: "circle", opacity: 1, theme: "ruined-abbey", variants: ["whole", "broken"] },
    rubble: { footprint: [1, 1], connectors: ["n", "e", "s", "w"], rotations: [0, 90, 180, 270], heightFt: 2.5, cover: "half", opacity: 0.35, theme: "ruined-abbey", variants: ["small", "large"] },
    crates: { footprint: [1, 1], connectors: [], rotations: [0, 90, 180, 270], heightFt: 3.5, cover: "half", opacity: 0.65, theme: "ruined-abbey", variants: ["crate", "barrels"] },
    brazier: { footprint: [1, 1], connectors: [], rotations: [0, 90, 180, 270], heightFt: 4, cover: "half", opacity: 0.35, theme: "ruined-abbey", variants: ["lit"] },
    pool: { footprint: [1, 1], connectors: [], rotations: [0, 90, 180, 270], heightFt: 0, cover: null, opacity: 0, theme: "ruined-abbey", variants: ["pool", "channel"] },
    altar: { footprint: [1, 1], connectors: [], rotations: [0, 90, 180, 270], heightFt: 4.5, cover: "half", opacity: 0.8, theme: "ruined-abbey", variants: ["high-altar", "ruined"] },
    pew: { footprint: [1, 1], connectors: [], rotations: [0, 90, 180, 270], heightFt: 3, cover: "half", opacity: 0.55, theme: "ruined-abbey", variants: ["oak", "broken"] },
    reliquary: { footprint: [1, 1], connectors: [], rotations: [0, 90, 180, 270], heightFt: 5.5, cover: "half", opacity: 0.8, theme: "ruined-abbey", variants: ["gilded"] },
    statue: { footprint: [1, 1], connectors: [], rotations: [0, 90, 180, 270], heightFt: 8, cover: "circle", opacity: 1, theme: "ruined-abbey", variants: ["saint", "broken"] },
    candles: { footprint: [1, 1], connectors: ["n", "e", "s", "w"], rotations: [0, 90, 180, 270], heightFt: 1, cover: null, opacity: 0.1, theme: "ruined-abbey", variants: ["votive"] },
    font: { footprint: [1, 1], connectors: [], rotations: [0, 90, 180, 270], heightFt: 3.5, cover: "half", opacity: 0.65, theme: "ruined-abbey", variants: ["octagonal", "broken"] }
  });

  function copy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function key(c, r) { return c + "," + r; }
  function idx(cols, c, r) { return r * cols + c; }
  function normalizeRotation(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return ((Math.round(n / 90) * 90) % 360 + 360) % 360;
  }
  function rectSpace(id, label, c, r, w, h, region, material, elevationFt) {
    return {
      id: id, label: label, discoveryRegion: region, material: material || "nave",
      elevationFt: Number(elevationFt) || 0,
      polygon: [[c, r], [c + w, r], [c + w, r + h], [c, r + h]]
    };
  }
  function corridor(id, label, from, to, width, region, material, elevationFt) {
    return {
      id: id, label: label, from: from.slice(), to: to.slice(), width: width || 1,
      discoveryRegion: region, material: material || "nave", elevationFt: Number(elevationFt) || 0
    };
  }
  function architecture(kind, c, r, rotation, region, variant) {
    return { id: kind + "-" + c + "-" + r, kind: kind, c: c, r: r, rotation: normalizeRotation(rotation), discoveryRegion: region, variant: variant || null };
  }
  function prop(kind, c, r, region, rotation, variant) {
    return { id: "prop-" + kind + "-" + c + "-" + r, kind: kind, c: c, r: r, rotation: normalizeRotation(rotation), discoveryRegion: region, variant: variant || null };
  }
  function light(id, c, r, region, color, intensity) {
    return { id: id, c: c, r: r, discoveryRegion: region, color: color || 0xffb867, intensity: intensity || 1 };
  }
  function spawn(c, r, side, id) { return { c: c, r: r, side: side, key: id }; }

  function fixtureBase(id, name, topology, spaces, corridors, modules, props, lights, spawns, regions) {
    return {
      schema: SCHEMA, version: 1, id: id, name: name,
      grid: { cols: 28, rows: 20, cellFt: 5, chunkSize: 5 },
      theme: "ruined-abbey",
      topology: topology,
      spaces: spaces,
      corridors: corridors,
      architecture: modules,
      elevationZones: spaces.map(function (space) {
        return { id: "elevation-" + space.id, polygon: copy(space.polygon), elevationFt: space.elevationFt, material: space.material, discoveryRegion: space.discoveryRegion };
      }),
      materialZones: spaces.map(function (space) {
        return { id: "material-" + space.id, polygon: copy(space.polygon), material: space.material, discoveryRegion: space.discoveryRegion };
      }),
      discoveryRegions: regions,
      encounterRegions: regions.map(function (region, order) {
        return { id: "encounter-" + region.id, discoveryRegion: region.id, order: order };
      }),
      props: props,
      lights: lights,
      spawns: spawns
    };
  }

  function processionalFixture() {
    var spaces = [
      rectSpace("west-gate", "West Gate", 2, 7, 5, 6, "gate", "cloister", 0),
      rectSpace("nave", "Processional Nave", 9, 5, 8, 10, "nave", "nave", 0),
      rectSpace("choir", "Raised Choir", 19, 6, 6, 8, "choir", "crypt", 5)
    ];
    var corridors = [
      corridor("gate-nave", "Broken arcade", [7, 10], [9, 10], 2, "nave", "nave", 0),
      corridor("nave-choir", "Choir steps", [17, 10], [19, 10], 2, "choir", "nave", 0)
    ];
    var modules = [
      architecture("arch", 8, 10, 90, "nave", "round"),
      architecture("door", 18, 10, 90, "choir", "oak"),
      architecture("stairs", 18, 11, 90, "choir", "stone"),
      architecture("window", 13, 5, 0, "nave", "lancet"),
      architecture("window", 13, 14, 0, "nave", "broken"),
      architecture("lowWall", 21, 8, 0, "choir", "crumbled"),
      architecture("lowWall", 22, 8, 0, "choir", "crumbled")
    ];
    var props = [
      prop("pillar", 11, 7, "nave", 0, "whole"), prop("pillar", 15, 7, "nave", 0, "broken"),
      prop("pillar", 11, 12, "nave", 0, "whole"), prop("pillar", 15, 12, "nave", 0, "whole"),
      prop("rubble", 5, 9, "gate", 90, "large"),
      prop("altar", 23, 8, "choir", 0, "high-altar"),
      prop("reliquary", 23, 7, "choir", 0, "gilded"),
      prop("statue", 20, 7, "choir", 0, "broken"),
      prop("pew", 20, 11, "choir", 90, "oak"),
      prop("pew", 24, 11, "choir", 90, "broken"),
      prop("candles", 21, 9, "choir", 0, "votive"),
      prop("font", 20, 12, "choir", 0, "octagonal"),
      prop("rubble", 24, 12, "choir", 90, "small"),
      prop("brazier", 22, 10, "choir", 0, "lit")
    ];
    return fixtureBase(
      "processional-abbey", "Processional Abbey", "linear procession",
      spaces, corridors, modules, props,
      [light("choir-brazier", 22, 10, "choir", 0xffa85c, 1.5), light("altar-votives", 21, 9, "choir", 0xffc57a, 0.85)],
      [spawn(4, 10, "pc", "vesperian"), spawn(6, 10, "pc", "caim"), spawn(22, 11, "foe", "abbey-wight")],
      [{ id: "gate", label: "West Gate" }, { id: "nave", label: "Processional Nave" }, { id: "choir", label: "Raised Choir" }]
    );
  }

  function vaultFixture() {
    var spaces = [
      rectSpace("hub", "Reliquary Hub", 10, 6, 8, 8, "hub", "nave", 5),
      rectSpace("north", "North Vault", 11, 1, 6, 4, "north", "crypt", 0),
      rectSpace("east", "Chapter Vault", 20, 7, 5, 6, "east", "cloister", 0),
      rectSpace("south", "Flooded Ossuary", 11, 15, 6, 4, "south", "water", 0),
      rectSpace("west", "Collapsed Vestry", 3, 7, 5, 6, "west", "timber", 0)
    ];
    var corridors = [
      corridor("hub-north", "North spoke", [14, 5], [14, 6], 2, "north", "crypt", 0),
      corridor("hub-east", "East spoke", [18, 10], [20, 10], 2, "east", "cloister", 0),
      corridor("hub-south", "South spoke", [14, 14], [14, 15], 2, "south", "water", 0),
      corridor("hub-west", "West spoke", [8, 10], [10, 10], 2, "west", "timber", 0),
      corridor("north-east-loop", "Upper ambulatory", [16, 3], [22, 7], 1, "east", "crypt", 0),
      corridor("south-west-loop", "Lower ambulatory", [12, 17], [6, 13], 1, "west", "water", 0)
    ];
    var modules = [
      architecture("stairs", 14, 5, 0, "hub", "stone"),
      architecture("stairs", 18, 10, 90, "hub", "stone"),
      architecture("arch", 14, 14, 0, "south", "round"),
      architecture("door", 9, 10, 90, "west", "iron"),
      architecture("lowWall", 12, 7, 90, "hub", "straight"),
      architecture("lowWall", 12, 12, 90, "hub", "straight"),
      architecture("window", 22, 7, 90, "east", "broken")
    ];
    var props = [
      prop("pillar", 12, 8, "hub", 0, "whole"), prop("pillar", 16, 8, "hub", 0, "whole"),
      prop("pillar", 12, 12, "hub", 0, "broken"), prop("pillar", 16, 12, "hub", 0, "whole"),
      prop("pool", 13, 17, "south", 0, "pool"), prop("pool", 14, 17, "south", 0, "pool"),
      prop("crates", 22, 10, "east", 90, "barrels"), prop("brazier", 14, 10, "hub", 0, "lit")
    ];
    return fixtureBase(
      "loop-hub-vault", "Loop / Hub Vault", "hub with two bypass loops",
      spaces, corridors, modules, props,
      [light("hub-flame", 14, 10, "hub", 0xffb05f, 1.7), light("east-lamp", 22, 10, "east", 0xffc879, 0.8)],
      [spawn(5, 10, "pc", "liadan"), spawn(7, 10, "pc", "chonkalius"), spawn(14, 10, "foe", "reliquary-guardian")],
      [{ id: "west", label: "Collapsed Vestry" }, { id: "hub", label: "Reliquary Hub" }, { id: "north", label: "North Vault" }, { id: "east", label: "Chapter Vault" }, { id: "south", label: "Flooded Ossuary" }]
    );
  }

  function warrenFixture() {
    var spaces = [
      rectSpace("entry", "Pilgrim Cellar", 2, 8, 5, 5, "entry", "timber", 0),
      rectSpace("fork", "Broken Crossing", 9, 7, 5, 6, "fork", "nave", 0),
      rectSpace("north-a", "Scribe Cells", 16, 2, 5, 5, "scribes", "cloister", 0),
      rectSpace("north-b", "Bell Undercroft", 22, 3, 4, 5, "bell", "crypt", 5),
      rectSpace("south-a", "Kitchen Ruin", 16, 13, 5, 5, "kitchen", "timber", 0),
      rectSpace("south-b", "Root Chapel", 23, 12, 3, 6, "chapel", "cloister", 0)
    ];
    var corridors = [
      corridor("entry-fork", "Cellar throat", [7, 10], [9, 10], 1, "fork", "nave", 0),
      corridor("fork-scribes", "Scribe branch", [14, 8], [16, 5], 1, "scribes", "cloister", 0),
      corridor("scribes-bell", "Bell branch", [21, 5], [22, 5], 1, "bell", "crypt", 0),
      corridor("fork-kitchen", "Kitchen branch", [14, 11], [16, 15], 1, "kitchen", "timber", 0),
      corridor("kitchen-chapel", "Root branch", [21, 15], [23, 15], 1, "chapel", "cloister", 0)
    ];
    var modules = [
      architecture("door", 8, 10, 90, "fork", "oak"),
      architecture("arch", 15, 6, 45, "scribes", "ruined"),
      architecture("stairs", 21, 5, 90, "bell", "stone"),
      architecture("door", 15, 13, 0, "kitchen", "iron"),
      architecture("arch", 22, 15, 90, "chapel", "round"),
      architecture("lowWall", 11, 9, 0, "fork", "crumbled"),
      architecture("window", 24, 12, 0, "chapel", "lancet")
    ];
    var props = [
      prop("rubble", 5, 9, "entry", 0, "large"), prop("crates", 18, 15, "kitchen", 90, "crate"),
      prop("pillar", 18, 4, "scribes", 0, "broken"), prop("brazier", 24, 15, "chapel", 0, "lit"),
      prop("rubble", 24, 5, "bell", 0, "small"), prop("pool", 24, 17, "chapel", 0, "channel")
    ];
    return fixtureBase(
      "branching-warren", "Branching Warren", "asymmetric branching tree",
      spaces, corridors, modules, props,
      [light("root-flame", 24, 15, "chapel", 0xff9f55, 1.4)],
      [spawn(4, 10, "pc", "caim"), spawn(5, 11, "pc", "vesperian"), spawn(24, 15, "foe", "root-priest")],
      [{ id: "entry", label: "Pilgrim Cellar" }, { id: "fork", label: "Broken Crossing" }, { id: "scribes", label: "Scribe Cells" }, { id: "bell", label: "Bell Undercroft" }, { id: "kitchen", label: "Kitchen Ruin" }, { id: "chapel", label: "Root Chapel" }]
    );
  }

  var FIXTURES = Object.freeze({
    processional: processionalFixture(),
    vault: vaultFixture(),
    warren: warrenFixture()
  });

  function pointInPolygon(c, r, polygon) {
    var x = c + 0.5, y = r + 0.5, inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      var xi = polygon[i][0], yi = polygon[i][1], xj = polygon[j][0], yj = polygon[j][1];
      var hit = ((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi || 1e-9) + xi;
      if (hit) inside = !inside;
    }
    return inside;
  }
  function corridorCells(item) {
    var x = item.from[0], y = item.from[1], tx = item.to[0], ty = item.to[1], cells = [], guard = 0;
    function stamp() {
      var half = Math.max(0, Math.floor((item.width - 1) / 2));
      for (var oy = -half; oy <= half; oy++) for (var ox = -half; ox <= half; ox++) cells.push({ c: x + ox, r: y + oy });
      if (item.width % 2 === 0) cells.push({ c: x, r: y + 1 });
    }
    while ((x !== tx || y !== ty) && guard++ < 200) {
      stamp();
      if (x !== tx) x += x < tx ? 1 : -1;
      else if (y !== ty) y += y < ty ? 1 : -1;
    }
    stamp();
    return cells;
  }
  function cellRegions(blueprint) {
    var cols = blueprint.grid.cols, rows = blueprint.grid.rows, out = new Array(cols * rows).fill(null);
    blueprint.spaces.forEach(function (space) {
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        if (pointInPolygon(c, r, space.polygon)) out[idx(cols, c, r)] = {
          region: space.discoveryRegion, material: space.material, elevationFt: space.elevationFt, space: space.id
        };
      }
    });
    blueprint.corridors.forEach(function (item) {
      corridorCells(item).forEach(function (cell) {
        if (cell.c < 0 || cell.r < 0 || cell.c >= cols || cell.r >= rows) return;
        out[idx(cols, cell.c, cell.r)] = {
          region: item.discoveryRegion, material: item.material, elevationFt: item.elevationFt, corridor: item.id
        };
      });
    });
    return out;
  }
  function coverFor(kind, rotation, heightFt) {
    var axis = normalizeRotation(rotation) % 180 === 0 ? "z" : "x";
    if (kind === "pillar") return { kind: "circle", source: "blueprint-pillar", radius: 0.3, heightFt: heightFt };
    if (kind === "lowWall") return axis === "x"
      ? { kind: "box", source: "blueprint-low-wall", halfX: 0.47, halfY: 0.12, heightFt: heightFt }
      : { kind: "box", source: "blueprint-low-wall", halfX: 0.12, halfY: 0.47, heightFt: heightFt };
    if (kind === "statue") return { kind: "circle", source: "blueprint-statue", radius: 0.34, heightFt: heightFt };
    if (kind === "pew") return axis === "x"
      ? { kind: "box", source: "blueprint-pew", halfX: 0.42, halfY: 0.2, heightFt: heightFt }
      : { kind: "box", source: "blueprint-pew", halfX: 0.2, halfY: 0.42, heightFt: heightFt };
    if (["rubble", "crates", "brazier", "altar", "pew", "reliquary", "font"].indexOf(kind) >= 0) {
      return { kind: "box", source: "blueprint-" + kind, halfX: 0.35, halfY: 0.35, heightFt: heightFt };
    }
    if (kind === "wall" || kind === "corner" || kind === "window") return { kind: "full", source: "blueprint-" + kind, heightFt: heightFt };
    return null;
  }

  function compile(blueprint, edits) {
    if (!blueprint || blueprint.schema !== SCHEMA || Number(blueprint.version) !== 1) throw new Error("Blueprint schema is not forge-blueprint/v1");
    var cols = blueprint.grid.cols, rows = blueprint.grid.rows, n = cols * rows, regions = cellRegions(blueprint);
    var map = {
      cols: cols, rows: rows,
      h: new Array(n).fill(0),
      wall: new Array(n).fill(true),
      occ: new Array(n).fill(Infinity),
      coverShape: new Array(n).fill(null),
      spawns: copy(blueprint.spawns || []),
      props: copy(blueprint.props || []),
      meta: {
        source: SCHEMA, blueprintId: blueprint.id, blueprintName: blueprint.name,
        topology: blueprint.topology, cellFt: blueprint.grid.cellFt,
        chunkSize: blueprint.grid.chunkSize, regions: regions
      }
    };
    regions.forEach(function (cell, i) {
      if (!cell) return;
      map.wall[i] = false; map.occ[i] = 0; map.h[i] = Number(cell.elevationFt) || 0;
    });
    var appliedArchitecture = copy(blueprint.architecture || []);
    Object.keys(edits || {}).sort().forEach(function (cellKey) {
      var edit = edits[cellKey], parts = cellKey.split(","), c = Number(parts[0]), r = Number(parts[1]);
      appliedArchitecture = appliedArchitecture.filter(function (item) { return item.c !== c || item.r !== r; });
      if (edit && edit.kind !== "erase") appliedArchitecture.push(Object.assign({ id: "edit-" + cellKey, c: c, r: r }, copy(edit), { rotation: normalizeRotation(edit.rotation) }));
    });
    appliedArchitecture.forEach(function (item) {
      if (item.c < 0 || item.r < 0 || item.c >= cols || item.r >= rows) return;
      var i = idx(cols, item.c, item.r), def = KIT[item.kind];
      if (!def || !regions[i]) return;
      if (item.kind === "wall" || item.kind === "corner") {
        map.wall[i] = true; map.occ[i] = def.heightFt; map.coverShape[i] = coverFor(item.kind, item.rotation, def.heightFt);
      } else if (item.kind === "window") {
        map.wall[i] = true; map.occ[i] = def.heightFt; map.coverShape[i] = coverFor(item.kind, item.rotation, def.heightFt);
      } else if (item.kind === "lowWall") {
        map.occ[i] = def.heightFt; map.coverShape[i] = coverFor(item.kind, item.rotation, def.heightFt);
      } else if (item.kind === "door" || item.kind === "arch" || item.kind === "stairs") {
        map.wall[i] = false; map.occ[i] = 0; map.coverShape[i] = null;
      }
    });
    map.props.forEach(function (item) {
      var def = KIT[item.kind], i = idx(cols, item.c, item.r);
      if (!def || i < 0 || i >= n || map.wall[i]) return;
      var shape = coverFor(item.kind, item.rotation, def.heightFt);
      if (shape && def.heightFt > map.occ[i]) { map.occ[i] = def.heightFt; map.coverShape[i] = shape; }
    });
    map.meta.architecture = appliedArchitecture;
    return map;
  }

  function validateMap(map) {
    var errors = [], n = map && map.cols * map.rows;
    if (!map || !Number.isInteger(map.cols) || !Number.isInteger(map.rows)) return { ok: false, errors: ["missing cols/rows"] };
    ["h", "wall", "occ", "coverShape"].forEach(function (name) {
      if (!Array.isArray(map[name]) || map[name].length !== n) errors.push(name + "[] length !== cols*rows");
    });
    (map.spawns || []).forEach(function (spawn) {
      if (spawn.c < 0 || spawn.r < 0 || spawn.c >= map.cols || spawn.r >= map.rows || map.wall[idx(map.cols, spawn.c, spawn.r)]) errors.push("invalid spawn " + (spawn.key || key(spawn.c, spawn.r)));
    });
    (map.props || []).forEach(function (prop) {
      if (prop.c < 0 || prop.r < 0 || prop.c >= map.cols || prop.r >= map.rows || map.wall[idx(map.cols, prop.c, prop.r)]) errors.push("invalid prop " + (prop.id || key(prop.c, prop.r)));
    });
    return { ok: errors.length === 0, errors: errors };
  }
  function reachable(map, start) {
    var seen = {}, queue = start ? [start] : [];
    if (start) seen[key(start.c, start.r)] = true;
    while (queue.length) {
      var at = queue.shift();
      CARDINAL.forEach(function (step) {
        var c = at.c + step[0], r = at.r + step[1], cellKey = key(c, r);
        if (c < 0 || r < 0 || c >= map.cols || r >= map.rows || seen[cellKey] || map.wall[idx(map.cols, c, r)]) return;
        seen[cellKey] = true; queue.push({ c: c, r: r });
      });
    }
    return seen;
  }
  function connectivity(map) {
    var open = [], start = null;
    for (var r = 0; r < map.rows; r++) for (var c = 0; c < map.cols; c++) {
      if (!map.wall[idx(map.cols, c, r)]) { open.push(key(c, r)); if (!start) start = { c: c, r: r }; }
    }
    var seen = reachable(map, start), missing = open.filter(function (cellKey) { return !seen[cellKey]; });
    return { ok: missing.length === 0, reachable: Object.keys(seen).length, open: open.length, missing: missing };
  }
  function chunkFor(blueprint, c, r) {
    var size = blueprint.grid.chunkSize;
    return { c: Math.floor(c / size), r: Math.floor(r / size), key: Math.floor(c / size) + "," + Math.floor(r / size) };
  }
  function chunkCount(blueprint) {
    return Math.ceil(blueprint.grid.cols / blueprint.grid.chunkSize) * Math.ceil(blueprint.grid.rows / blueprint.grid.chunkSize);
  }
  function editCell(edits, c, r, kind, rotation) {
    var out = copy(edits || {});
    if (kind === "erase") out[key(c, r)] = { kind: "erase", rotation: 0 };
    else {
      if (!KIT[kind] || ["wall", "lowWall", "door"].indexOf(kind) < 0) throw new Error("Proof editor only owns wall, lowWall, door, and erase");
      out[key(c, r)] = { kind: kind, rotation: normalizeRotation(rotation), variant: kind === "door" ? "oak" : "straight" };
    }
    return out;
  }
  function changeZone(blueprint, regionId, elevationFt, material) {
    var out = copy(blueprint);
    out.spaces.forEach(function (space) {
      if (space.discoveryRegion !== regionId) return;
      if (Number.isFinite(Number(elevationFt))) space.elevationFt = Math.max(0, Math.min(15, Number(elevationFt)));
      if (MATERIALS[material]) space.material = material;
    });
    out.elevationZones = out.spaces.map(function (space) {
      return { id: "elevation-" + space.id, polygon: copy(space.polygon), elevationFt: space.elevationFt, material: space.material, discoveryRegion: space.discoveryRegion };
    });
    out.materialZones = out.spaces.map(function (space) {
      return { id: "material-" + space.id, polygon: copy(space.polygon), material: space.material, discoveryRegion: space.discoveryRegion };
    });
    return out;
  }

  return {
    SCHEMA: SCHEMA, KIT: KIT, MATERIALS: MATERIALS, FIXTURES: FIXTURES,
    copy: copy, key: key, idx: idx, normalizeRotation: normalizeRotation,
    pointInPolygon: pointInPolygon, corridorCells: corridorCells, cellRegions: cellRegions,
    compile: compile, validateMap: validateMap, reachable: reachable, connectivity: connectivity,
    chunkFor: chunkFor, chunkCount: chunkCount, editCell: editCell, changeZone: changeZone
  };
});
