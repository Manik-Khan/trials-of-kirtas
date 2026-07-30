/* Forge artwork interpreter proof · pure pixel analysis + Blueprint proposal.
   Browser: window.ForgeImageImporterProof. Node: module.exports.
   No image bytes leave the browser and no model or network service is used. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeImageImporterProof = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MATERIALS = Object.freeze({
    stone: { label: "Stone / plaza", color: "#c5b792", blueprint: "nave" },
    timber: { label: "Timber", color: "#a06e43", blueprint: "timber" },
    vegetation: { label: "Grass / vegetation", color: "#718b43", blueprint: "cloister" },
    water: { label: "Water", color: "#397f91", blueprint: "water" },
    earth: { label: "Earth / worn ground", color: "#9a8255", blueprint: "timber" },
    snow: { label: "Snow / ice", color: "#d8e4e4", blueprint: "crypt" }
  });
  var CARDINAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }
  function median(values) {
    if (!values.length) return 0;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min, hue = 0;
    if (delta) {
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
    }
    if (hue < 0) hue += 360;
    return { h: hue, s: max ? delta / max : 0, v: max };
  }
  function luminance(r, g, b) {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  function projectionSignals(rgba, width, height) {
    var xSignal = new Array(Math.max(0, width - 2)).fill(0);
    var ySignal = new Array(Math.max(0, height - 2)).fill(0);
    var xSamples = 0, ySamples = 0;
    for (var y = 1; y < height - 1; y += Math.max(1, Math.floor(height / 360))) {
      for (var x = 1; x < width - 1; x++) {
        var left = (y * width + x - 1) * 4, right = (y * width + x + 1) * 4;
        xSignal[x - 1] += Math.abs(
          luminance(rgba[left], rgba[left + 1], rgba[left + 2])
          - luminance(rgba[right], rgba[right + 1], rgba[right + 2])
        );
      }
      xSamples++;
    }
    for (var x2 = 1; x2 < width - 1; x2 += Math.max(1, Math.floor(width / 360))) {
      for (var y2 = 1; y2 < height - 1; y2++) {
        var above = ((y2 - 1) * width + x2) * 4, below = ((y2 + 1) * width + x2) * 4;
        ySignal[y2 - 1] += Math.abs(
          luminance(rgba[above], rgba[above + 1], rgba[above + 2])
          - luminance(rgba[below], rgba[below + 1], rgba[below + 2])
        );
      }
      ySamples++;
    }
    return {
      x: xSignal.map(function (value) { return value / Math.max(1, xSamples); }),
      y: ySignal.map(function (value) { return value / Math.max(1, ySamples); })
    };
  }
  function normalized(signal) {
    var mean = signal.reduce(function (sum, value) { return sum + value; }, 0) / Math.max(1, signal.length);
    var variance = signal.reduce(function (sum, value) {
      return sum + Math.pow(value - mean, 2);
    }, 0) / Math.max(1, signal.length);
    var deviation = Math.sqrt(variance) || 1;
    return signal.map(function (value) { return (value - mean) / deviation; });
  }
  function correlation(signal, period) {
    if (signal.length <= period) return 0;
    var sum = 0;
    for (var i = 0; i < signal.length - period; i++) sum += signal[i] * signal[i + period];
    return sum / (signal.length - period);
  }
  function bestPhase(signal, period) {
    var best = { phase: 0, score: -Infinity };
    for (var phase = 0; phase < period; phase++) {
      var sum = 0, count = 0;
      for (var at = phase; at < signal.length; at += period) { sum += signal[at]; count++; }
      var score = count ? sum / count : 0;
      if (score > best.score) best = { phase: phase + 1, score: score };
    }
    return best.phase;
  }
  function detectGrid(rgba, width, height) {
    var signals = projectionSignals(rgba, width, height);
    var xNorm = normalized(signals.x), yNorm = normalized(signals.y);
    var maxPeriod = Math.max(12, Math.min(96, Math.floor(Math.min(width, height) / 5)));
    var scores = [];
    for (var period = 8; period <= maxPeriod; period++) {
      scores.push({
        period: period,
        raw: correlation(xNorm, period) + correlation(yNorm, period)
      });
    }
    var peaks = scores.filter(function (item, index) {
      return index > 0 && index < scores.length - 1
        && item.raw > scores[index - 1].raw && item.raw >= scores[index + 1].raw;
    });
    peaks.sort(function (a, b) {
      return (b.raw / Math.sqrt(b.period)) - (a.raw / Math.sqrt(a.period));
    });
    var best = peaks[0] || { period: 0, raw: 0 };
    var neighbors = scores.filter(function (item) {
      return best.period && Math.abs(item.period - best.period) >= 3 && Math.abs(item.period - best.period) <= 9;
    }).map(function (item) { return item.raw; });
    var prominence = best.raw - median(neighbors);
    var confidence = clamp((best.raw - 0.45) * 0.75 + prominence * 0.8, 0, 0.96);
    var found = best.period >= 10 && best.raw > 0.68 && prominence > 0.12;
    var originX = found ? bestPhase(signals.x, best.period) : 0;
    var originY = found ? bestPhase(signals.y, best.period) : 0;
    return {
      found: found,
      cellPx: found ? best.period : 0,
      originX: originX,
      originY: originY,
      cols: found ? Math.floor((width - originX) / best.period) : 0,
      rows: found ? Math.floor((height - originY) / best.period) : 0,
      confidence: confidence,
      evidence: { periodScore: best.raw, prominence: prominence }
    };
  }
  function gridFromColumns(width, height, columns) {
    var cols = clamp(Math.round(Number(columns) || 32), 12, 80);
    var cellPx = width / cols;
    return {
      found: false, cellPx: cellPx, originX: 0, originY: 0,
      cols: cols, rows: Math.max(8, Math.round(height / cellPx)),
      confidence: 1, evidence: { chosenColumns: cols }
    };
  }
  function gridFromDrawnBox(width, height, startX, startY, endX, endY, span) {
    span = Math.max(1, Math.round(Number(span) || 1));
    var sx = clamp(Number(startX), 0, width), sy = clamp(Number(startY), 0, height);
    var ex = clamp(Number(endX), 0, width), ey = clamp(Number(endY), 0, height);
    if (![sx, sy, ex, ey].every(Number.isFinite)) return null;
    var x0 = Math.min(sx, ex), y0 = Math.min(sy, ey);
    var boxWidth = Math.abs(ex - sx), boxHeight = Math.abs(ey - sy);
    var cellPx = ((boxWidth + boxHeight) / 2) / span;
    if (boxWidth < 4 || boxHeight < 4 || cellPx < 4) return null;
    var originX = ((x0 % cellPx) + cellPx) % cellPx;
    var originY = ((y0 % cellPx) + cellPx) % cellPx;
    var phaseTolerance = Math.max(0.25, cellPx * 0.02);
    if (originX < phaseTolerance || cellPx - originX < phaseTolerance) originX = 0;
    if (originY < phaseTolerance || cellPx - originY < phaseTolerance) originY = 0;
    return {
      found: true,
      cellPx: cellPx,
      originX: originX,
      originY: originY,
      cols: Math.max(1, Math.floor((width - originX) / cellPx)),
      rows: Math.max(1, Math.floor((height - originY) / cellPx)),
      confidence: 1,
      evidence: {
        manualCell: true,
        span: span,
        boxWidthPx: boxWidth,
        boxHeightPx: boxHeight
      }
    };
  }
  function sampleCell(rgba, width, height, grid, c, r) {
    var x0 = grid.originX + c * grid.cellPx, y0 = grid.originY + r * grid.cellPx;
    var inset = grid.cellPx * 0.14;
    var left = clamp(Math.floor(x0 + inset), 0, width - 1);
    var top = clamp(Math.floor(y0 + inset), 0, height - 1);
    var right = clamp(Math.ceil(x0 + grid.cellPx - inset), left + 1, width);
    var bottom = clamp(Math.ceil(y0 + grid.cellPx - inset), top + 1, height);
    var step = Math.max(1, Math.floor(grid.cellPx / 9));
    var count = 0, sumR = 0, sumG = 0, sumB = 0, sumLum = 0, sumLum2 = 0, edge = 0;
    for (var y = top; y < bottom; y += step) for (var x = left; x < right; x += step) {
      var index = (y * width + x) * 4;
      var red = rgba[index], green = rgba[index + 1], blue = rgba[index + 2];
      var lum = luminance(red, green, blue);
      sumR += red; sumG += green; sumB += blue; sumLum += lum; sumLum2 += lum * lum; count++;
      var nx = Math.min(width - 1, x + step), ny = Math.min(height - 1, y + step);
      var rightIndex = (y * width + nx) * 4, downIndex = (ny * width + x) * 4;
      edge += Math.abs(lum - luminance(rgba[rightIndex], rgba[rightIndex + 1], rgba[rightIndex + 2]));
      edge += Math.abs(lum - luminance(rgba[downIndex], rgba[downIndex + 1], rgba[downIndex + 2]));
    }
    count = Math.max(1, count);
    var meanR = sumR / count, meanG = sumG / count, meanB = sumB / count;
    var hsv = rgbToHsv(meanR, meanG, meanB), meanLum = sumLum / count;
    return {
      r: meanR, g: meanG, b: meanB, h: hsv.h, s: hsv.s, v: hsv.v,
      luminance: meanLum,
      variance: Math.max(0, sumLum2 / count - meanLum * meanLum),
      edge: edge / (count * 2)
    };
  }
  function classifyMaterial(feature) {
    var scores = {
      water: (feature.h >= 165 && feature.h <= 235 ? 0.58 : 0)
        + feature.s * 0.28 + (feature.b > feature.r * 1.08 ? 0.2 : 0),
      vegetation: (feature.h >= 58 && feature.h <= 155 ? 0.55 : 0)
        + feature.s * 0.22 + (feature.g > feature.r * 1.04 ? 0.18 : 0),
      timber: (feature.h >= 15 && feature.h <= 48 ? 0.32 : 0)
        + feature.s * 0.12
        + (feature.luminance < 0.52 ? 0.2 : 0)
        + (feature.variance > 0.004 && feature.edge > 0.05 ? 0.18 : 0),
      snow: feature.luminance > 0.78 && feature.s < 0.18 ? 0.82 : 0,
      stone: feature.s < 0.17 ? 0.62 + feature.edge * 0.45 : 0.12 + feature.edge * 0.22,
      earth: (feature.h >= 20 && feature.h <= 78 ? 0.52 : 0.18)
        + (feature.luminance > 0.42 ? 0.18 : 0)
        + (1 - feature.s) * 0.12
    };
    var order = Object.keys(scores).sort(function (a, b) { return scores[b] - scores[a]; });
    var best = order[0], second = order[1];
    return {
      material: best,
      confidence: clamp(0.45 + (scores[best] - scores[second]) * 0.9, 0.45, 0.97),
      scores: scores
    };
  }
  function inferFeature(material, feature, sceneLum) {
    var fire = feature.h >= 25 && feature.h <= 58 && feature.s > 0.48 && feature.luminance > 0.52;
    if (fire) return { feature: "fire", walkable: true, confidence: 0.8 };
    if (material === "water") return { feature: "water", walkable: false, confidence: 0.92 };
    if (material === "vegetation" && feature.luminance < sceneLum * 0.72 && feature.variance > 0.012) {
      return { feature: "tree canopy", walkable: false, confidence: 0.72 };
    }
    if (feature.edge > 0.105 && feature.variance > 0.018 && feature.luminance < sceneLum * 0.9) {
      return { feature: material === "timber" ? "timber structure" : "dense structure", walkable: false, confidence: 0.61 };
    }
    return { feature: "open terrain", walkable: true, confidence: 0.68 };
  }
  function analyze(rgba, width, height, grid) {
    if (!rgba || rgba.length !== width * height * 4) throw new Error("RGBA data does not match its dimensions.");
    if (!grid || grid.cols < 1 || grid.rows < 1 || grid.cellPx <= 0) throw new Error("A usable grid is required.");
    var samples = [], sceneLum = 0;
    for (var r = 0; r < grid.rows; r++) for (var c = 0; c < grid.cols; c++) {
      var feature = sampleCell(rgba, width, height, grid, c, r);
      samples.push(feature); sceneLum += feature.luminance;
    }
    sceneLum /= Math.max(1, samples.length);
    var cells = samples.map(function (feature, index) {
      var material = classifyMaterial(feature);
      var inferred = inferFeature(material.material, feature, sceneLum);
      return {
        c: index % grid.cols, r: Math.floor(index / grid.cols),
        material: material.material,
        materialConfidence: material.confidence,
        feature: inferred.feature,
        featureConfidence: inferred.confidence,
        walkable: inferred.walkable,
        corrected: false,
        evidence: feature
      };
    });
    var result = {
      version: 1,
      width: width,
      height: height,
      grid: {
        cellPx: grid.cellPx, originX: grid.originX, originY: grid.originY,
        cols: grid.cols, rows: grid.rows, confidence: grid.confidence,
        detected: !!grid.found && !(grid.evidence && grid.evidence.manualCell),
        manuallyCalibrated: !!(grid.evidence && grid.evidence.manualCell),
        evidence: grid.evidence || {}
      },
      sceneLuminance: sceneLum,
      cells: cells
    };
    result.summary = summarize(result);
    return result;
  }
  function summarize(analysis) {
    var materials = {}, features = {}, confidence = 0, walkable = 0;
    analysis.cells.forEach(function (cell) {
      materials[cell.material] = (materials[cell.material] || 0) + 1;
      features[cell.feature] = (features[cell.feature] || 0) + 1;
      confidence += cell.materialConfidence;
      if (cell.walkable) walkable++;
    });
    var total = Math.max(1, analysis.cells.length);
    var waterShare = (materials.water || 0) / total;
    var greenShare = (materials.vegetation || 0) / total;
    var stoneShare = (materials.stone || 0) / total;
    var timberShare = (materials.timber || 0) / total;
    var earthShare = (materials.earth || 0) / total;
    var scene = waterShare > 0.1 && greenShare > 0.3 ? "Wetland / overgrown battlefield"
      : stoneShare + earthShare > 0.58 && greenShare < 0.25 ? "Built settlement / plaza"
      : stoneShare > 0.35 && timberShare > 0.04 ? "Built settlement / plaza"
      : greenShare > 0.48 ? "Grassland / woodland"
      : stoneShare > 0.48 ? "Stone complex / ruins"
      : "Mixed outdoor terrain";
    return {
      scene: scene,
      materials: materials,
      features: features,
      cells: analysis.cells.length,
      walkable: walkable,
      blocked: analysis.cells.length - walkable,
      meanConfidence: confidence / total,
      corrected: analysis.cells.filter(function (cell) { return cell.corrected; }).length
    };
  }
  function paintCell(analysis, c, r, change) {
    if (!analysis || c < 0 || r < 0 || c >= analysis.grid.cols || r >= analysis.grid.rows) return analysis;
    var cell = analysis.cells[r * analysis.grid.cols + c];
    if (change.material && MATERIALS[change.material]) {
      cell.material = change.material;
      cell.materialConfidence = 1;
    }
    if (typeof change.walkable === "boolean") {
      cell.walkable = change.walkable;
      cell.featureConfidence = 1;
    }
    cell.corrected = true;
    analysis.summary = summarize(analysis);
    return analysis;
  }
  function connectedComponents(analysis) {
    var cols = analysis.grid.cols, rows = analysis.grid.rows, seen = new Set(), components = [];
    analysis.cells.forEach(function (cell) {
      var startKey = cell.c + "," + cell.r;
      if (!cell.walkable || seen.has(startKey)) return;
      var queue = [cell], component = []; seen.add(startKey);
      while (queue.length) {
        var current = queue.shift(); component.push(current);
        CARDINAL.forEach(function (delta) {
          var c = current.c + delta[0], r = current.r + delta[1], key = c + "," + r;
          if (c < 0 || r < 0 || c >= cols || r >= rows || seen.has(key)) return;
          var next = analysis.cells[r * cols + c];
          if (!next.walkable) return;
          seen.add(key); queue.push(next);
        });
      }
      components.push(component);
    });
    return components.sort(function (a, b) { return b.length - a.length; });
  }
  function rectanglesFor(analysis, includeBlocked) {
    var cols = analysis.grid.cols, rows = analysis.grid.rows, used = new Array(cols * rows).fill(false), rectangles = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var index = r * cols + c, cell = analysis.cells[index];
      if (used[index] || (!includeBlocked && !cell.walkable)) continue;
      var material = cell.material, width = 1;
      while (c + width < cols) {
        var rightIndex = r * cols + c + width, right = analysis.cells[rightIndex];
        if (used[rightIndex] || (!includeBlocked && !right.walkable) || right.material !== material) break;
        width++;
      }
      var height = 1, canGrow = true;
      while (r + height < rows && canGrow) {
        for (var x = c; x < c + width; x++) {
          var nextIndex = (r + height) * cols + x, next = analysis.cells[nextIndex];
          if (used[nextIndex] || (!includeBlocked && !next.walkable) || next.material !== material) { canGrow = false; break; }
        }
        if (canGrow) height++;
      }
      for (var y = r; y < r + height; y++) for (var x2 = c; x2 < c + width; x2++) used[y * cols + x2] = true;
      rectangles.push({ c: c, r: r, width: width, height: height, material: material });
    }
    return rectangles;
  }
  function toBlueprint(analysis, options) {
    options = options || {};
    var rectangles = rectanglesFor(analysis, true), regionId = "interpreted-area";
    var spaces = rectangles.map(function (rect, index) {
      return {
        id: "interpreted-space-" + (index + 1),
        label: MATERIALS[rect.material].label + " " + (index + 1),
        discoveryRegion: regionId,
        material: MATERIALS[rect.material].blueprint,
        elevationFt: 0,
        polygon: [
          [rect.c, rect.r], [rect.c + rect.width, rect.r],
          [rect.c + rect.width, rect.r + rect.height], [rect.c, rect.r + rect.height]
        ]
      };
    });
    var props = analysis.cells.filter(function (cell) {
      return cell.feature === "fire" && cell.walkable;
    }).slice(0, 32).map(function (cell, index) {
      return {
        id: "interpreted-fire-" + (index + 1), kind: "brazier",
        c: cell.c, r: cell.r, rotation: 0, discoveryRegion: regionId, variant: "lit"
      };
    });
    var components = connectedComponents(analysis);
    var findings = [
      {
        id: "grid", label: analysis.grid.manuallyCalibrated
          ? "Grid calibrated from one DM-drawn source square"
          : analysis.grid.detected
            ? "Grid period detected from repeated line evidence"
            : "Grid scale chosen for ungridded artwork",
        confidence: analysis.grid.confidence, accepted: false
      },
      {
        id: "materials", label: "Material palette proposed from local color and texture",
        confidence: analysis.summary.meanConfidence, accepted: false
      },
      {
        id: "walkability", label: analysis.summary.blocked + " cells proposed as water or dense cover",
        confidence: 0.68, accepted: false
      },
      {
        id: "connectivity", label: components.length === 1
          ? "One connected playable component"
          : components.length + " separate playable components need review",
        confidence: components.length === 1 ? 0.92 : 0.56, accepted: false
      }
    ];
    return {
      schema: "forge-blueprint/v1",
      version: 1,
      id: options.id || "interpreted-artwork",
      name: options.name || "Interpreted Artwork",
      topology: "image-derived terrain proposal",
      theme: analysis.summary.scene,
      grid: {
        cols: analysis.grid.cols, rows: analysis.grid.rows,
        cellFt: 5, chunkSize: 5
      },
      spaces: spaces,
      corridors: [],
      architecture: [],
      props: props,
      lights: [],
      spawns: [],
      discoveryRegions: spaces.length ? [{ id: regionId, label: "Interpreted battlefield" }] : [],
      encounterRegions: spaces.length ? [{ id: "encounter-interpreted", discoveryRegion: regionId, order: 0 }] : [],
      materialZones: [],
      elevationZones: [],
      areaSettings: spaces.length ? {
        "interpreted-area": {
          dressTogether: false, revealTogether: false,
          provenance: "Locally interpreted from user-provided artwork"
        }
      } : {},
      source: {
        kind: "imported",
        label: "Local artwork interpretation",
        createdBy: "standalone-proof",
        sourceName: options.sourceName || "Local image",
        sourceRights: options.sourceRights || "User-provided local artwork",
        underlay: true,
        review: findings,
        interpretation: {
          engine: "local-pixel-proof/v1",
          scene: analysis.summary.scene,
          materials: analysis.summary.materials,
          features: analysis.summary.features,
          correctedCells: analysis.summary.corrected,
          blockedCells: analysis.cells.filter(function (cell) { return !cell.walkable; })
            .map(function (cell) { return [cell.c, cell.r]; }),
          grid: analysis.grid
        }
      }
    };
  }

  return {
    MATERIALS: MATERIALS,
    rgbToHsv: rgbToHsv,
    detectGrid: detectGrid,
    gridFromColumns: gridFromColumns,
    gridFromDrawnBox: gridFromDrawnBox,
    sampleCell: sampleCell,
    classifyMaterial: classifyMaterial,
    analyze: analyze,
    summarize: summarize,
    paintCell: paintCell,
    connectedComponents: connectedComponents,
    rectanglesFor: rectanglesFor,
    toBlueprint: toBlueprint
  };
});
