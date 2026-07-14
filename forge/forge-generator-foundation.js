/* ── forge-generator-foundation.js ─────────────────────────────────────
   Battle Forge Phase 2 foundation.

   This module does NOT replace forge-dungeon.js. The current generator already
   owns room scatter/separation, Delaunay candidates, MST connectivity, loop
   restoration, BFS semantics, and its critical route. This layer makes those
   facts versioned, serializable, independently seeded, and safe to save.

   Dual export: browser (window.ForgeGeneratorFoundation) + Node.
   Pure data only: no DOM, Supabase, or three.js dependency.
   ─────────────────────────────────────────────────────────────────────── */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeGeneratorFoundation = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var GENERATOR_VERSION = "2.0.0-snapshot.1";
  var STAGES = Object.freeze(["layout", "height", "semantics", "decor", "foes"]);
  var ARCHETYPES = Object.freeze([
    "legacy-dungeon",
    "valley",
    "canyon",
    "central-hill",
    "ring",
    "split-plateau",
    "bridge-crossing",
    "island-chain",
    "courtyard",
    "cavern-chambers",
    "temple-terraces",
    "ridge",
    "basin"
  ]);

  function asUint32(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) n = 0;
    return n >>> 0;
  }

  /* FNV-1a with a final avalanche. Stable in browsers and Node. */
  function hash32(value) {
    var s = String(value == null ? "" : value);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }

  function deriveSeed(rootSeed, label) {
    var seed = asUint32(rootSeed);
    return hash32(seed + ":" + String(label)) >>> 0;
  }

  function stageSeeds(rootSeed, overrides) {
    var out = {};
    overrides = overrides || {};
    for (var i = 0; i < STAGES.length; i++) {
      var stage = STAGES[i];
      out[stage] = Object.prototype.hasOwnProperty.call(overrides, stage)
        ? asUint32(overrides[stage])
        : deriveSeed(rootSeed, "forge-stage:" + stage);
    }
    return out;
  }

  function assertArchetype(value) {
    var v = value == null || value === "" ? "legacy-dungeon" : String(value);
    if (ARCHETYPES.indexOf(v) < 0) {
      throw new Error("forge-generator-foundation: unknown archetype \"" + v + "\"");
    }
    return v;
  }

  function assertThemeKey(themeKey, allowed) {
    if (!Array.isArray(allowed) || !allowed.length) {
      throw new Error("forge-generator-foundation: theme key list is unavailable");
    }
    if (allowed.indexOf(themeKey) < 0) {
      throw new Error(
        "forge-generator-foundation: unknown themeKey \"" + themeKey +
        "\" (expected one of: " + allowed.join(", ") + ")"
      );
    }
    return themeKey;
  }

  function numberOr(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  /* Deep-clones to plain JSON with JSON.stringify semantics: functions and
     true cycles degrade (null in arrays, dropped in objects) but SHARED
     non-cyclic references clone fine on every path, and array positions are
     always preserved. Cycle detection is per-ancestry (the stack), not a
     permanent visited-set — a WeakSet here would silently drop the second
     occurrence of any legitimately shared object.
     opts.stripKeys removes named keys at any depth; snapshotMap uses it on
     meta only, to stop a prior envelope nesting a mapSnapshot inside itself. */
  function clonePlain(value, opts) {
    var stripKeys = opts && Array.isArray(opts.stripKeys) ? opts.stripKeys : null;
    var stack = [];
    function walk(v) {
      if (typeof v === "function") return undefined;
      if (v == null || typeof v !== "object") return v;
      if (stack.indexOf(v) >= 0) return undefined; // true cycle only
      stack.push(v);
      var out;
      if (ArrayBuffer.isView(v)) {
        out = Array.prototype.slice.call(v);
      } else if (Array.isArray(v)) {
        out = new Array(v.length);
        for (var i = 0; i < v.length; i++) {
          var av = walk(v[i]);
          out[i] = av === undefined ? null : av; // hold the position
        }
      } else {
        out = {};
        Object.keys(v).sort().forEach(function (key) {
          if (stripKeys && stripKeys.indexOf(key) >= 0) return;
          var cv = walk(v[key]);
          if (cv !== undefined) out[key] = cv;
        });
      }
      stack.pop();
      return out;
    }
    return walk(value);
  }

  function normalizeSpawn(s, cols, rows) {
    s = s || {};
    var out = clonePlain(s) || {};
    out.c = numberOr(s.c != null ? s.c : s.x, NaN);
    out.r = numberOr(s.r != null ? s.r : s.y, NaN);
    if (!Number.isInteger(out.c) || !Number.isInteger(out.r)) {
      throw new Error("forge-generator-foundation: spawn coordinates must be integers");
    }
    if (cols != null && rows != null && (out.c < 0 || out.r < 0 || out.c >= cols || out.r >= rows)) {
      throw new Error("forge-generator-foundation: spawn " + out.c + "," + out.r + " is outside " + cols + "x" + rows);
    }
    if (!Object.prototype.hasOwnProperty.call(out, "side")) out.side = null;
    if (!Object.prototype.hasOwnProperty.call(out, "roomId")) out.roomId = null;
    if (!Object.prototype.hasOwnProperty.call(out, "tier")) out.tier = null;
    return out;
  }

  function snapshotMap(map) {
    if (!map || typeof map !== "object") {
      throw new Error("forge-generator-foundation: snapshotMap requires a map object");
    }
    var cols = numberOr(map.cols != null ? map.cols : map.W, 0);
    var rows = numberOr(map.rows != null ? map.rows : map.H, 0);
    if (!(cols > 0 && rows > 0 && Number.isInteger(cols) && Number.isInteger(rows))) {
      throw new Error("forge-generator-foundation: map snapshot requires positive integer cols/rows");
    }
    var n = cols * rows;
    function cells(value, fill, label) {
      var a = ArrayBuffer.isView(value) ? Array.prototype.slice.call(value)
        : Array.isArray(value) ? value.slice() : [];
      if (a.length !== n) {
        throw new Error("forge-generator-foundation: " + label + " cell array length " + a.length + " does not match " + n);
      }
      return a.map(function (v) { return v == null ? fill : v; });
    }
    function finiteCells(value, fill, label) {
      return cells(value, fill, label).map(function (v) {
        var n = Number(v);
        if (!Number.isFinite(n)) throw new Error("forge-generator-foundation: " + label + " contains a non-finite value");
        return n;
      });
    }
    function occCells(value) {
      return cells(value == null ? new Array(n).fill(0) : value, 0, "occ").map(function (v) {
        if (v === Infinity || v === "Infinity") return "Infinity"; // JSON-safe opaque void
        var n = Number(v);
        if (!Number.isFinite(n)) throw new Error("forge-generator-foundation: occ contains an unsupported non-finite value");
        return n;
      });
    }
    if (map.spawns != null && !Array.isArray(map.spawns)) {
      throw new Error("forge-generator-foundation: spawns must be an array");
    }
    if (map.props != null && !Array.isArray(map.props)) {
      throw new Error("forge-generator-foundation: props must be an array");
    }
    var cover = map.coverShape == null ? new Array(n).fill(null) : cells(map.coverShape, null, "coverShape");

    return {
      cols: cols,
      rows: rows,
      h: finiteCells(map.h, 0, "h"),
      wall: cells(map.wall, false, "wall").map(Boolean),
      occ: occCells(map.occ),
      coverShape: cover.map(function (shape) { return shape == null ? null : clonePlain(shape); }),
      spawns: (map.spawns || []).map(function (spawn) { return normalizeSpawn(spawn, cols, rows); }),
      props: clonePlain(map.props || []),
      meta: clonePlain(map.meta || {}, { stripKeys: ["mapSnapshot"] })
    };
  }

  function stableStringify(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    var keys = Object.keys(value).sort();
    return "{" + keys.map(function (k) {
      return JSON.stringify(k) + ":" + stableStringify(value[k]);
    }).join(",") + "}";
  }

  function fingerprintSnapshot(snapshot) {
    return hash32(stableStringify(snapshot)).toString(16).padStart(8, "0");
  }


  function restoreMap(snapshot, expectedFingerprint) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      throw new Error("forge-generator-foundation: saved mapSnapshot is missing or malformed");
    }
    var actual = fingerprintSnapshot(snapshot);
    if (expectedFingerprint != null && String(expectedFingerprint) !== actual) {
      throw new Error(
        "forge-generator-foundation: map fingerprint mismatch (expected " +
        String(expectedFingerprint) + ", got " + actual + ")"
      );
    }
    var restored = snapshotMap(snapshot);
    restored.occ = restored.occ.map(function (v) { return v === "Infinity" ? Infinity : v; });
    return restored;
  }

  function recipeParams(envelope) {
    if (!envelope || typeof envelope !== "object") {
      throw new Error("forge-generator-foundation: encounter envelope is unavailable");
    }
    var out = clonePlain(envelope.sliders || {}) || {};
    out.seed = asUint32(envelope.seed);
    if (envelope.theme != null) out.themeKey = envelope.theme;
    if (envelope.archetype != null) out.archetype = assertArchetype(envelope.archetype);
    if (envelope.stageSeeds != null) out.stageSeeds = clonePlain(envelope.stageSeeds);
    return out;
  }

  function resolveEncounter(envelope, legacyFactory) {
    if (!envelope || typeof envelope !== "object") {
      throw new Error("forge-generator-foundation: encounter envelope is unavailable");
    }
    if (Object.prototype.hasOwnProperty.call(envelope, "mapSnapshot")) {
      var map = restoreMap(envelope.mapSnapshot, envelope.mapFingerprint);
      return {
        source: "snapshot",
        map: map,
        fingerprint: fingerprintSnapshot(envelope.mapSnapshot),
        legacy: false
      };
    }
    if (typeof legacyFactory !== "function") {
      throw new Error("forge-generator-foundation: legacy encounter requires a recipe generator");
    }
    return {
      source: "legacy-recipe",
      map: legacyFactory(recipeParams(envelope)),
      fingerprint: null,
      legacy: true
    };
  }

  function graphMetadata(dungeon) {
    if (!dungeon || !Array.isArray(dungeon.rooms)) return null;
    var edges = Array.isArray(dungeon.edges) ? dungeon.edges : [];
    var degrees = new Array(dungeon.rooms.length).fill(0);
    edges.forEach(function (e) {
      if (e && e.a >= 0 && e.a < degrees.length) degrees[e.a]++;
      if (e && e.b >= 0 && e.b < degrees.length) degrees[e.b]++;
    });

    var nodes = dungeon.rooms.map(function (r, index) {
      return {
        id: r.id != null ? r.id : index,
        cx: numberOr(r.cx, 0),
        cy: numberOr(r.cy, 0),
        w: numberOr(r.w, 0),
        h: numberOr(r.h, 0),
        depth: numberOr(r.depth, 0),
        type: r.type || null,
        difficulty: r.difficulty != null ? r.difficulty : null,
        degree: r.degree != null ? r.degree : degrees[index]
      };
    });

    var cleanEdges = edges.map(function (e, index) {
      return {
        id: index,
        a: numberOr(e.a, -1),
        b: numberOr(e.b, -1),
        isLoop: !!e.isLoop,
        isCritical: !!e.isCritical
      };
    });
    var criticalEdges = cleanEdges.filter(function (e) { return e.isCritical; }).map(function (e) { return e.id; });
    var criticalRooms = {};
    cleanEdges.forEach(function (e) {
      if (e.isCritical) { criticalRooms[e.a] = true; criticalRooms[e.b] = true; }
    });

    return {
      source: "forge-dungeon",
      seed: dungeon.seed != null ? asUint32(dungeon.seed) : null,
      entrance: dungeon.entrance != null ? dungeon.entrance : null,
      boss: dungeon.boss != null ? dungeon.boss : null,
      maxDepth: numberOr(dungeon.maxDepth, 0),
      nodes: nodes,
      edges: cleanEdges,
      overlays: {
        criticalEdges: criticalEdges,
        criticalRooms: Object.keys(criticalRooms).map(Number),
        semantics: nodes.map(function (n) { return { id: n.id, type: n.type, depth: n.depth, difficulty: n.difficulty }; })
      },
      summary: {
        rooms: nodes.length,
        edges: cleanEdges.length,
        loops: cleanEdges.filter(function (e) { return e.isLoop; }).length,
        criticalLength: criticalEdges.length,
        leaves: nodes.filter(function (n) { return n.degree === 1; }).length
      }
    };
  }

  function normalizeParams(params) {
    params = params || {};
    var seed = asUint32(params.seed);
    var archetype = assertArchetype(params.archetype);
    return {
      seed: seed,
      theme: params.theme || params.themeKey || null,
      sliders: clonePlain(params.sliders || {}),
      archetype: archetype,
      generatorVersion: GENERATOR_VERSION,
      stageSeeds: stageSeeds(seed, params.stageSeeds)
    };
  }

  function encounterEnvelope(map, params, dungeonOrGraph) {
    var p = normalizeParams(params);
    var snapshot = snapshotMap(map);
    var graph = dungeonOrGraph && Array.isArray(dungeonOrGraph.rooms)
      ? graphMetadata(dungeonOrGraph)
      : clonePlain(dungeonOrGraph || null);

    /* Keep the old top-level seed/theme/sliders shape so existing session boot
       code continues to read row.map without a migration. */
    return {
      seed: p.seed,
      theme: p.theme,
      sliders: p.sliders,
      generatorVersion: p.generatorVersion,
      archetype: p.archetype,
      stageSeeds: p.stageSeeds,
      mapSnapshot: snapshot,
      mapFingerprint: fingerprintSnapshot(snapshot),
      graph: graph
    };
  }

  function attachMeta(map, params, dungeonOrGraph) {
    if (!map || typeof map !== "object") throw new Error("forge-generator-foundation: attachMeta requires a map");
    var p = normalizeParams(params);
    map.meta = Object.assign({}, map.meta || {}, {
      generatorVersion: p.generatorVersion,
      archetype: p.archetype,
      stageSeeds: p.stageSeeds,
      graph: dungeonOrGraph && Array.isArray(dungeonOrGraph.rooms)
        ? graphMetadata(dungeonOrGraph)
        : clonePlain(dungeonOrGraph || null)
    });
    return map;
  }

  return {
    GENERATOR_VERSION: GENERATOR_VERSION,
    STAGES: STAGES,
    ARCHETYPES: ARCHETYPES,
    hash32: hash32,
    deriveSeed: deriveSeed,
    stageSeeds: stageSeeds,
    assertArchetype: assertArchetype,
    assertThemeKey: assertThemeKey,
    snapshotMap: snapshotMap,
    restoreMap: restoreMap,
    fingerprintSnapshot: fingerprintSnapshot,
    recipeParams: recipeParams,
    resolveEncounter: resolveEncounter,
    graphMetadata: graphMetadata,
    normalizeParams: normalizeParams,
    encounterEnvelope: encounterEnvelope,
    attachMeta: attachMeta,
    _internals: { stableStringify: stableStringify, clonePlain: clonePlain }
  };
});
