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
      createdBy: "standalone-proof"
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
  function produceSeeded(options) {
    options = options || {};
    var seed = Number.isFinite(Number(options.seed)) ? Math.abs(Math.trunc(Number(options.seed))) : 1847;
    var requested = ["processional", "vault", "warren"].indexOf(options.topology) >= 0 ? options.topology : "auto";
    var keys = ["processional", "vault", "warren"];
    var fixtureKey = requested === "auto" ? keys[seed % keys.length] : requested;
    var out = withSource(FIXTURES[fixtureKey], "seeded", {
      seed: seed,
      fixtureKey: fixtureKey,
      generator: "graph-handoff-study/v1",
      deterministic: true
    });
    out.id = "seed-" + seed + "-" + out.id;
    out.name = out.name + " · Seed " + seed;
    return out;
  }
  function produceImportedSample() {
    var out = withSource(FIXTURES.processional, "imported", {
      fixtureKey: "processional",
      sourceName: "Painted Abbey Study",
      sourceRights: "Code-native proof artwork",
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
  function produceBlank() {
    var spaces = [rectSpace("sanctum", "Empty Sanctum", 8, 5, 12, 10, "sanctum", "nave", 0)];
    return withSource(fixtureBase(
      "blank-sanctum", "Untitled Battlefield", "single open room",
      spaces, [], [], [], [], [],
      [{ id: "sanctum", label: "Empty Sanctum" }]
    ), "blank", { fixtureKey: "blank", deterministic: true });
  }
  function acceptImportFinding(blueprint, findingId) {
    var out = copy(blueprint);
    if (!out.source || out.source.kind !== "imported" || !Array.isArray(out.source.review)) return out;
    out.source.review.forEach(function (finding) {
      if (finding.id === findingId || findingId === "all") finding.accepted = true;
    });
    return out;
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
      meta: {
        source: SCHEMA, blueprintId: blueprint.id, blueprintName: blueprint.name,
        topology: blueprint.topology, cellFt: blueprint.grid.cellFt,
        chunkSize: blueprint.grid.chunkSize, regions: regions,
        producer: copy(blueprint.source || sourceRecord("fixture", {}))
      }
    };
    regions.forEach(function (cell, i) {
      if (!cell) return;
      map.wall[i] = false; map.occ[i] = 0; map.h[i] = Number(cell.elevationFt) || 0;
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
    map.meta.edgeBlockers = appliedArchitecture.filter(function (item) { return !!normalizeEdge(item.edge); }).map(function (item) {
      var def = KIT[item.kind] || {}, edge = normalizeEdge(item.edge);
      var step = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[edge];
      return {
        id: item.id,
        a: { c: item.c, r: item.r },
        b: { c: item.c + step[0], r: item.r + step[1] },
        edge: edge,
        bottomFt: 0,
        heightFt: Number(def.heightFt) || 0,
        thicknessFt: item.kind === "lowWall" ? 0.5 : 0.75,
        kind: item.kind === "lowWall" ? "low-wall" : item.kind,
        blocksMovement: item.kind === "wall",
        blocksVision: item.kind === "wall",
        grantsCover: item.kind === "wall" || item.kind === "lowWall",
        passableWhenOpen: item.kind === "door",
        state: item.kind === "door" ? "open" : null,
        connectorId: null,
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
  function editCell(edits, c, r, kind, rotation, edge) {
    var out = copy(edits || {});
    var normalizedEdge = normalizeEdge(edge);
    var editKey = key(c, r) + (normalizedEdge ? "," + normalizedEdge : "");
    if (kind === "erase") out[editKey] = { kind: "erase", rotation: 0, edge: normalizedEdge };
    else {
      if (!KIT[kind] || ["wall", "lowWall", "door"].indexOf(kind) < 0) throw new Error("Proof editor only owns wall, lowWall, door, and erase");
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
    copy: copy, key: key, idx: idx, normalizeRotation: normalizeRotation,
    normalizeEdge: normalizeEdge, edgeRotation: edgeRotation,
    oppositeEdge: oppositeEdge, edgeReferences: edgeReferences,
    pointInPolygon: pointInPolygon, corridorCells: corridorCells, cellRegions: cellRegions,
    compile: compile, validateMap: validateMap, reachable: reachable, connectivity: connectivity,
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
    produceBlank: produceBlank, acceptImportFinding: acceptImportFinding
  };
});
