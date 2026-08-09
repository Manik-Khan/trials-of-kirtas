/* Forge Blueprint v1 · pure document + compiler authority.
   Browser: window.ForgeBlueprint. Node: module.exports.
   Creation tools and renderers consume this document; compile() emits the
   current tactical field without routing through the legacy dungeon generator. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeBlueprint = api;
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
  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    return "{" + Object.keys(value).sort().map(function (name) {
      return JSON.stringify(name) + ":" + stableStringify(value[name]);
    }).join(",") + "}";
  }
  function hashText(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
  }
  function fingerprint(blueprint) {
    return "bp-" + hashText(stableStringify(blueprint));
  }
  function structuralFingerprint(blueprint) {
    var structural = {
      grid: blueprint && blueprint.grid,
      topology: blueprint && blueprint.topology,
      spaces: blueprint && blueprint.spaces,
      corridors: blueprint && blueprint.corridors,
      connectors: blueprint && blueprint.connectors,
      architecture: blueprint && blueprint.architecture,
      elevationZones: blueprint && blueprint.elevationZones
    };
    if (blueprint && blueprint.buildingSet) structural.buildingSet = blueprint.buildingSet;
    if (blueprint && blueprint.cameraViews) structural.cameraViews = blueprint.cameraViews;
    return "struct-" + hashText(stableStringify(structural));
  }
  function key(c, r) { return c + "," + r; }
  function idx(cols, c, r) { return r * cols + c; }
  function normalizeRotation(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return ((Math.round(n / 90) * 90) % 360 + 360) % 360;
  }
  function normalizeEdge(value) {
    var edge = String(value || "").toUpperCase();
    return ["N", "E", "S", "W"].indexOf(edge) >= 0 ? edge : null;
  }
  function edgeRotation(edge) {
    edge = normalizeEdge(edge);
    return edge === "E" || edge === "W" ? 90 : 0;
  }
  function oppositeEdge(edge) {
    return { N: "S", E: "W", S: "N", W: "E" }[normalizeEdge(edge)] || null;
  }
  function edgeReferences(c, r, edge) {
    edge = normalizeEdge(edge);
    var step = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[edge];
    if (!step) return [];
    return [
      { c: c, r: r, edge: edge },
      { c: c + step[0], r: r + step[1], edge: oppositeEdge(edge) }
    ];
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
      areaSettings: regions.reduce(function (out, region) {
        out[region.id] = { dressTogether: true, revealTogether: true, provenance: "Authored topology study" };
        return out;
      }, {}),
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
  var PRODUCER_LABELS = Object.freeze({
    seeded: "Seeded generator",
    imported: "Assisted map import",
    blank: "Blank canvas",
    fixture: "Topology study"
  });

  function sourceRecord(kind, detail) {
    return Object.assign({
      kind: kind,
      label: PRODUCER_LABELS[kind] || kind,
      createdBy: "forge-combat"
    }, copy(detail || {}));
  }
  function withSource(blueprint, kind, detail) {
    var out = copy(blueprint);
    out.source = sourceRecord(kind, detail);
    var provenance = kind === "seeded" ? "Generated from seed"
      : kind === "imported" ? "Imported proposal"
      : kind === "blank" ? "DM-authored"
      : "Authored topology study";
    out.areaSettings = out.areaSettings || {};
    (out.discoveryRegions || []).forEach(function (region) {
      out.areaSettings[region.id] = Object.assign({
        dressTogether: true, revealTogether: true
      }, out.areaSettings[region.id] || {}, { provenance: provenance });
    });
    return out;
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
  function blueprintGrid(size) {
    return {
      small: { cols: 24, rows: 18, cellFt: 5, chunkSize: 5 },
      large: { cols: 36, rows: 26, cellFt: 5, chunkSize: 5 }
    }[size] || { cols: 28, rows: 20, cellFt: 5, chunkSize: 5 };
  }
  function graphSlots(grid, topology, random) {
    var xs = [0.18, 0.5, 0.82], ys = [0.2, 0.5, 0.8];
    var slots = [];
    ys.forEach(function (y, row) {
      xs.forEach(function (x, col) {
        slots.push({ c: Math.round(grid.cols * x), r: Math.round(grid.rows * y), row: row, col: col });
      });
    });
    var orders = {
      processional: [3, 4, 5, 2, 1, 0, 6, 7, 8],
      vault: [0, 1, 2, 5, 8, 7, 6, 3, 4],
      warren: [3, 4, 1, 7, 5, 0, 2, 6, 8]
    };
    var order = orders[topology].slice();
    if (topology === "processional" && random() > 0.5) order.reverse();
    if (topology === "vault") {
      var shift = Math.floor(random() * 8);
      order = order.slice(shift, 8).concat(order.slice(0, shift), order.slice(8));
    }
    if (topology === "warren" && random() > 0.5) {
      [order[2], order[3]] = [order[3], order[2]];
      [order[5], order[6]] = [order[6], order[5]];
    }
    return order.map(function (index) { return slots[index]; });
  }
  function graphEdges(topology, count, random) {
    var edges = [];
    if (topology === "processional") {
      for (var i = 1; i < count; i++) edges.push([i - 1, i]);
    } else if (topology === "vault") {
      var ringCount = Math.min(8, count);
      for (var r = 1; r < ringCount; r++) edges.push([r - 1, r]);
      if (ringCount > 3) edges.push([ringCount - 1, 0]);
      if (count > 8) [0, 2, 4, 6].forEach(function (index) { edges.push([8, index]); });
      else if (ringCount > 5) edges.push(random() > 0.5 ? [0, 4] : [1, 4]);
    } else {
      for (var b = 1; b < count; b++) {
        var parent = Math.floor((b - 1) / 2);
        if (b > 4 && random() > 0.72) parent = Math.max(0, parent - 1);
        edges.push([parent, b]);
      }
    }
    return edges;
  }
  var PORTAL_STEPS = [
    { side: "N", dc: 0, dr: -1 }, { side: "E", dc: 1, dr: 0 },
    { side: "S", dc: 0, dr: 1 }, { side: "W", dc: -1, dr: 0 }
  ];
  function generatedRoom(space) {
    var bounds = spaceBounds(space);
    return bounds && {
      id: space.id, label: space.label, c: bounds.minX, r: bounds.minY,
      w: bounds.maxX - bounds.minX, h: bounds.maxY - bounds.minY,
      elevationFt: Number(space.elevationFt) || 0,
      discoveryRegion: space.discoveryRegion, material: space.material
    };
  }
  function generatedRoomCenter(room) {
    return { c: room.c + (room.w - 1) / 2, r: room.r + (room.h - 1) / 2 };
  }
  function generatedRoomCells(room) {
    var cells = [];
    for (var r = room.r; r < room.r + room.h; r++) for (var c = room.c; c < room.c + room.w; c++) cells.push({ c: c, r: r });
    return cells;
  }
  function generatedInside(grid, cell) {
    return cell.c >= 0 && cell.r >= 0 && cell.c < grid.cols && cell.r < grid.rows;
  }
  function generatedStep(side) {
    return PORTAL_STEPS.find(function (step) { return step.side === side; });
  }
  function generatedPortalKey(portal) {
    return portal.roomId + ":" + portal.c + "," + portal.r + "," + portal.side;
  }
  function generatedSidePreference(room, target) {
    var a = generatedRoomCenter(room), b = generatedRoomCenter(target), dx = b.c - a.c, dy = b.r - a.r;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ["E", dy >= 0 ? "S" : "N", dy >= 0 ? "N" : "S", "W"]
      : ["W", dy >= 0 ? "S" : "N", dy >= 0 ? "N" : "S", "E"];
    return dy >= 0 ? ["S", dx >= 0 ? "E" : "W", dx >= 0 ? "W" : "E", "N"]
      : ["N", dx >= 0 ? "E" : "W", dx >= 0 ? "W" : "E", "S"];
  }
  function generatedPortalCandidates(room, target, used) {
    var targetCenter = generatedRoomCenter(target), out = [];
    generatedSidePreference(room, target).forEach(function (side) {
      var vertical = side === "E" || side === "W";
      var start = vertical ? room.r : room.c, length = vertical ? room.h : room.w;
      var desired = Math.round(vertical ? targetCenter.r : targetCenter.c);
      desired = Math.max(start, Math.min(start + length - 1, desired));
      [0, -1, 1, -2, 2, -3, 3, -4, 4].forEach(function (offset) {
        var along = desired + offset;
        if (along < start || along >= start + length) return;
        var portal = {
          roomId: room.id,
          c: vertical ? (side === "E" ? room.c + room.w - 1 : room.c) : along,
          r: vertical ? along : (side === "S" ? room.r + room.h - 1 : room.r),
          side: side
        };
        if (!used[generatedPortalKey(portal)]) out.push(portal);
      });
    });
    return out;
  }
  function generatedOutside(portal, distance) {
    var step = generatedStep(portal.side);
    return { c: portal.c + step.dc * distance, r: portal.r + step.dr * distance };
  }
  function generatedRoute(grid, start, goal, blocked, claimed, elevationFt) {
    var queue = [start], head = 0, cameFrom = {}, seen = {};
    seen[key(start.c, start.r)] = true;
    while (head < queue.length) {
      var current = queue[head++], currentKey = key(current.c, current.r);
      if (current.c === goal.c && current.r === goal.r) {
        var path = [], cursor = currentKey;
        while (cursor) {
          var parts = cursor.split(","); path.push({ c: Number(parts[0]), r: Number(parts[1]) }); cursor = cameFrom[cursor];
        }
        return path.reverse();
      }
      PORTAL_STEPS.slice().sort(function (a, b) {
        return Math.abs(current.c + a.dc - goal.c) + Math.abs(current.r + a.dr - goal.r)
          - Math.abs(current.c + b.dc - goal.c) - Math.abs(current.r + b.dr - goal.r);
      }).forEach(function (step) {
        var next = { c: current.c + step.dc, r: current.r + step.dr }, nextKey = key(next.c, next.r);
        if (!generatedInside(grid, next) || seen[nextKey] || blocked[nextKey]) return;
        if (claimed[nextKey] !== undefined && claimed[nextKey] !== elevationFt) return;
        seen[nextKey] = true; cameFrom[nextKey] = currentKey; queue.push(next);
      });
    }
    return null;
  }
  function chooseGeneratedConnection(grid, roomA, roomB, state) {
    var low = roomA.elevationFt <= roomB.elevationFt ? roomA : roomB;
    var high = low === roomA ? roomB : roomA;
    var tiers = Math.abs(high.elevationFt - low.elevationFt) / 5;
    var lowCandidates = generatedPortalCandidates(low, high, state.used);
    var highCandidates = generatedPortalCandidates(high, low, state.used);
    for (var li = 0; li < lowCandidates.length; li++) for (var hi = 0; hi < highCandidates.length; hi++) {
      var lowPortal = lowCandidates[li], highPortal = highCandidates[hi];
      var lowOutside = generatedOutside(lowPortal, 1), stairCells = [], approach;
      if (!generatedInside(grid, lowOutside) || state.owner[key(lowOutside.c, lowOutside.r)]) continue;
      if (tiers) {
        for (var distance = tiers; distance >= 0; distance--) {
          var stairCell = distance ? generatedOutside(highPortal, distance) : { c: highPortal.c, r: highPortal.r };
          stairCells.push({ c: stairCell.c, r: stairCell.r, elevationFt: high.elevationFt - distance * 5 });
        }
        approach = generatedOutside(highPortal, tiers + 1);
      } else approach = generatedOutside(highPortal, 1);
      var reserved = tiers ? stairCells.slice(0, -1).concat([approach]) : [approach];
      if (reserved.some(function (cell) { return cell.c === lowOutside.c && cell.r === lowOutside.r; })) continue;
      if (!reserved.every(function (cell) {
        var cellKey = key(cell.c, cell.r);
        return generatedInside(grid, cell) && !state.owner[cellKey]
          && (tiers ? state.claimed[cellKey] === undefined : state.claimed[cellKey] === undefined || state.claimed[cellKey] === low.elevationFt);
      })) continue;
      var blocked = Object.assign({}, state.owner);
      reserved.forEach(function (cell) { blocked[key(cell.c, cell.r)] = "reserved-stair-runway"; });
      delete blocked[key(lowOutside.c, lowOutside.r)]; delete blocked[key(approach.c, approach.r)];
      var middle = generatedRoute(grid, lowOutside, approach, blocked, state.claimed, low.elevationFt);
      if (!middle) continue;
      var path = [{ c: lowPortal.c, r: lowPortal.r, elevationFt: low.elevationFt }]
        .concat(middle.map(function (cell) { return { c: cell.c, r: cell.r, elevationFt: low.elevationFt }; }));
      if (tiers) stairCells.forEach(function (cell) {
        var last = path[path.length - 1];
        if (last.c !== cell.c || last.r !== cell.r) path.push(cell);
      });
      else path.push({ c: highPortal.c, r: highPortal.r, elevationFt: high.elevationFt });
      if (path.some(function (cell) {
        var existing = state.claimed[key(cell.c, cell.r)];
        return existing !== undefined && existing !== cell.elevationFt;
      })) continue;
      return {
        roomA: roomA.id, roomB: roomB.id, lowRoomId: low.id, highRoomId: high.id,
        lowFt: low.elevationFt, highFt: high.elevationFt, lowPortal: lowPortal, highPortal: highPortal,
        portals: [lowPortal, highPortal], path: path, stairPath: stairCells, approach: approach,
        lowLanding: tiers ? stairCells[0] : lowOutside,
        highLanding: { c: highPortal.c, r: highPortal.r, elevationFt: high.elevationFt },
        kind: tiers ? "stairs" : "passage", tiers: tiers
      };
    }
    return null;
  }
  function generatedPathSegments(path) {
    var segments = [], start = 0, priorDirection = null;
    for (var i = 1; i < path.length; i++) {
      var direction = (path[i].c - path[i - 1].c) + "," + (path[i].r - path[i - 1].r);
      if (priorDirection && direction !== priorDirection) { segments.push([path[start], path[i - 1]]); start = i - 1; }
      priorDirection = direction;
    }
    if (path.length > 1) segments.push([path[start], path[path.length - 1]]);
    return segments;
  }
  function planGeneratedConnections(grid, spaces, edges) {
    var rooms = spaces.map(generatedRoom), byId = {}, owner = {}, claimed = {}, used = {};
    rooms.forEach(function (room) {
      byId[room.id] = room;
      generatedRoomCells(room).forEach(function (cell) {
        owner[key(cell.c, cell.r)] = room.id; claimed[key(cell.c, cell.r)] = room.elevationFt;
      });
    });
    var corridors = [], connectors = [], modules = [];
    for (var edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
      var first = rooms[edges[edgeIndex][0]], second = rooms[edges[edgeIndex][1]];
      var connection = chooseGeneratedConnection(grid, first, second, { owner: owner, claimed: claimed, used: used });
      if (!connection) return { ok: false, reason: "No legal portal and stair runway for " + first.label + " → " + second.label };
      connection.id = "generated-connection-" + (edgeIndex + 1);
      connection.portals.forEach(function (portal, portalIndex) {
        used[generatedPortalKey(portal)] = true;
        var room = byId[portal.roomId];
        modules.push({
          id: connection.id + "-portal-" + (portalIndex + 1), kind: "door",
          c: portal.c, r: portal.r, edge: portal.side, rotation: edgeRotation(portal.side),
          discoveryRegion: room.discoveryRegion, variant: "oak", connectorId: connection.id
        });
      });
      connection.path.forEach(function (cell) { claimed[key(cell.c, cell.r)] = cell.elevationFt; });
      var lowRoom = byId[connection.lowRoomId], segmentIds = [];
      generatedPathSegments(connection.path).forEach(function (segment, segmentIndex) {
        var corridorId = "generated-passage-" + (edgeIndex + 1) + "-" + (segmentIndex + 1);
        segmentIds.push(corridorId);
        corridors.push(corridor(
          corridorId, "Passage " + (edgeIndex + 1),
          [segment[0].c, segment[0].r], [segment[1].c, segment[1].r], 1,
          lowRoom.discoveryRegion, lowRoom.material, connection.lowFt
        ));
        corridors[corridors.length - 1].connectionId = connection.id;
        corridors[corridors.length - 1].fromSpaceId = connection.roomA;
        corridors[corridors.length - 1].toSpaceId = connection.roomB;
      });
      connection.corridorIds = segmentIds;
      connection.state = "open"; connection.oneWay = false; connection.widthFt = 5; connection.requires = {};
      connection.discoveryRegion = byId[connection.highRoomId].discoveryRegion;
      connectors.push(connection);
    }
    return { ok: true, corridors: corridors, connectors: connectors, architecture: modules };
  }
  function produceSeeded(options) {
    options = options || {};
    var seed = Number.isFinite(Number(options.seed)) ? Math.abs(Math.trunc(Number(options.seed))) : 1847;
    var candidate = Math.max(0, Math.trunc(Number(options.candidate) || 0));
    var attempt = Math.max(0, Math.trunc(Number(options._portalAttempt) || 0));
    var size = ["small", "medium", "large"].indexOf(options.size) >= 0 ? options.size : "medium";
    var density = Math.max(3, Math.min(9, Math.round(Number(options.density) || 6)));
    var requested = ["processional", "vault", "warren"].indexOf(options.topology) >= 0 ? options.topology : "surprise";
    var topologyKeys = ["processional", "vault", "warren"];
    var topology = requested === "surprise" || requested === "auto"
      ? topologyKeys[(seed + candidate) % topologyKeys.length]
      : requested;
    var layoutSeed = seed * 97 + candidate * 1009 + 17 + attempt * 1543;
    var heightSeed = seed * 193 + candidate * 1013 + 29 + attempt * 1549;
    var semanticsSeed = seed * 389 + candidate * 1019 + 43 + attempt * 1553;
    var decorSeed = seed * 769 + candidate * 1021 + 71 + attempt * 1559;
    var random = seededRandom(layoutSeed), heightRandom = seededRandom(heightSeed);
    var semanticRandom = seededRandom(semanticsSeed);
    var grid = blueprintGrid(size), slots = graphSlots(grid, topology, random);
    var count = topology === "vault" ? Math.max(4, density) : density;
    var labels = ["Arrival", "Crossing", "Sanctum", "Gallery", "Reliquary", "Watch", "Crypt", "Court", "Choir"];
    var materials = ["nave", "cloister", "crypt", "timber"];
    var verticality = String(options.verticality || "meaningful").toLowerCase();
    var maxTier = verticality === "subtle" ? 1 : verticality === "dramatic" ? 3 : 2;
    var spaces = slots.slice(0, count).map(function (slot, index) {
      var cellW = Math.floor(grid.cols / 3), cellH = Math.floor(grid.rows / 3);
      var width = Math.max(3, Math.min(cellW - 2, 3 + Math.floor(random() * Math.max(2, cellW - 3))));
      var height = Math.max(3, Math.min(cellH - 2, 3 + Math.floor(random() * Math.max(2, cellH - 3))));
      var jitterX = Math.floor(random() * 3) - 1, jitterY = Math.floor(random() * 3) - 1;
      var c = Math.max(1, Math.min(grid.cols - width - 1, slot.c - Math.floor(width / 2) + jitterX));
      var r = Math.max(1, Math.min(grid.rows - height - 1, slot.r - Math.floor(height / 2) + jitterY));
      var tier = maxTier ? Math.min(maxTier, Math.floor(heightRandom() * (maxTier + 1))) : 0;
      var labelIndex = (index + Math.floor(semanticRandom() * labels.length)) % labels.length;
      return rectSpace(
        "generated-room-" + (index + 1),
        labels[labelIndex] + " " + (index + 1),
        c, r, width, height,
        "generated-area-" + (index + 1),
        materials[Math.floor(semanticRandom() * materials.length)],
        tier * 5
      );
    });
    var edges = graphEdges(topology, spaces.length, random);
    var connectionPlan = planGeneratedConnections(grid, spaces, edges);
    if (!connectionPlan.ok && attempt < 12) return produceSeeded(Object.assign({}, options, { _portalAttempt: attempt + 1 }));
    if (!connectionPlan.ok) throw new Error(connectionPlan.reason);
    var regions = spaces.map(function (space) {
      return { id: space.discoveryRegion, label: space.label };
    });
    var out = fixtureBase(
      "generated-" + seed + "-" + candidate,
      "Generated " + topology.charAt(0).toUpperCase() + topology.slice(1) + " · Seed " + seed,
      topology === "processional" ? "generated processional route"
        : topology === "vault" ? "generated loop and hub"
        : "generated branching graph",
      spaces, connectionPlan.corridors, connectionPlan.architecture, [], [], [], regions
    );
    out.grid = grid;
    out.connectors = connectionPlan.connectors;
    out.graph = {
      nodes: spaces.map(function (space) { return { id: space.id, semantic: space.label }; }),
      edges: edges.map(function (edge) { return { from: spaces[edge[0]].id, to: spaces[edge[1]].id }; })
    };
    out = withSource(out, "seeded", {
      seed: seed,
      candidate: candidate,
      generator: "graph-first/v1",
      deterministic: true,
      generationAttempt: attempt + 1,
      rejectedLayouts: attempt,
      controls: { size: size, topology: requested, density: density, verticality: verticality },
      subSeeds: { layout: layoutSeed, height: heightSeed, semantics: semanticsSeed, decor: decorSeed }
    });
    var compiled = compile(out, {});
    var connected = tacticalConnectivity(compiled);
    if (!connected.ok) throw new Error("Generated battlefield could not be connected across its elevation changes.");
    out.source.audit = {
      connected: connected.ok,
      reachable: connected.reachable,
      open: connected.open,
      architecture: "portal-owned/v1",
      repaired: false,
      repairCount: 0
    };
    return out;
  }
  function produceImportedSample() {
    var out = withSource(FIXTURES.processional, "imported", {
      fixtureKey: "processional",
      sourceName: "Painted Abbey Study",
      sourceRights: "Code-native sample artwork",
      underlay: true,
      review: [
        { id: "floor-regions", label: "3 floor regions", confidence: 0.96, accepted: false },
        { id: "wall-contours", label: "42 wall contours", confidence: 0.88, accepted: false },
        { id: "openings", label: "2 openings · 1 stair", confidence: 0.71, accepted: false },
        { id: "elevation", label: "Raised choir · 5 ft", confidence: 0.64, accepted: false }
      ]
    });
    out.id = "imported-painted-abbey";
    out.name = "Painted Abbey Conversion";
    return out;
  }
  function produceBlank(options) {
    options = options || {};
    var size = ["small", "medium", "large"].indexOf(options.size) >= 0 ? options.size : "medium";
    var out = withSource(fixtureBase(
      "blank-battlefield", "Untitled Battlefield", "empty buildable grid",
      [], [], [], [], [], [], []
    ), "blank", { fixtureKey: "blank", deterministic: true, size: size });
    out.grid = blueprintGrid(size);
    return out;
  }
  function acceptImportFinding(blueprint, findingId) {
    var out = copy(blueprint);
    if (!out.source || out.source.kind !== "imported" || !Array.isArray(out.source.review)) return out;
    out.source.review.forEach(function (finding) {
      if (finding.id === findingId || findingId === "all") finding.accepted = true;
    });
    return out;
  }
  function createHandoff(blueprint, build) {
    var document = copy(blueprint);
    return {
      contract: "forge-blueprint-handoff/v1",
      blueprint: document,
      blueprintId: document.id,
      fingerprint: fingerprint(document),
      structuralFingerprint: structuralFingerprint(document),
      build: Object.assign({ armed: false, tool: "select" }, copy(build || {}))
    };
  }
  function encodeHandoff(handoff) {
    return encodeURIComponent(stableStringify(handoff));
  }
  function decodeHandoff(payload) {
    var handoff;
    try { handoff = JSON.parse(decodeURIComponent(String(payload || ""))); }
    catch (error) { return { ok: false, error: "Blueprint handoff could not be decoded." }; }
    if (!handoff || handoff.contract !== "forge-blueprint-handoff/v1" || !handoff.blueprint) {
      return { ok: false, error: "Blueprint handoff contract is missing." };
    }
    if (handoff.blueprintId !== handoff.blueprint.id || handoff.fingerprint !== fingerprint(handoff.blueprint)) {
      return { ok: false, error: "Blueprint identity changed during handoff." };
    }
    return { ok: true, handoff: handoff };
  }

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
      connectors: copy(blueprint.connectors || []),
      meta: {
        source: SCHEMA, blueprintId: blueprint.id, blueprintName: blueprint.name,
        blueprintFingerprint: fingerprint(blueprint),
        topology: blueprint.topology, cellFt: blueprint.grid.cellFt,
        chunkSize: blueprint.grid.chunkSize, regions: regions,
        producer: copy(blueprint.source || sourceRecord("fixture", {}))
      }
    };
    if (blueprint.buildingSet) map.meta.buildingSet = copy(blueprint.buildingSet);
    if (blueprint.cameraViews) map.meta.cameraViews = copy(blueprint.cameraViews);
    regions.forEach(function (cell, i) {
      if (!cell) return;
      map.wall[i] = false; map.occ[i] = 0; map.h[i] = Number(cell.elevationFt) || 0;
    });
    var interpretedHeights = blueprint.source && blueprint.source.interpretation
      && blueprint.source.interpretation.heightCells || [];
    interpretedHeights.forEach(function (cell) {
      var c = Number(cell && cell.c), r = Number(cell && cell.r), heightFt = Number(cell && cell.heightFt);
      if (!Number.isInteger(c) || !Number.isInteger(r) || !Number.isFinite(heightFt)
        || c < 0 || r < 0 || c >= cols || r >= rows) return;
      var i = idx(cols, c, r);
      if (regions[i]) map.h[i] = Math.max(0, heightFt);
    });
    map.connectors.forEach(function (connector) {
      (connector && connector.path || []).forEach(function (cell) {
        var c = Number(cell && cell.c), r = Number(cell && cell.r), heightFt = Number(cell && cell.elevationFt);
        if (!Number.isInteger(c) || !Number.isInteger(r) || !Number.isFinite(heightFt)
          || c < 0 || r < 0 || c >= cols || r >= rows) return;
        var i = idx(cols, c, r);
        if (regions[i]) {
          map.h[i] = Math.max(0, heightFt);
          regions[i].elevationFt = map.h[i];
          regions[i].connector = connector.id;
          regions[i].connectors = (regions[i].connectors || []).concat(connector.id);
        }
      });
    });
    var interpretedBlocked = blueprint.source && blueprint.source.interpretation
      && blueprint.source.interpretation.blockedCells || [];
    interpretedBlocked.forEach(function (cell) {
      var c = Number(cell && cell[0]), r = Number(cell && cell[1]);
      if (!Number.isInteger(c) || !Number.isInteger(r) || c < 0 || r < 0 || c >= cols || r >= rows) return;
      var i = idx(cols, c, r);
      if (!regions[i]) return;
      map.wall[i] = true;
      map.occ[i] = 0;
      map.coverShape[i] = null;
    });
    var appliedArchitecture = copy(blueprint.architecture || []);
    Object.keys(edits || {}).sort().forEach(function (cellKey) {
      var edit = edits[cellKey], parts = cellKey.split(","), c = Number(parts[0]), r = Number(parts[1]);
      var editEdge = normalizeEdge(edit && edit.edge || parts[2]);
      appliedArchitecture = appliedArchitecture.filter(function (item) {
        if (item.c !== c || item.r !== r) return true;
        return editEdge ? normalizeEdge(item.edge) !== editEdge : !!normalizeEdge(item.edge);
      });
      if (edit && edit.kind !== "erase") appliedArchitecture.push(Object.assign(
        { id: "edit-" + cellKey, c: c, r: r },
        copy(edit),
        { edge: editEdge, rotation: editEdge ? edgeRotation(editEdge) : normalizeRotation(edit.rotation) }
      ));
    });
    appliedArchitecture.forEach(function (item) {
      if (item.c < 0 || item.r < 0 || item.c >= cols || item.r >= rows) return;
      var i = idx(cols, item.c, item.r), def = KIT[item.kind];
      if (!def || !regions[i]) return;
      if (normalizeEdge(item.edge)) return;
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
    map.meta.structureReview = copy(blueprint.source && blueprint.source.structureReview || null);
    map.meta.edgeBlockers = appliedArchitecture.filter(function (item) { return !!normalizeEdge(item.edge); }).map(function (item) {
      var def = KIT[item.kind] || {}, edge = normalizeEdge(item.edge);
      var step = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[edge];
      return {
        id: item.id,
        a: { c: item.c, r: item.r },
        b: { c: item.c + step[0], r: item.r + step[1] },
        edge: edge,
        bottomFt: map.h[idx(cols, item.c, item.r)] || 0,
        heightFt: Number(def.heightFt) || 0,
        thicknessFt: item.kind === "lowWall" ? 0.5 : 0.75,
        kind: item.kind === "lowWall" ? "low-wall" : item.kind,
        blocksMovement: item.kind === "wall",
        blocksVision: item.kind === "wall",
        grantsCover: item.kind === "wall" || item.kind === "lowWall",
        passableWhenOpen: item.kind === "door",
        state: item.kind === "door" ? "open" : null,
        connectorId: item.connectorId || null,
        render: { rotation: edgeRotation(edge), variant: item.variant || "straight" }
      };
    });
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
    (map.meta && map.meta.edgeBlockers || []).forEach(function (edge) {
      if (!normalizeEdge(edge.edge) || edge.a.c < 0 || edge.a.r < 0 || edge.a.c >= map.cols || edge.a.r >= map.rows) errors.push("invalid edge blocker " + edge.id);
    });
    (map.connectors || []).forEach(function (connector) {
      if (!connector || !connector.kind || !Array.isArray(connector.path) || connector.path.length < 2) {
        errors.push("invalid connector " + (connector && connector.id || "unknown")); return;
      }
      connector.path.forEach(function (cell) {
        if (!Number.isInteger(cell.c) || !Number.isInteger(cell.r) || cell.c < 0 || cell.r < 0
          || cell.c >= map.cols || cell.r >= map.rows || map.wall[idx(map.cols, cell.c, cell.r)]) {
          errors.push("invalid connector cell " + connector.id);
        }
      });
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
    return {
      ok: open.length > 0 && missing.length === 0,
      reachable: Object.keys(seen).length,
      open: open.length,
      missing: missing,
      reason: open.length ? null : "first room required"
    };
  }
  function tacticalConnectivity(map) {
    var open = [], start = null, seen = {}, queue = [], segments = {};
    function segmentKey(a, b) { return key(a.c, a.r) + ">" + key(b.c, b.r); }
    (map.connectors || []).forEach(function (connector) {
      if (!connector || connector.state === "closed" || connector.state === "broken") return;
      var requires = connector.requires || {};
      if (requires.fly || requires.climb || requires.swim || requires.jump) return;
      var path = connector.path || [];
      for (var i = 1; i < path.length; i++) {
        segments[segmentKey(path[i - 1], path[i])] = true;
        if (!connector.oneWay) segments[segmentKey(path[i], path[i - 1])] = true;
      }
    });
    for (var r = 0; r < map.rows; r++) for (var c = 0; c < map.cols; c++) {
      if (!map.wall[idx(map.cols, c, r)]) { open.push(key(c, r)); if (!start) start = { c: c, r: r }; }
    }
    if (start) { queue.push(start); seen[key(start.c, start.r)] = true; }
    while (queue.length) {
      var at = queue.shift();
      CARDINAL.forEach(function (step) {
        var next = { c: at.c + step[0], r: at.r + step[1] }, nextKey = key(next.c, next.r);
        if (next.c < 0 || next.r < 0 || next.c >= map.cols || next.r >= map.rows
          || seen[nextKey] || map.wall[idx(map.cols, next.c, next.r)]) return;
        var riseFt = Math.abs(map.h[idx(map.cols, next.c, next.r)] - map.h[idx(map.cols, at.c, at.r)]);
        if (riseFt > 5 && !segments[segmentKey(at, next)]) return;
        seen[nextKey] = true; queue.push(next);
      });
    }
    var missing = open.filter(function (cellKey) { return !seen[cellKey]; });
    return {
      ok: open.length > 0 && missing.length === 0,
      reachable: Object.keys(seen).length, open: open.length, missing: missing,
      reason: !open.length ? "first room required" : missing.length ? missing.length + " elevation-isolated cells" : null
    };
  }
  function chunkFor(blueprint, c, r) {
    var size = blueprint.grid.chunkSize;
    return { c: Math.floor(c / size), r: Math.floor(r / size), key: Math.floor(c / size) + "," + Math.floor(r / size) };
  }
  function chunkCount(blueprint) {
    return Math.ceil(blueprint.grid.cols / blueprint.grid.chunkSize) * Math.ceil(blueprint.grid.rows / blueprint.grid.chunkSize);
  }
  function editCell(edits, c, r, kind, rotation, edge) {
    var out = copy(edits || {});
    var normalizedEdge = normalizeEdge(edge);
    var editKey = key(c, r) + (normalizedEdge ? "," + normalizedEdge : "");
    if (kind === "erase") out[editKey] = { kind: "erase", rotation: 0, edge: normalizedEdge };
    else {
      if (!KIT[kind] || ["wall", "lowWall", "door"].indexOf(kind) < 0) throw new Error("Blueprint editor only owns wall, lowWall, door, and erase");
      out[editKey] = {
        kind: kind,
        rotation: normalizedEdge ? edgeRotation(normalizedEdge) : normalizeRotation(rotation),
        edge: normalizedEdge,
        variant: kind === "door" ? "oak" : "straight"
      };
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
  function rebuildAreaZones(blueprint) {
    blueprint.elevationZones = blueprint.spaces.map(function (space) {
      return { id: "elevation-" + space.id, polygon: copy(space.polygon), elevationFt: space.elevationFt, material: space.material, discoveryRegion: space.discoveryRegion };
    });
    blueprint.materialZones = blueprint.spaces.map(function (space) {
      return { id: "material-" + space.id, polygon: copy(space.polygon), material: space.material, discoveryRegion: space.discoveryRegion };
    });
    blueprint.encounterRegions = (blueprint.discoveryRegions || []).map(function (region, order) {
      return { id: "encounter-" + region.id, discoveryRegion: region.id, order: order };
    });
    return blueprint;
  }
  function spaceBounds(space) {
    if (!space || !space.polygon || !space.polygon.length) return null;
    var xs = space.polygon.map(function (point) { return point[0]; });
    var ys = space.polygon.map(function (point) { return point[1]; });
    return {
      minX: Math.min.apply(null, xs), maxX: Math.max.apply(null, xs),
      minY: Math.min.apply(null, ys), maxY: Math.max.apply(null, ys)
    };
  }
  function nextRecordId(records, prefix) {
    var used = {};
    (records || []).forEach(function (record) { used[record.id] = true; });
    var n = 1;
    while (used[prefix + "-" + n]) n++;
    return prefix + "-" + n;
  }
  function addRoom(blueprint, from, to) {
    var out = copy(blueprint), cols = out.grid.cols, rows = out.grid.rows;
    var minX = Math.max(0, Math.min(from.c, to.c));
    var maxX = Math.min(cols, Math.max(from.c, to.c) + 1);
    var minY = Math.max(0, Math.min(from.r, to.r));
    var maxY = Math.min(rows, Math.max(from.r, to.r) + 1);
    if (maxX - minX < 3 || maxY - minY < 3) return blueprint;
    var occupied = cellRegions(out);
    for (var r = minY; r < maxY; r++) for (var c = minX; c < maxX; c++) {
      if (occupied[idx(cols, c, r)]) return blueprint;
    }
    var roomId = nextRecordId(out.spaces, "room");
    var regionId = nextRecordId(out.discoveryRegions, "area");
    out.spaces.push({
      id: roomId,
      label: "New Room " + roomId.split("-").pop(),
      polygon: [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]],
      elevationFt: 0,
      material: "nave",
      discoveryRegion: regionId
    });
    out.discoveryRegions.push({ id: regionId, label: "New Area " + regionId.split("-").pop() });
    out.areaSettings = out.areaSettings || {};
    out.areaSettings[regionId] = {
      dressTogether: true,
      revealTogether: true,
      provenance: "DM-drawn room"
    };
    out.topology = "DM-shaped layout";
    return rebuildAreaZones(out);
  }
  function passageAnchors(first, second) {
    var a = spaceBounds(first), b = spaceBounds(second);
    if (!a || !b) return null;
    var ac = { c: Math.floor((a.minX + a.maxX - 1) / 2), r: Math.floor((a.minY + a.maxY - 1) / 2) };
    var bc = { c: Math.floor((b.minX + b.maxX - 1) / 2), r: Math.floor((b.minY + b.maxY - 1) / 2) };
    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    if (a.maxX <= b.minX) {
      var eastR = clamp(ac.r, b.minY, b.maxY - 1);
      return { from: { c: a.maxX - 1, r: eastR }, to: { c: b.minX, r: eastR } };
    }
    if (b.maxX <= a.minX) {
      var westR = clamp(ac.r, b.minY, b.maxY - 1);
      return { from: { c: a.minX, r: westR }, to: { c: b.maxX - 1, r: westR } };
    }
    if (a.maxY <= b.minY) {
      var southC = clamp(ac.c, b.minX, b.maxX - 1);
      return { from: { c: southC, r: a.maxY - 1 }, to: { c: southC, r: b.minY } };
    }
    if (b.maxY <= a.minY) {
      var northC = clamp(ac.c, b.minX, b.maxX - 1);
      return { from: { c: northC, r: a.minY }, to: { c: northC, r: b.maxY - 1 } };
    }
    return { from: ac, to: bc };
  }
  function connectSpaces(blueprint, firstId, secondId, width) {
    if (!firstId || !secondId || firstId === secondId) return blueprint;
    var out = copy(blueprint);
    var first = out.spaces.find(function (space) { return space.id === firstId; });
    var second = out.spaces.find(function (space) { return space.id === secondId; });
    var anchors = passageAnchors(first, second);
    if (!first || !second || !anchors) return blueprint;
    var corridorId = nextRecordId(out.corridors, "passage");
    out.corridors.push({
      id: corridorId,
      label: "Passage " + corridorId.split("-").pop(),
      from: [anchors.from.c, anchors.from.r],
      to: [anchors.to.c, anchors.to.r],
      width: Math.max(1, Math.min(3, Math.round(Number(width) || 2))),
      elevationFt: Math.min(Number(first.elevationFt) || 0, Number(second.elevationFt) || 0),
      material: first.material || "nave",
      discoveryRegion: second.discoveryRegion,
      fromSpaceId: first.id,
      toSpaceId: second.id
    });
    out.topology = "DM-shaped layout";
    return rebuildAreaZones(out);
  }
  function addPassage(blueprint, from, to, width, regionId) {
    var out = copy(blueprint), cols = out.grid.cols, rows = out.grid.rows;
    if (!from || !to || from.c === to.c && from.r === to.r) return blueprint;
    var corridorId = nextRecordId(out.corridors, "passage");
    var regions = cellRegions(out);
    var source = from.c >= 0 && from.r >= 0 && from.c < cols && from.r < rows
      ? regions[idx(cols, from.c, from.r)] : null;
    var chosenRegion = regionId || (source && source.region) || (out.discoveryRegions[0] && out.discoveryRegions[0].id);
    out.corridors.push({
      id: corridorId,
      label: "Passage " + corridorId.split("-").pop(),
      from: [Math.max(0, Math.min(cols - 1, from.c)), Math.max(0, Math.min(rows - 1, from.r))],
      to: [Math.max(0, Math.min(cols - 1, to.c)), Math.max(0, Math.min(rows - 1, to.r))],
      width: Math.max(1, Math.min(3, Math.round(Number(width) || 1))),
      elevationFt: 0,
      material: "nave",
      discoveryRegion: chosenRegion
    });
    out.topology = "DM-shaped layout";
    return rebuildAreaZones(out);
  }
  function removePassage(blueprint, passageId) {
    var out = copy(blueprint);
    var before = out.corridors.length;
    out.corridors = out.corridors.filter(function (corridor) { return corridor.id !== passageId; });
    if (out.corridors.length === before) return blueprint;
    out.topology = "DM-shaped layout";
    return rebuildAreaZones(out);
  }
  function changeSpace(blueprint, spaceId, elevationFt, material) {
    var out = copy(blueprint), changed = false;
    out.spaces.forEach(function (space) {
      if (space.id !== spaceId) return;
      if (Number.isFinite(Number(elevationFt))) space.elevationFt = Math.max(0, Math.min(15, Number(elevationFt)));
      if (MATERIALS[material]) space.material = material;
      changed = true;
    });
    return changed ? rebuildAreaZones(out) : blueprint;
  }
  function placeProp(blueprint, c, r, kind, rotation) {
    if (!KIT[kind] || ["pew", "pillar", "statue", "rubble", "brazier", "altar"].indexOf(kind) < 0) return blueprint;
    var out = copy(blueprint), regions = cellRegions(out);
    var region = c >= 0 && r >= 0 && c < out.grid.cols && r < out.grid.rows
      ? regions[idx(out.grid.cols, c, r)] : null;
    if (!region) return blueprint;
    out.props = (out.props || []).filter(function (item) { return item.c !== c || item.r !== r; });
    out.props.push(prop(kind, c, r, region.region, rotation, "dm-placed"));
    return out;
  }
  function divideSpace(edits, blueprint, spaceId, axis) {
    var space = (blueprint.spaces || []).find(function (entry) { return entry.id === spaceId; });
    var bounds = spaceBounds(space), out = copy(edits || {});
    if (!bounds) return out;
    var occupied = (blueprint.props || []).concat(blueprint.spawns || []).reduce(function (memo, item) {
      memo[key(item.c, item.r)] = true;
      return memo;
    }, {});
    var vertical = axis !== "horizontal";
    var fixed = Math.floor(vertical
      ? (bounds.minX + bounds.maxX) / 2
      : (bounds.minY + bounds.maxY) / 2);
    var start = vertical ? bounds.minY : bounds.minX;
    var end = vertical ? bounds.maxY : bounds.maxX;
    var doorway = Math.floor((start + end - 1) / 2);
    for (var along = start; along < end; along++) {
      var c = vertical ? fixed - 1 : along, r = vertical ? along : fixed - 1;
      if (occupied[key(c, r)]) continue;
      out = editCell(out, c, r, along === doorway ? "door" : "wall", vertical ? 90 : 0, vertical ? "E" : "S");
    }
    return out;
  }
  function lineCells(anchor, direction, length, cols, rows) {
    var steps = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
    var step = steps[direction], out = [];
    if (!anchor || !step) return out;
    for (var i = 1; i <= Math.max(0, Number(length) || 0); i++) {
      var c = anchor.c + step[0] * i, r = anchor.r + step[1] * i;
      if (c < 0 || r < 0 || c >= cols || r >= rows) break;
      out.push({ c: c, r: r });
    }
    return out;
  }
  function lineEdges(anchor, direction, length, cols, rows) {
    if (!anchor || !normalizeEdge(anchor.edge)) return [];
    return lineCells(anchor, direction, length, cols, rows).map(function (cell) {
      return { c: cell.c, r: cell.r, edge: normalizeEdge(anchor.edge) };
    });
  }
  function areaSummary(blueprint, regionId) {
    var cells = cellRegions(blueprint), cols = blueprint.grid.cols, rows = blueprint.grid.rows;
    var count = 0, boundaryEdges = 0, neighbors = {}, touchingEdges = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var cell = cells[idx(cols, c, r)];
      if (!cell || cell.region !== regionId) continue;
      count++;
      CARDINAL.forEach(function (step) {
        var nc = c + step[0], nr = r + step[1], other = nc < 0 || nr < 0 || nc >= cols || nr >= rows ? null : cells[idx(cols, nc, nr)];
        if (!other || other.region !== regionId) boundaryEdges++;
        if (other && other.region && other.region !== regionId) {
          var vertical = step[0] !== 0;
          neighbors[other.region] = true;
          touchingEdges.push({
            neighborId: other.region,
            orientation: vertical ? "v" : "h",
            constant: vertical ? c + (step[0] > 0 ? 1 : 0) : r + (step[1] > 0 ? 1 : 0),
            along: vertical ? r : c,
            markerC: c + 0.5 + step[0] * 0.5,
            markerR: r + 0.5 + step[1] * 0.5,
            sourceC: c,
            sourceR: r
          });
        }
      });
    }
    touchingEdges.sort(function (a, b) {
      var keyA = a.neighborId + "|" + a.orientation + "|" + a.constant;
      var keyB = b.neighborId + "|" + b.orientation + "|" + b.constant;
      return keyA === keyB ? a.along - b.along : keyA.localeCompare(keyB);
    });
    var thresholds = [];
    touchingEdges.forEach(function (edge) {
      var keyName = edge.neighborId + "|" + edge.orientation + "|" + edge.constant;
      var current = thresholds[thresholds.length - 1];
      if (!current || current.key !== keyName || edge.along > current.lastAlong + 1) {
        thresholds.push({
          key: keyName,
          neighborId: edge.neighborId,
          edgeCount: 1,
          lastAlong: edge.along,
          markerCTotal: edge.markerC,
          markerRTotal: edge.markerR,
          sourceC: edge.sourceC,
          sourceR: edge.sourceR
        });
      } else {
        current.edgeCount++;
        current.lastAlong = edge.along;
        current.markerCTotal += edge.markerC;
        current.markerRTotal += edge.markerR;
      }
    });
    thresholds = thresholds.map(function (threshold) {
      return {
        neighborId: threshold.neighborId,
        edgeCount: threshold.edgeCount,
        markerC: threshold.markerCTotal / threshold.edgeCount,
        markerR: threshold.markerRTotal / threshold.edgeCount,
        sourceC: threshold.sourceC,
        sourceR: threshold.sourceR
      };
    });
    return {
      id: regionId,
      cellCount: count,
      boundaryEdges: boundaryEdges,
      neighborIds: Object.keys(neighbors).sort(),
      connectionCount: Object.keys(neighbors).length,
      thresholdCount: thresholds.length,
      thresholds: thresholds,
      complete: count > 0
    };
  }
  function renameArea(blueprint, regionId, label) {
    var out = copy(blueprint), clean = String(label || "").trim();
    if (!clean) return out;
    (out.discoveryRegions || []).forEach(function (region) {
      if (region.id === regionId) region.label = clean;
    });
    out.areaSettings = out.areaSettings || {};
    out.areaSettings[regionId] = Object.assign({}, out.areaSettings[regionId] || {}, { provenance: "DM-renamed" });
    return out;
  }
  function setAreaSetting(blueprint, regionId, keyName, value) {
    var out = copy(blueprint);
    if (["dressTogether", "revealTogether"].indexOf(keyName) < 0) return out;
    out.areaSettings = out.areaSettings || {};
    out.areaSettings[regionId] = Object.assign({
      dressTogether: true, revealTogether: true, provenance: "DM-authored"
    }, out.areaSettings[regionId] || {});
    out.areaSettings[regionId][keyName] = !!value;
    return out;
  }
  function mergeAreas(blueprint, keepId, absorbId) {
    var out = copy(blueprint);
    if (!keepId || !absorbId || keepId === absorbId) return out;
    ["spaces", "corridors", "architecture", "props", "lights"].forEach(function (name) {
      (out[name] || []).forEach(function (item) {
        if (item.discoveryRegion === absorbId) item.discoveryRegion = keepId;
      });
    });
    out.discoveryRegions = (out.discoveryRegions || []).filter(function (region) { return region.id !== absorbId; });
    out.areaSettings = out.areaSettings || {};
    out.areaSettings[keepId] = Object.assign({
      dressTogether: true, revealTogether: true
    }, out.areaSettings[keepId] || {}, { provenance: "DM-merged" });
    delete out.areaSettings[absorbId];
    return rebuildAreaZones(out);
  }
  function splitArea(blueprint, regionId) {
    var out = copy(blueprint), candidates = (out.spaces || []).filter(function (space) { return space.discoveryRegion === regionId; });
    if (!candidates.length) return out;
    candidates.sort(function (a, b) {
      function area(space) {
        var xs = space.polygon.map(function (point) { return point[0]; }), ys = space.polygon.map(function (point) { return point[1]; });
        return (Math.max.apply(null, xs) - Math.min.apply(null, xs)) * (Math.max.apply(null, ys) - Math.min.apply(null, ys));
      }
      return area(b) - area(a);
    });
    var space = candidates[0], xs = space.polygon.map(function (point) { return point[0]; }), ys = space.polygon.map(function (point) { return point[1]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var vertical = maxX - minX >= maxY - minY, cut = Math.floor((vertical ? minX + maxX : minY + maxY) / 2);
    if ((vertical && (cut <= minX || cut >= maxX)) || (!vertical && (cut <= minY || cut >= maxY))) return out;
    var existing = {};
    (out.discoveryRegions || []).forEach(function (region) { existing[region.id] = true; });
    var baseId = regionId + "-annex", newId = baseId, n = 2;
    while (existing[newId]) newId = baseId + "-" + n++;
    var firstPolygon = vertical
      ? [[minX, minY], [cut, minY], [cut, maxY], [minX, maxY]]
      : [[minX, minY], [maxX, minY], [maxX, cut], [minX, cut]];
    var secondPolygon = vertical
      ? [[cut, minY], [maxX, minY], [maxX, maxY], [cut, maxY]]
      : [[minX, cut], [maxX, cut], [maxX, maxY], [minX, maxY]];
    space.polygon = firstPolygon;
    var splitSpace = copy(space);
    splitSpace.id = space.id + "-" + newId;
    splitSpace.label = space.label + " Annex";
    splitSpace.discoveryRegion = newId;
    splitSpace.polygon = secondPolygon;
    out.spaces.push(splitSpace);
    ["architecture", "props", "lights"].forEach(function (name) {
      (out[name] || []).forEach(function (item) {
        if (item.discoveryRegion === regionId && pointInPolygon(item.c, item.r, secondPolygon)) item.discoveryRegion = newId;
      });
    });
    var at = (out.discoveryRegions || []).findIndex(function (region) { return region.id === regionId; });
    var sourceRegion = out.discoveryRegions[at] || { label: regionId };
    out.discoveryRegions.splice(at + 1, 0, { id: newId, label: sourceRegion.label + " Annex" });
    out.areaSettings = out.areaSettings || {};
    out.areaSettings[newId] = Object.assign({
      dressTogether: true, revealTogether: true
    }, copy(out.areaSettings[regionId] || {}), { provenance: "DM-authored split" });
    return rebuildAreaZones(out);
  }
  function normalizeGridCalibration(value) {
    value = value || {};
    var cellPx = Math.max(4, Number(value.cellPx) || 28);
    var nativeW = Math.max(cellPx, Number(value.nativeW) || 784);
    var nativeH = Math.max(cellPx, Number(value.nativeH) || 560);
    var originX = Number(value.originX) || 0;
    var originY = Number(value.originY) || 0;
    originX = ((originX % cellPx) + cellPx) % cellPx;
    originY = ((originY % cellPx) + cellPx) % cellPx;
    return {
      cellPx: cellPx,
      originX: originX,
      originY: originY,
      nativeW: nativeW,
      nativeH: nativeH,
      cols: Math.max(1, Math.round((nativeW - originX) / cellPx)),
      rows: Math.max(1, Math.round((nativeH - originY) / cellPx))
    };
  }
  function historyStart(snapshot) {
    return { past: [], present: { label: "Opened Blueprint", snapshot: copy(snapshot) }, future: [] };
  }
  function historyCommit(history, label, snapshot) {
    var next = copy(history || historyStart(snapshot));
    var serialized = JSON.stringify(snapshot);
    if (JSON.stringify(next.present.snapshot) === serialized) return next;
    next.past.push(copy(next.present));
    next.present = { label: label || "Map change", snapshot: copy(snapshot) };
    next.future = [];
    return next;
  }
  function historyUndo(history) {
    var next = copy(history);
    if (!next || !next.past.length) return next;
    next.future.unshift(copy(next.present));
    next.present = next.past.pop();
    return next;
  }
  function historyRedo(history) {
    var next = copy(history);
    if (!next || !next.future.length) return next;
    next.past.push(copy(next.present));
    next.present = next.future.shift();
    return next;
  }
  function formationPositions(map, anchor, count, seed, style) {
    if (!map || !anchor || count < 1) return [];
    var patterns = {
      line: [[0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0], [3, 0], [-3, 0], [0, 1], [0, -1]],
      wedge: [[0, 0], [-1, 1], [1, 1], [-2, 2], [2, 2], [0, 1], [0, 2], [-1, 2], [1, 2]],
      cluster: [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]
    };
    var ring = patterns[style] || patterns.cluster;
    var offset = Math.abs(Number(seed) || 0) % ring.length, out = [];
    for (var i = 0; i < ring.length && out.length < count; i++) {
      var delta = ring[(i + offset) % ring.length], c = anchor.c + delta[0], r = anchor.r + delta[1];
      if (c < 0 || r < 0 || c >= map.cols || r >= map.rows || map.wall[idx(map.cols, c, r)]) continue;
      if ((map.props || []).some(function (item) { return item.c === c && item.r === r; })) continue;
      out.push({ c: c, r: r });
    }
    return out;
  }

  return {
    SCHEMA: SCHEMA, KIT: KIT, MATERIALS: MATERIALS, FIXTURES: FIXTURES,
    PRODUCER_LABELS: PRODUCER_LABELS,
    copy: copy, stableStringify: stableStringify, fingerprint: fingerprint,
    structuralFingerprint: structuralFingerprint,
    key: key, idx: idx, normalizeRotation: normalizeRotation,
    normalizeEdge: normalizeEdge, edgeRotation: edgeRotation,
    oppositeEdge: oppositeEdge, edgeReferences: edgeReferences,
    pointInPolygon: pointInPolygon, corridorCells: corridorCells, cellRegions: cellRegions,
    compile: compile, validateMap: validateMap, reachable: reachable, connectivity: connectivity, tacticalConnectivity: tacticalConnectivity,
    chunkFor: chunkFor, chunkCount: chunkCount, editCell: editCell, changeZone: changeZone,
    spaceBounds: spaceBounds, addRoom: addRoom, connectSpaces: connectSpaces,
    addPassage: addPassage, removePassage: removePassage, changeSpace: changeSpace,
    placeProp: placeProp, divideSpace: divideSpace, lineCells: lineCells, lineEdges: lineEdges,
    areaSummary: areaSummary, renameArea: renameArea, setAreaSetting: setAreaSetting,
    mergeAreas: mergeAreas, splitArea: splitArea,
    normalizeGridCalibration: normalizeGridCalibration,
    historyStart: historyStart, historyCommit: historyCommit, historyUndo: historyUndo, historyRedo: historyRedo,
    formationPositions: formationPositions,
    withSource: withSource, produceSeeded: produceSeeded, produceImportedSample: produceImportedSample,
    produceBlank: produceBlank, acceptImportFinding: acceptImportFinding,
    createHandoff: createHandoff, encodeHandoff: encodeHandoff, decodeHandoff: decodeHandoff
  };
});
