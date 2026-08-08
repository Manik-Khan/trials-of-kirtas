/* Confirmed image Structure Review -> forge-blueprint/v1.
   Artwork remains in browser storage; only authored semantics enter the document. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeImageBlueprint = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = 1;
  var BLOCKED = { wall: true, tent: true, water: true };
  var RAISED = { building: true, roof: true, bridge: true };
  var MATERIAL = {
    stone: "nave", masonry: "nave", earth: "cloister", vegetation: "cloister",
    wood: "timber", timber: "timber", water: "water", ice: "crypt", snow: "crypt"
  };

  function copy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function key(c, r) { return c + "," + r; }
  function hash32(value) {
    var text = String(value), hash = 2166136261;
    for (var i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }
  function inGrid(cell, cols, rows) {
    return Array.isArray(cell) && Number.isInteger(cell[0]) && Number.isInteger(cell[1])
      && cell[0] >= 0 && cell[1] >= 0 && cell[0] < cols && cell[1] < rows;
  }
  function authoredRegions(review) {
    return (review && review.regions || []).filter(function (region) {
      return region && region.source === "dm-authored" && Array.isArray(region.cells) && region.cells.length;
    });
  }
  function dominantMaterial(analysis) {
    var counts = analysis && analysis.summary && analysis.summary.materials || {};
    var name = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    return MATERIAL[name] || "cloister";
  }
  function palette(analysis) {
    var counts = {};
    (analysis && analysis.cells || []).forEach(function (cell) {
      var evidence = cell && cell.evidence || {};
      if (![evidence.r, evidence.g, evidence.b].every(function (value) { return Number.isFinite(Number(value)); })) return;
      var color = "#" + [evidence.r, evidence.g, evidence.b].map(function (value) {
        return Math.max(0, Math.min(255, Math.round(Number(value)))).toString(16).padStart(2, "0");
      }).join("");
      counts[color] = (counts[color] || 0) + 1;
    });
    return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 8);
  }
  function connectedPath(cells) {
    var points = {}, first = null;
    cells.forEach(function (cell) {
      var point = { c: cell[0], r: cell[1] };
      points[key(point.c, point.r)] = point;
      if (!first) first = point;
    });
    function scan(start) {
      var queue = [start], seen = {}; seen[key(start.c, start.r)] = { d: 0, from: null };
      while (queue.length) {
        var at = queue.shift();
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (step) {
          var nextKey = key(at.c + step[0], at.r + step[1]);
          if (!points[nextKey] || seen[nextKey]) return;
          seen[nextKey] = { d: seen[key(at.c, at.r)].d + 1, from: key(at.c, at.r) };
          queue.push(points[nextKey]);
        });
      }
      var far = start;
      Object.keys(seen).forEach(function (pointKey) {
        if (seen[pointKey].d > seen[key(far.c, far.r)].d) far = points[pointKey];
      });
      return { far: far, seen: seen };
    }
    if (!first) return [];
    var edge = scan(first).far, result = scan(edge), cursor = key(result.far.c, result.far.r), path = [];
    while (cursor) {
      var parts = cursor.split(",").map(Number);
      path.unshift([parts[0], parts[1]]);
      cursor = result.seen[cursor] && result.seen[cursor].from;
    }
    return path;
  }
  function reviewToBlueprint(review, analysis, options) {
    options = options || {};
    if (!review || review.schema !== "forge-structure-review/v1" || !review.grid) throw new Error("A reviewed structure map is required.");
    var cols = Number(review.grid.cols), rows = Number(review.grid.rows);
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) throw new Error("The reviewed grid is invalid.");
    var authored = authoredRegions(review).map(function (region) {
      var out = copy(region);
      out.cells = out.cells.filter(function (cell) { return inGrid(cell, cols, rows); });
      return out;
    }).filter(function (region) { return region.cells.length; });
    if (!authored.length) throw new Error("Draw at least one confirmed structure before continuing.");
    var blocked = [], heights = [], seenBlocked = {}, seenHeight = {};
    authored.forEach(function (region) {
      if (BLOCKED[region.type] || (region.type === "building" && !region.roofWalkable)) region.cells.forEach(function (cell) {
        var cellKey = key(cell[0], cell[1]);
        if (!seenBlocked[cellKey]) { blocked.push(copy(cell)); seenBlocked[cellKey] = true; }
      });
      if (RAISED[region.type] && region.roofWalkable !== false) region.cells.forEach(function (cell) {
        var cellKey = key(cell[0], cell[1]), heightFt = Math.max(0, Number(region.topFt) || 0);
        if (!seenHeight[cellKey] || seenHeight[cellKey] < heightFt) {
          heights = heights.filter(function (entry) { return key(entry.c, entry.r) !== cellKey; });
          heights.push({ c: cell[0], r: cell[1], heightFt: heightFt, regionId: region.id });
          seenHeight[cellKey] = heightFt;
        }
      });
      if (region.type === "stairs") {
        var path = connectedPath(region.cells), baseFt = Math.max(0, Number(region.baseFt) || 0);
        var topFt = Math.max(baseFt, Number(region.topFt) || 0);
        path.forEach(function (cell, index) {
          var amount = path.length <= 1 ? 1 : index / (path.length - 1);
          heights.push({ c: cell[0], r: cell[1], heightFt: baseFt + (topFt - baseFt) * amount, regionId: region.id });
        });
      }
    });
    var sourceName = String(options.sourceName || review.scene || "Imported battle map");
    var id = "imported-" + hash32(JSON.stringify({ sourceName: sourceName, grid: review.grid, regions: authored })).toString(16);
    var regionId = "imported-field";
    return {
      schema: "forge-blueprint/v1", version: 1, id: id,
      name: sourceName.replace(/\.[a-z0-9]+$/i, "") || "Imported Battlefield",
      topology: "DM-reviewed image structure", theme: analysis && analysis.summary && analysis.summary.scene || "imported artwork",
      grid: { cols: cols, rows: rows, cellFt: 5, chunkSize: 5 },
      spaces: [{
        id: "imported-ground", label: "Imported battlefield", discoveryRegion: regionId,
        material: dominantMaterial(analysis), elevationFt: 0,
        polygon: [[0, 0], [cols, 0], [cols, rows], [0, rows]]
      }],
      corridors: [], architecture: [], props: [], lights: [], spawns: [],
      discoveryRegions: [{ id: regionId, label: "Imported battlefield" }],
      encounterRegions: [{ id: "encounter-imported", discoveryRegion: regionId, order: 0 }],
      materialZones: [], elevationZones: [],
      areaSettings: { "imported-field": { dressTogether: false, revealTogether: false, provenance: "DM-reviewed local artwork" } },
      source: {
        kind: "imported", label: "Reviewed local artwork", createdBy: "forge-combat",
        sourceName: sourceName, sourceRights: options.sourceRights || "User-provided local artwork",
        underlay: true, underlayKey: options.underlayKey || null, underlayStorage: "session",
        review: [{ id: "dm-structure-review", label: authored.length + " DM-confirmed structures", confidence: 1, accepted: true }],
        structureReview: { schema: review.schema, version: review.version, scene: review.scene, grid: copy(review.grid), regions: authored },
        interpretation: {
          engine: "local-pixels+dm-structure/v1", scene: analysis && analysis.summary && analysis.summary.scene || review.scene,
          grid: copy(review.grid), materials: copy(analysis && analysis.summary && analysis.summary.materials || {}),
          palette: palette(analysis), blockedCells: blocked, heightCells: heights,
          authoredStructures: authored.length, semanticAuthority: "dm-confirmed-only"
        }
      }
    };
  }

  return Object.freeze({ VERSION: VERSION, authoredRegions: authoredRegions, reviewToBlueprint: reviewToBlueprint });
});
