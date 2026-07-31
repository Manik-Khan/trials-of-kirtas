/* Forge image structure-review proof.
   Pure semantic-region, surface, volume, and connector proposal helpers.
   Browser: window.ForgeImageStructureReviewProof. Node: module.exports. */
(function (root, factory) {
  var importer = typeof module !== "undefined" && module.exports
    ? require("./mock-forge-image-importer-core.js")
    : root.ForgeImageImporterProof;
  var api = factory(importer);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeImageStructureReviewProof = api;
})(typeof self !== "undefined" ? self : this, function (Importer) {
  "use strict";

  var TYPES = Object.freeze({
    building: {
      label: "Building", color: "#7e6672", baseFt: 0, topFt: 15,
      solid: true, roofWalkable: true, access: "climb", supportMode: "solid"
    },
    roof: {
      label: "Raised roof / deck", color: "#b07f62", baseFt: 0, topFt: 15,
      solid: false, roofWalkable: true, access: "climb", supportMode: "solid"
    },
    bridge: {
      label: "Bridge", color: "#d29b54", baseFt: 0, topFt: 15,
      solid: false, roofWalkable: true, access: "stairs", supportMode: "posts"
    },
    water: {
      label: "Water / hazard", color: "#397f91", baseFt: 0, topFt: 0,
      solid: false, roofWalkable: false, access: "none", supportMode: "none"
    },
    tent: {
      label: "Tent / soft structure", color: "#c18e8b", baseFt: 0, topFt: 10,
      solid: false, roofWalkable: false, access: "none", supportMode: "canopy"
    },
    tree: {
      label: "Tree / canopy", color: "#648150", baseFt: 0, topFt: 20,
      solid: false, roofWalkable: false, access: "none", supportMode: "trunks"
    },
    stairs: {
      label: "Stairs / ramp", color: "#d2c08b", baseFt: 0, topFt: 15,
      solid: false, roofWalkable: true, access: "stairs", supportMode: "terrain"
    },
    wall: {
      label: "Wall / solid edge", color: "#8c8980", baseFt: 0, topFt: 10,
      solid: true, roofWalkable: false, access: "none", supportMode: "solid"
    }
  });
  var APPEARANCES = Object.freeze({
    building: [
      { id: "timber-house", label: "Timber house", color: "#9d7355", form: "pitched" },
      { id: "masonry-house", label: "Masonry house", color: "#827c78", form: "solid" },
      { id: "market-stall", label: "Market stall", color: "#b87962", form: "pavilion" },
      { id: "ruined-shell", label: "Ruined shell", color: "#726c68", form: "ruin" }
    ],
    roof: [
      { id: "tiled-roof", label: "Pitched tile roof", color: "#a96352", form: "pitched" },
      { id: "flat-deck", label: "Flat roof / deck", color: "#a88767", form: "deck" },
      { id: "timber-platform", label: "Timber platform", color: "#927050", form: "deck" }
    ],
    bridge: [
      { id: "timber-footbridge", label: "Timber footbridge", color: "#c08b4f", form: "deck" },
      { id: "stone-arches", label: "Stone bridge", color: "#989187", form: "arches" },
      { id: "rope-bridge", label: "Rope bridge", color: "#aa8658", form: "rope" }
    ],
    water: [
      { id: "clear-water", label: "Clear water", color: "#3d8798", form: "water" },
      { id: "murky-water", label: "Murky water", color: "#557f70", form: "water" },
      { id: "ice-slush", label: "Ice / slush", color: "#8eb3bc", form: "water" }
    ],
    tent: [
      { id: "canvas-tent", label: "Canvas tent", color: "#c39186", form: "peaked" },
      { id: "market-pavilion", label: "Market pavilion", color: "#c79c63", form: "pavilion" },
      { id: "round-yurt", label: "Round yurt", color: "#ad8a78", form: "round" }
    ],
    tree: [
      { id: "broadleaf", label: "Broadleaf canopy", color: "#648150", form: "canopy" },
      { id: "conifer", label: "Conifer", color: "#496b55", form: "conifer" },
      { id: "mangrove", label: "Mangrove", color: "#6d7850", form: "mangrove" }
    ],
    stairs: [
      { id: "stone-steps", label: "Stone steps", color: "#b9ad8b", form: "steps" },
      { id: "timber-stairs", label: "Timber stairs", color: "#a57c50", form: "steps" },
      { id: "earth-ramp", label: "Earth ramp", color: "#8e7a57", form: "ramp" }
    ],
    wall: [
      { id: "stone-wall", label: "Stone wall", color: "#8c8980", form: "wall" },
      { id: "timber-palisade", label: "Timber palisade", color: "#8d6948", form: "palisade" },
      { id: "ruined-wall", label: "Ruined wall", color: "#716d67", form: "ruin" }
    ]
  });
  var CARDINAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }
  function key(c, r) {
    return c + "," + r;
  }
  function average(values) {
    return values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length : 0;
  }
  function dominant(values, fallback) {
    var counts = {};
    values.forEach(function (value) { counts[value] = (counts[value] || 0) + 1; });
    var keys = Object.keys(counts);
    keys.sort(function (a, b) { return counts[b] - counts[a]; });
    return keys[0] || fallback;
  }
  function appearanceFor(type, appearanceId) {
    var options = APPEARANCES[type] || [];
    return options.find(function (appearance) { return appearance.id === appearanceId; }) || options[0] || {
      id: type || "unknown", label: TYPES[type] && TYPES[type].label || "Unknown", color: TYPES[type] && TYPES[type].color || "#888888", form: "solid"
    };
  }
  function defaultRegion(type, cells, index, source, confidence, material) {
    var spec = TYPES[type];
    return {
      id: "structure-" + type + "-" + (index + 1),
      type: type,
      label: spec.label + " " + (index + 1),
      cells: cells.map(function (cell) { return [cell.c, cell.r]; }),
      material: material || "earth",
      baseFt: spec.baseFt,
      topFt: spec.topFt,
      solid: spec.solid,
      roofWalkable: spec.roofWalkable,
      access: spec.access,
      supportMode: spec.supportMode,
      appearance: appearanceFor(type).id,
      footprint: null,
      source: source || "local-proposal",
      confidence: clamp(Number(confidence) || 0.5, 0, 1)
    };
  }
  function semanticCandidate(cell) {
    var evidence = cell.evidence || {};
    var edge = Number(evidence.edge) || 0;
    var variance = Number(evidence.variance) || 0;
    var luminance = Number(evidence.luminance) || 0.5;
    var feature = String(cell.feature || "");
    if (/structure/.test(feature)) return { type: "building", confidence: Math.max(0.62, cell.featureConfidence || 0) };
    if (cell.material === "water") {
      var roofLike = edge > 0.05 || variance > 0.008 || luminance < 0.34;
      return roofLike
        ? { type: "building", confidence: 0.54 + Math.min(0.2, edge + variance * 3) }
        : { type: "water", confidence: Math.max(0.68, cell.materialConfidence || 0) };
    }
    if (feature === "tree canopy") return { type: "tree", confidence: Math.max(0.68, cell.featureConfidence || 0) };
    if (cell.material === "vegetation" && luminance < 0.38 && variance > 0.008) {
      return { type: "tree", confidence: 0.58 };
    }
    if (cell.material === "timber" && edge > 0.045) {
      return { type: "building", confidence: 0.55 };
    }
    return null;
  }
  function connectedGroups(candidates, cols, rows) {
    var byKey = new Map();
    candidates.forEach(function (candidate) { byKey.set(key(candidate.cell.c, candidate.cell.r), candidate); });
    var seen = new Set(), groups = [];
    candidates.forEach(function (candidate) {
      var start = key(candidate.cell.c, candidate.cell.r);
      if (seen.has(start)) return;
      var queue = [candidate], group = []; seen.add(start);
      while (queue.length) {
        var current = queue.shift(); group.push(current);
        CARDINAL.forEach(function (delta) {
          var c = current.cell.c + delta[0], r = current.cell.r + delta[1], nextKey = key(c, r);
          if (c < 0 || r < 0 || c >= cols || r >= rows || seen.has(nextKey)) return;
          var next = byKey.get(nextKey);
          if (!next || next.type !== current.type) return;
          seen.add(nextKey); queue.push(next);
        });
      }
      groups.push(group);
    });
    return groups;
  }
  function normalizeBroadWater(candidates, analysis) {
    var waterCandidates = candidates.filter(function (candidate) {
      return candidate.cell.material === "water";
    });
    var byKey = new Map();
    waterCandidates.forEach(function (candidate) {
      byKey.set(key(candidate.cell.c, candidate.cell.r), candidate);
    });
    var seen = new Set();
    var broadMinimum = Math.max(12, Math.ceil(analysis.grid.cols * analysis.grid.rows * 0.02));
    waterCandidates.forEach(function (candidate) {
      var startKey = key(candidate.cell.c, candidate.cell.r);
      if (seen.has(startKey)) return;
      var queue = [candidate], group = []; seen.add(startKey);
      while (queue.length) {
        var current = queue.shift(); group.push(current);
        CARDINAL.forEach(function (delta) {
          var nextKey = key(current.cell.c + delta[0], current.cell.r + delta[1]);
          if (seen.has(nextKey) || !byKey.has(nextKey)) return;
          seen.add(nextKey); queue.push(byKey.get(nextKey));
        });
      }
      if (group.length < broadMinimum) return;
      group.forEach(function (item) {
        item.type = "water";
        item.confidence = Math.max(0.72, item.cell.materialConfidence || 0);
      });
    });
    return candidates;
  }
  function proposeRegions(analysis, options) {
    options = options || {};
    if (!analysis || !analysis.grid || !Array.isArray(analysis.cells)) throw new Error("Pixel analysis is required.");
    var candidates = analysis.cells.map(function (cell) {
      var proposal = semanticCandidate(cell);
      return proposal && { cell: cell, type: proposal.type, confidence: proposal.confidence };
    }).filter(Boolean);
    normalizeBroadWater(candidates, analysis);
    var groups = connectedGroups(candidates, analysis.grid.cols, analysis.grid.rows);
    var minimum = Math.max(1, Number(options.minimumCells) || 2);
    var regions = groups.filter(function (group) {
      return group.length >= minimum || group[0].type === "water";
    }).map(function (group, index) {
      return defaultRegion(
        group[0].type,
        group.map(function (item) { return item.cell; }),
        index,
        "local-proposal",
        average(group.map(function (item) { return item.confidence; })),
        dominant(group.map(function (item) { return item.cell.material; }), "earth")
      );
    });
    return {
      schema: "forge-structure-review/v1",
      version: 1,
      grid: copy(analysis.grid),
      scene: analysis.summary && analysis.summary.scene || "Unclassified artwork",
      materials: copy(analysis.summary && analysis.summary.materials || {}),
      regions: regions,
      history: [{
        kind: "local-proposal",
        detail: regions.length + " grouped structure regions proposed from pixel evidence"
      }]
    };
  }
  function regionAt(review, c, r) {
    for (var i = review.regions.length - 1; i >= 0; i--) {
      if (review.regions[i].cells.some(function (cell) { return cell[0] === c && cell[1] === r; })) return review.regions[i];
    }
    return null;
  }
  function pointInPolygon(x, y, points) {
    var inside = false;
    for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
      var xi = points[i][0], yi = points[i][1], xj = points[j][0], yj = points[j][1];
      var crosses = ((yi > y) !== (yj > y))
        && x < (xj - xi) * (y - yi) / ((yj - yi) || 0.000001) + xi;
      if (crosses) inside = !inside;
    }
    return inside;
  }
  function cellsFromPolygon(grid, points, minimumCoverage) {
    if (!grid || !Array.isArray(points) || points.length < 3) return [];
    minimumCoverage = clamp(Number(minimumCoverage) || 0.22, 0.05, 1);
    var cells = [], samples = 4;
    for (var r = 0; r < grid.rows; r++) for (var c = 0; c < grid.cols; c++) {
      var hits = 0;
      for (var sy = 0; sy < samples; sy++) for (var sx = 0; sx < samples; sx++) {
        var x = grid.originX + (c + (sx + 0.5) / samples) * grid.cellPx;
        var y = grid.originY + (r + (sy + 0.5) / samples) * grid.cellPx;
        if (pointInPolygon(x, y, points)) hits++;
      }
      if (hits / (samples * samples) >= minimumCoverage) cells.push([c, r]);
    }
    return cells;
  }
  function magicMask(rgba, width, height, seedX, seedY, tolerance, options) {
    if (!rgba || rgba.length !== width * height * 4) throw new Error("RGBA data does not match its dimensions.");
    seedX = clamp(Math.floor(seedX), 0, width - 1); seedY = clamp(Math.floor(seedY), 0, height - 1);
    tolerance = clamp(Number(tolerance) || 18, 1, 100) / 100;
    var seed = (seedY * width + seedX) * 4;
    var sr = rgba[seed], sg = rgba[seed + 1], sb = rgba[seed + 2];
    var threshold = tolerance * 441.673;
    var allowedMask = options && options.allowedMask;
    if (allowedMask && allowedMask.length !== width * height) throw new Error("Magic boundary mask does not match its dimensions.");
    var mask = new Uint8Array(width * height), seen = new Uint8Array(width * height);
    var queue = new Int32Array(width * height), head = 0, tail = 0;
    var seedIndex = seedY * width + seedX;
    if (allowedMask && !allowedMask[seedIndex]) return mask;
    queue[tail++] = seedIndex; seen[seedIndex] = 1;
    while (head < tail) {
      var index = queue[head++], offset = index * 4;
      if (allowedMask && !allowedMask[index]) continue;
      var dr = rgba[offset] - sr, dg = rgba[offset + 1] - sg, db = rgba[offset + 2] - sb;
      if (Math.sqrt(dr * dr + dg * dg + db * db) > threshold) continue;
      mask[index] = 1;
      var x = index % width, y = Math.floor(index / width);
      var neighbors = [index - 1, index + 1, index - width, index + width];
      for (var n = 0; n < neighbors.length; n++) {
        var next = neighbors[n];
        if (next < 0 || next >= mask.length || seen[next] || (allowedMask && !allowedMask[next])) continue;
        if ((n === 0 && x === 0) || (n === 1 && x === width - 1)) continue;
        seen[next] = 1; queue[tail++] = next;
      }
    }
    return mask;
  }
  function maskFromCells(grid, cells, width, height) {
    var included = new Set((cells || []).map(function (cell) { return key(cell[0], cell[1]); }));
    var mask = new Uint8Array(width * height);
    if (!grid || !included.size) return mask;
    for (var y = 0; y < height; y++) for (var x = 0; x < width; x++) {
      var c = Math.floor((x - grid.originX) / grid.cellPx), r = Math.floor((y - grid.originY) / grid.cellPx);
      if (included.has(key(c, r))) mask[y * width + x] = 1;
    }
    return mask;
  }
  function cellsFromMask(grid, mask, width, height, minimumCoverage) {
    if (!grid || !mask || mask.length !== width * height) return [];
    minimumCoverage = clamp(Number(minimumCoverage) || 0.2, 0.02, 1);
    var hits = new Uint32Array(grid.cols * grid.rows), totals = new Uint32Array(grid.cols * grid.rows);
    for (var y = 0; y < height; y++) for (var x = 0; x < width; x++) {
      var c = Math.floor((x - grid.originX) / grid.cellPx), r = Math.floor((y - grid.originY) / grid.cellPx);
      if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) continue;
      var cellIndex = r * grid.cols + c; totals[cellIndex]++;
      if (mask[y * width + x]) hits[cellIndex]++;
    }
    var cells = [];
    for (var index = 0; index < totals.length; index++) {
      if (totals[index] && hits[index] / totals[index] >= minimumCoverage) {
        cells.push([index % grid.cols, Math.floor(index / grid.cols)]);
      }
    }
    return cells;
  }
  function selectionFromCells(cells, footprint) {
    var unique = new Map();
    (cells || []).forEach(function (cell) { unique.set(key(cell[0], cell[1]), [cell[0], cell[1]]); });
    return { cells: Array.from(unique.values()), footprint: footprint || { kind: "cells" } };
  }
  function combineSelection(current, next, operation) {
    operation = operation || "replace";
    if (!current && operation === "subtract") return selectionFromCells([], {
      kind: "composite", parts: [{ operation: "subtract", footprint: copy(next.footprint) }]
    });
    if (!current || operation === "replace") return selectionFromCells(next.cells, {
      kind: "composite", parts: [{ operation: "add", footprint: copy(next.footprint) }]
    });
    var cells = new Map();
    current.cells.forEach(function (cell) { cells.set(key(cell[0], cell[1]), cell); });
    next.cells.forEach(function (cell) {
      if (operation === "subtract") cells.delete(key(cell[0], cell[1]));
      else cells.set(key(cell[0], cell[1]), cell);
    });
    var footprint = current.footprint && current.footprint.kind === "composite"
      ? copy(current.footprint) : { kind: "composite", parts: [] };
    footprint.parts.push({ operation: operation === "subtract" ? "subtract" : "add", footprint: copy(next.footprint) });
    return selectionFromCells(Array.from(cells.values()), footprint);
  }
  function compatibleRegions(a, b) {
    return a.type === b.type && a.baseFt === b.baseFt && a.topFt === b.topFt
      && a.supportMode === b.supportMode && a.access === b.access
      && a.roofWalkable === b.roofWalkable;
  }
  function regionsTouch(a, b) {
    var cells = new Set(a.cells.map(function (cell) { return key(cell[0], cell[1]); }));
    return b.cells.some(function (cell) {
      return cells.has(key(cell[0], cell[1])) || CARDINAL.some(function (delta) {
        return cells.has(key(cell[0] + delta[0], cell[1] + delta[1]));
      });
    });
  }
  function mergeTouchingRegions(regions) {
    var out = regions.map(copy), changed = true;
    while (changed) {
      changed = false;
      outer: for (var i = 0; i < out.length; i++) for (var j = i + 1; j < out.length; j++) {
        if (!compatibleRegions(out[i], out[j]) || !regionsTouch(out[i], out[j])) continue;
        var merged = selectionFromCells(out[i].cells.concat(out[j].cells), {
          kind: "composite", parts: [
            { operation: "add", footprint: out[i].footprint || { kind: "cells" } },
            { operation: "add", footprint: out[j].footprint || { kind: "cells" } }
          ]
        });
        out[i].cells = merged.cells; out[i].footprint = merged.footprint;
        out[i].source = out[i].source === "dm-authored" || out[j].source === "dm-authored" ? "dm-authored" : out[i].source;
        out[i].confidence = Math.max(out[i].confidence, out[j].confidence);
        out.splice(j, 1); changed = true; break outer;
      }
    }
    return out;
  }
  function authorSelection(review, selection, type, options) {
    if (!review || !selection || !selection.cells.length || (type !== "ground" && !TYPES[type])) {
      return { review: review, regionId: null };
    }
    var out = copy(review), replaceRegionId = options && options.replaceRegionId;
    var replacedRegion = replaceRegionId && out.regions.find(function (region) { return region.id === replaceRegionId; });
    var selected = new Set(selection.cells.map(function (cell) { return key(cell[0], cell[1]); }));
    out.regions = out.regions.filter(function (region) { return region.id !== replaceRegionId; }).map(function (region) {
      var next = copy(region);
      if (type === "ground" || region.source === "local-proposal") {
        next.cells = next.cells.filter(function (cell) { return !selected.has(key(cell[0], cell[1])); });
      }
      return next;
    }).filter(function (region) { return region.cells.length; });
    var regionId = null;
    if (type !== "ground") {
      var cells = selection.cells.map(function (cell) { return { c: cell[0], r: cell[1] }; });
      var region = defaultRegion(type, cells, out.regions.length, "dm-authored", 1, "earth");
      region.id = replacedRegion && replacedRegion.id || "authored-" + type + "-" + (out.history.length + 1);
      region.label = replacedRegion && replacedRegion.label || TYPES[type].label;
      region.baseFt = replacedRegion && replacedRegion.baseFt != null ? replacedRegion.baseFt : region.baseFt;
      region.topFt = replacedRegion && replacedRegion.topFt != null ? replacedRegion.topFt : region.topFt;
      region.roofWalkable = replacedRegion ? replacedRegion.roofWalkable : region.roofWalkable;
      region.access = replacedRegion && replacedRegion.access || region.access;
      region.supportMode = replacedRegion && replacedRegion.supportMode || region.supportMode;
      var requestedAppearance = options && options.appearance && appearanceFor(type, options.appearance);
      region.appearance = requestedAppearance && requestedAppearance.id
        || replacedRegion && replacedRegion.appearance || appearanceFor(type).id;
      region.palette = replacedRegion && replacedRegion.palette || region.palette;
      region.footprint = copy(selection.footprint);
      out.regions.push(region); regionId = region.id;
    }
    out.history.push({
      kind: replacedRegion ? "edit-selection" : "author-selection",
      type: type, cells: selection.cells.length, regionId: replaceRegionId || null,
      footprint: copy(selection.footprint)
    });
    return { review: out, regionId: regionId };
  }
  function groupsForCells(cells) {
    var remaining = new Map();
    cells.forEach(function (cell) { remaining.set(key(cell[0], cell[1]), cell); });
    var groups = [];
    while (remaining.size) {
      var first = remaining.values().next().value, queue = [first], group = [];
      remaining.delete(key(first[0], first[1]));
      while (queue.length) {
        var current = queue.shift(); group.push(current);
        CARDINAL.forEach(function (delta) {
          var nextKey = key(current[0] + delta[0], current[1] + delta[1]);
          if (!remaining.has(nextKey)) return;
          queue.push(remaining.get(nextKey)); remaining.delete(nextKey);
        });
      }
      groups.push(group);
    }
    return groups;
  }
  function paintRect(review, start, end, type) {
    if (!review || !review.grid || (type !== "ground" && !TYPES[type])) return review;
    var minC = clamp(Math.min(start.c, end.c), 0, review.grid.cols - 1);
    var maxC = clamp(Math.max(start.c, end.c), 0, review.grid.cols - 1);
    var minR = clamp(Math.min(start.r, end.r), 0, review.grid.rows - 1);
    var maxR = clamp(Math.max(start.r, end.r), 0, review.grid.rows - 1);
    var cells = [];
    for (var r = minR; r <= maxR; r++) for (var c = minC; c <= maxC; c++) {
      cells.push([c, r]);
    }
    return authorSelection(review, selectionFromCells(cells, {
      kind: "grid-rectangle", rect: { minC: minC, minR: minR, maxC: maxC, maxR: maxR }
    }), type);
  }
  function updateRegion(review, regionId, patch) {
    var out = copy(review);
    var region = out.regions.find(function (item) { return item.id === regionId; });
    if (!region) return out;
    if (patch.type && TYPES[patch.type]) {
      region.type = patch.type;
      if (!(APPEARANCES[region.type] || []).some(function (appearance) { return appearance.id === region.appearance; })) {
        region.appearance = appearanceFor(region.type).id;
      }
    }
    if (patch.label != null) region.label = String(patch.label).trim() || TYPES[region.type].label;
    if (patch.material != null) region.material = String(patch.material);
    if (Number.isFinite(Number(patch.baseFt))) region.baseFt = clamp(Number(patch.baseFt), -20, 100);
    if (Number.isFinite(Number(patch.topFt))) region.topFt = clamp(Number(patch.topFt), region.baseFt, 120);
    if (typeof patch.roofWalkable === "boolean") region.roofWalkable = patch.roofWalkable;
    if (patch.access != null) region.access = String(patch.access);
    if (patch.supportMode != null) region.supportMode = String(patch.supportMode);
    if (patch.appearance != null && (APPEARANCES[region.type] || []).some(function (appearance) { return appearance.id === patch.appearance; })) {
      region.appearance = String(patch.appearance);
    }
    region.source = "dm-authored";
    region.confidence = 1;
    out.history.push({ kind: "edit-region", regionId: regionId, patch: copy(patch) });
    return out;
  }
  function stairPath(region) {
    var cells = region.cells.slice().sort(function (a, b) {
      return a[1] === b[1] ? a[0] - b[0] : a[1] - b[1];
    });
    return cells.map(function (cell, index) {
      var t = cells.length <= 1 ? 1 : index / (cells.length - 1);
      return {
        c: cell[0], r: cell[1],
        elevationFt: region.baseFt + (region.topFt - region.baseFt) * t
      };
    });
  }
  function compileReview(review) {
    var surfaces = [{
      id: "surface-ground",
      kind: "ground",
      elevationFt: 0,
      walkable: true,
      implicitCells: review.grid.cols * review.grid.rows
    }];
    var volumes = [], connectors = [];
    review.regions.forEach(function (region) {
      if (region.type === "water") {
        surfaces.push({
          id: "surface-" + region.id, regionId: region.id, kind: "water",
          cells: copy(region.cells), elevationFt: region.baseFt, walkable: false
        });
      }
      if (region.type === "building" || region.type === "wall" || region.type === "tent" || region.type === "tree") {
        volumes.push({
          id: "volume-" + region.id, regionId: region.id, kind: region.type,
          cells: copy(region.cells), bottomFt: region.baseFt, topFt: region.topFt,
          solid: region.solid, material: region.material, supportMode: region.supportMode, appearance: region.appearance,
          footprint: copy(region.footprint)
        });
      }
      if (region.type === "roof" && region.supportMode === "solid") {
        volumes.push({
          id: "volume-support-" + region.id, regionId: region.id, kind: "roof-support",
          cells: copy(region.cells), bottomFt: region.baseFt, topFt: region.topFt,
          solid: true, material: region.material, supportMode: "solid", footprint: copy(region.footprint)
        });
      }
      if ((region.type === "building" || region.type === "roof") && region.roofWalkable) {
        surfaces.push({
          id: "surface-" + region.id, regionId: region.id, kind: "roof",
          cells: copy(region.cells), elevationFt: region.topFt, walkable: true,
          supportMode: region.supportMode, appearance: region.appearance, footprint: copy(region.footprint)
        });
      }
      if (region.type === "bridge") {
        surfaces.push({
          id: "surface-" + region.id, regionId: region.id, kind: "bridge-deck",
          cells: copy(region.cells), elevationFt: region.topFt, walkable: true,
          underpassSurfaceId: "surface-ground", clearanceFt: region.topFt - region.baseFt,
          supportsUnderpass: true, supportMode: region.supportMode, appearance: region.appearance, footprint: copy(region.footprint)
        });
      }
      if (region.type === "stairs") {
        connectors.push({
          id: "connector-" + region.id, regionId: region.id, kind: "stairs",
          fromSurfaceId: "surface-ground", toElevationFt: region.topFt,
          path: stairPath(region), appearance: region.appearance, requires: { climb: false }
        });
      } else if (region.access && region.access !== "none" && (region.type === "building" || region.type === "roof")) {
        connectors.push({
          id: "connector-" + region.id, regionId: region.id, kind: region.access,
          fromSurfaceId: "surface-ground", toSurfaceId: "surface-" + region.id,
          riseFt: region.topFt - region.baseFt,
          requires: { climb: region.access === "climb" }
        });
      }
    });
    return {
      schema: "forge-surface-proposal/v1",
      reviewSchema: review.schema,
      grid: copy(review.grid),
      surfaces: surfaces,
      volumes: volumes,
      connectors: connectors,
      authority: "renderer-study-only"
    };
  }
  function climbCost(distanceFt, hasClimbSpeed) {
    distanceFt = Math.max(0, Number(distanceFt) || 0);
    return hasClimbSpeed ? distanceFt : distanceFt * 2;
  }
  function validateReview(review) {
    var errors = [], ids = new Set();
    if (!review || review.schema !== "forge-structure-review/v1") errors.push("wrong review schema");
    if (!review || !review.grid || review.grid.cols < 1 || review.grid.rows < 1) errors.push("invalid grid");
    (review && review.regions || []).forEach(function (region) {
      if (ids.has(region.id)) errors.push("duplicate region " + region.id);
      ids.add(region.id);
      if (!TYPES[region.type]) errors.push("unknown type " + region.type);
      if (!region.cells.length) errors.push("empty region " + region.id);
      if (Number(region.topFt) < Number(region.baseFt)) errors.push("negative height " + region.id);
      if (["solid", "posts", "arches", "canopy", "trunks", "terrain", "none"].indexOf(region.supportMode) < 0) {
        errors.push("unknown support " + region.id);
      }
      if (!(APPEARANCES[region.type] || []).some(function (appearance) { return appearance.id === region.appearance; })) {
        errors.push("unknown appearance " + region.id);
      }
      region.cells.forEach(function (cell) {
        if (cell[0] < 0 || cell[1] < 0 || cell[0] >= review.grid.cols || cell[1] >= review.grid.rows) {
          errors.push("out-of-bounds cell " + region.id);
        }
      });
    });
    return { ok: errors.length === 0, errors: errors };
  }
  function summarize(review) {
    var counts = {};
    review.regions.forEach(function (region) { counts[region.type] = (counts[region.type] || 0) + 1; });
    var compiled = compileReview(review);
    return {
      proposedRegions: review.regions.filter(function (region) { return region.source === "local-proposal"; }).length,
      authoredRegions: review.regions.filter(function (region) { return region.source === "dm-authored"; }).length,
      counts: counts,
      surfaces: compiled.surfaces.length,
      volumes: compiled.volumes.length,
      connectors: compiled.connectors.length
    };
  }

  return {
    TYPES: TYPES,
    APPEARANCES: APPEARANCES,
    appearanceFor: appearanceFor,
    semanticCandidate: semanticCandidate,
    proposeRegions: proposeRegions,
    regionAt: regionAt,
    pointInPolygon: pointInPolygon,
    cellsFromPolygon: cellsFromPolygon,
    magicMask: magicMask,
    maskFromCells: maskFromCells,
    cellsFromMask: cellsFromMask,
    selectionFromCells: selectionFromCells,
    combineSelection: combineSelection,
    mergeTouchingRegions: mergeTouchingRegions,
    authorSelection: authorSelection,
    paintRect: paintRect,
    updateRegion: updateRegion,
    stairPath: stairPath,
    compileReview: compileReview,
    climbCost: climbCost,
    validateReview: validateReview,
    summarize: summarize
  };
});
