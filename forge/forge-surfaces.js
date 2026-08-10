/* forge-surfaces.js — stable walk-surface compatibility contract.
   Browser: window.ForgeSurfaces. Node: module.exports. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeSurfaces = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SCHEMA = "forge-walk-surfaces/v1";
  var POSITION_SCHEMA = "forge-surface-position/v1";
  var VERSION = 1;
  var EPSILON = 1e-6;
  var DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

  function copy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function idx(cols, c, r) { return r * cols + c; }
  function cellKey(c, r) { return Number(c) + "," + Number(r); }
  function positionKey(position) { return cellKey(position.c, position.r) + "@" + position.surfaceId; }
  function inBounds(contract, c, r) {
    return Number.isInteger(c) && Number.isInteger(r) && c >= 0 && r >= 0 && c < contract.cols && r < contract.rows;
  }
  function hash32(value) {
    var h = 2166136261 >>> 0, text = String(value);
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function stableStringify(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    return "{" + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ":" + stableStringify(value[key]);
    }).join(",") + "}";
  }
  function fingerprint(value) { return "surfaces-" + hash32(stableStringify(value)).toString(36).padStart(7, "0"); }
  function finite(value, fallback) { var number = Number(value); return Number.isFinite(number) ? number : fallback; }
  function mapDimensions(map) {
    var cols = Number(map && (map.cols != null ? map.cols : map.W));
    var rows = Number(map && (map.rows != null ? map.rows : map.H));
    if (!Number.isInteger(cols) || cols <= 0 || !Number.isInteger(rows) || rows <= 0) {
      throw new Error("forge-surfaces: map requires positive integer cols/rows");
    }
    return { cols: cols, rows: rows, count: cols * rows };
  }
  function validateMapArray(map, name, count) {
    var value = map && map[name];
    if (!value || typeof value.length !== "number" || value.length !== count) {
      throw new Error("forge-surfaces: " + name + " cell array length must match the map");
    }
    return value;
  }
  function pathSignature(connector) {
    return (connector.path || []).map(function (point) {
      return Number(point.c) + "," + Number(point.r) + "," + finite(point.elevationFt, 0);
    }).join("|");
  }
  function bridgeSurfaceId(connector) {
    if (connector.surfaceId) return String(connector.surfaceId);
    return "surface-bridge-" + hash32(String(connector.id || "bridge") + "|" + pathSignature(connector)).toString(36).padStart(7, "0");
  }
  function surfaceById(contract, surfaceId) {
    return contract && (contract.surfaces || []).find(function (surface) { return surface.id === surfaceId; }) || null;
  }
  function cellOnSurface(surface, c, r) {
    return surface && (surface.cells || []).find(function (cell) { return cell.c === c && cell.r === r; }) || null;
  }
  function surfacePosition(contract, surfaceId, c, r, options) {
    var surface = surfaceById(contract, surfaceId), cell = cellOnSurface(surface, c, r);
    if (!surface || !cell) return null;
    if (!(options && options.includeBlocked) && (surface.walkable === false || cell.walkable === false)) return null;
    return {
      schema: POSITION_SCHEMA,
      c: c,
      r: r,
      surfaceId: surfaceId,
      elevationFt: finite(cell.elevationFt, finite(surface.elevationFt, 0))
    };
  }
  function surfacesAt(contract, c, r, options) {
    return (contract && contract.surfaces || []).map(function (surface) {
      return surfacePosition(contract, surface.id, c, r, options);
    }).filter(Boolean).sort(function (a, b) {
      return a.elevationFt - b.elevationFt || a.surfaceId.localeCompare(b.surfaceId);
    });
  }
  function normalizePosition(contract, position) {
    if (!contract || !position || !inBounds(contract, Number(position.c), Number(position.r))) return null;
    var c = Number(position.c), r = Number(position.r), found;
    if (position.surfaceId) {
      found = surfacePosition(contract, String(position.surfaceId), c, r);
      if (!found) return null;
      if (position.elevationFt != null && Math.abs(finite(position.elevationFt, Infinity) - found.elevationFt) > EPSILON) return null;
      return found;
    }
    var available = surfacesAt(contract, c, r);
    found = available.find(function (candidate) {
      var surface = surfaceById(contract, candidate.surfaceId);
      return surface && surface.kind === "bridge-deck";
    }) || available[0] || null;
    return found;
  }
  function occupiedKey(position) {
    if (!position || !position.surfaceId) throw new Error("forge-surfaces: occupancy requires a surface-aware position");
    return positionKey(position);
  }
  function pointInPolygon(x, y, polygon) {
    var inside = false;
    for (var i = 0, j = (polygon || []).length - 1; i < (polygon || []).length; j = i++) {
      var xi = Number(polygon[i][0]), yi = Number(polygon[i][1]);
      var xj = Number(polygon[j][0]), yj = Number(polygon[j][1]);
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function polygonCells(dims, surface) {
    var cells = [];
    for (var r = 0; r < dims.rows; r++) for (var c = 0; c < dims.cols; c++) {
      if (!pointInPolygon(c + 0.5, r + 0.5, surface.polygon)) continue;
      if ((surface.openings || []).some(function (opening) { return pointInPolygon(c + 0.5, r + 0.5, opening.polygon); })) continue;
      cells.push({ c: c, r: r, elevationFt: finite(surface.elevationFt, 0), walkable: surface.walkable !== false });
    }
    return cells;
  }
  function connectorSurfaceId(connector) { return "surface-connector-" + String(connector.id || "building"); }
  function tacticalConnectorPath(connector) {
    var from = connector && connector.from || {}, to = connector && connector.to || {};
    var fromC = Math.round(Number(from.c)), fromR = Math.round(Number(from.r));
    var toC = Math.round(Number(to.c)), toR = Math.round(Number(to.r));
    var segments = Math.max(1, Math.abs(toC - fromC), Math.abs(toR - fromR)), path = [];
    for (var i = 0; i <= segments; i++) {
      var t = i / segments;
      path.push({
        c: Math.round(fromC + (toC - fromC) * t), r: Math.round(fromR + (toR - fromR) * t),
        surfaceId: i === 0 ? String(from.surfaceId) : i === segments ? String(to.surfaceId) : connectorSurfaceId(connector),
        elevationFt: finite(from.elevationFt, 0) + (finite(to.elevationFt, 0) - finite(from.elevationFt, 0)) * t
      });
    }
    return path;
  }
  function compileBuildingSet(map, dims) {
    var set = map && map.meta && map.meta.buildingSet, surfaces = [], connectors = [], reserved = {};
    if (!set || set.schema !== "forge-building-set/v1") return { surfaces: surfaces, connectors: connectors, covered: reserved };
    (set.buildings || []).forEach(function (building) {
      (building.surfaces || []).forEach(function (surface) {
        surfaces.push({
          id: String(surface.id), kind: String(surface.kind || "floor"), label: String(surface.label || surface.id),
          elevationFt: finite(surface.elevationFt, 0), walkable: surface.walkable !== false,
          buildingId: String(building.id), relation: surface.relation || null, cells: polygonCells(dims, surface)
        });
      });
      (building.connectors || []).forEach(function (connector) {
        var out = copy(connector), path = tacticalConnectorPath(connector), middle = path.slice(1, -1);
        if (middle.length) {
          var id = connectorSurfaceId(connector), cells = [];
          middle.forEach(function (point) {
            var key = cellKey(point.c, point.r);
            if (!cells.some(function (cell) { return cellKey(cell.c, cell.r) === key; })) {
              cells.push({ c: point.c, r: point.r, elevationFt: point.elevationFt, walkable: true, connectorId: String(connector.id) });
            }
            reserved[key] = true;
          });
          surfaces.push({ id: id, kind: String(connector.kind || "connector"), label: String(connector.label || "Connection"),
            walkable: true, buildingId: String(building.id), connectorId: String(connector.id), cells: cells });
        }
        out.path = path; out.sourcePath = copy(connector.path || []); connectors.push(out);
      });
    });
    surfaces.forEach(function (surface) {
      if (!surface.connectorId) surface.cells = surface.cells.filter(function (cell) { return !reserved[cellKey(cell.c, cell.r)]; });
    });
    connectors.forEach(function (connector) {
      [connector.path[0], connector.path[connector.path.length - 1]].forEach(function (point) {
        var surface = surfaces.find(function (candidate) { return candidate.id === point.surfaceId; });
        if (!surface || surface.cells.some(function (cell) { return cell.c === point.c && cell.r === point.r; })) return;
        surface.cells.push({ c: point.c, r: point.r, elevationFt: point.elevationFt, walkable: surface.walkable !== false, connectorId: connector.id });
      });
    });
    surfaces.forEach(function (surface) {
      if (surface.walkable === false) return;
      surface.cells.forEach(function (cell) { reserved[cellKey(cell.c, cell.r)] = true; });
    });
    return { surfaces: surfaces, connectors: connectors, covered: reserved };
  }

  function compileMap(map) {
    var dims = mapDimensions(map), heights = validateMapArray(map, "h", dims.count), walls = validateMapArray(map, "wall", dims.count);
    var connectors = Array.isArray(map.connectors) ? map.connectors : [];
    var bridgeRecords = [], suppressGround = {}, building = compileBuildingSet(map, dims);

    connectors.forEach(function (connector, connectorIndex) {
      if (!connector || connector.kind !== "bridge") return;
      var path = Array.isArray(connector.path) ? connector.path : [];
      if (path.length < 2) return;
      var record = {
        connector: connector,
        connectorIndex: connectorIndex,
        id: bridgeSurfaceId(connector),
        active: connector.state !== "closed" && connector.state !== "broken",
        cells: [],
        path: [],
        underpassCells: []
      };
      path.forEach(function (point, pathIndex) {
        var c = Number(point.c), r = Number(point.r);
        if (!Number.isInteger(c) || !Number.isInteger(r) || c < 0 || r < 0 || c >= dims.cols || r >= dims.rows) return;
        var index = idx(dims.cols, c, r), elevationFt = finite(point.elevationFt, finite(heights[index], 0));
        var groundExists = !walls[index], groundElevationFt = finite(heights[index], 0);
        var distinctDeck = !groundExists || Math.abs(elevationFt - groundElevationFt) > EPSILON;
        if (distinctDeck) {
          record.cells.push({ c: c, r: r, elevationFt: elevationFt, walkable: record.active, connectorId: String(connector.id || "connector-" + connectorIndex) });
          record.path.push({ c: c, r: r, surfaceId: record.id, elevationFt: elevationFt });
          if (record.active && groundExists && connector.supportsUnderpass) {
            if (pathIndex > 0 && pathIndex < path.length - 1) record.underpassCells.push({ c: c, r: r });
          } else if (record.active && groundExists && !connector.supportsUnderpass) {
            suppressGround[cellKey(c, r)] = true;
          }
        } else {
          record.path.push({ c: c, r: r, surfaceId: "surface-ground", elevationFt: groundElevationFt });
        }
      });
      bridgeRecords.push(record);
    });

    var groundCells = [];
    for (var r = 0; r < dims.rows; r++) for (var c = 0; c < dims.cols; c++) {
      var index = idx(dims.cols, c, r);
      if (!walls[index] && !suppressGround[cellKey(c, r)] && !building.covered[cellKey(c, r)]) {
        groundCells.push({ c: c, r: r, elevationFt: finite(heights[index], 0), walkable: true });
      }
    }
    var surfaces = [{
      id: "surface-ground",
      kind: "ground",
      label: "Battlefield ground",
      walkable: true,
      cells: groundCells
    }];
    bridgeRecords.forEach(function (record) {
      surfaces.push({
        id: record.id,
        kind: "bridge-deck",
        label: record.connector.label || "Bridge deck",
        walkable: record.active,
        connectorId: String(record.connector.id || "connector-" + record.connectorIndex),
        deckThicknessFt: finite(record.connector.deckThicknessFt, 0.5),
        clearanceFt: record.connector.clearanceFt == null ? null : finite(record.connector.clearanceFt, null),
        supportsUnderpass: !!record.connector.supportsUnderpass,
        underpassSurfaceId: record.underpassCells.length ? "surface-ground" : null,
        cells: record.cells
      });
    });
    building.surfaces.forEach(function (surface) { surfaces.push(surface); });

    var normalizedConnectors = connectors.map(function (connector, connectorIndex) {
      var out = copy(connector) || {}, bridge = bridgeRecords.find(function (record) { return record.connectorIndex === connectorIndex; });
      out.id = String(out.id || "connector-" + connectorIndex);
      if (bridge) {
        out.deckSurfaceId = bridge.id;
        out.underpassSurfaceId = bridge.underpassCells.length ? "surface-ground" : null;
        out.path = copy(bridge.path);
      } else if (Array.isArray(out.path)) {
        out.path = out.path.map(function (point) {
          var normalized = normalizePosition({ cols: dims.cols, rows: dims.rows, surfaces: surfaces }, point);
          return normalized || copy(point);
        });
      }
      return out;
    }).concat(copy(building.connectors));
    var columnCounts = {};
    surfaces.forEach(function (surface) {
      if (surface.walkable === false) return;
      surface.cells.forEach(function (cell) {
        if (cell.walkable === false) return;
        var key = cellKey(cell.c, cell.r); columnCounts[key] = (columnCounts[key] || 0) + 1;
      });
    });
    var stackedColumns = Object.keys(columnCounts).filter(function (key) { return columnCounts[key] > 1; }).length;
    var underpassColumns = bridgeRecords.reduce(function (sum, record) { return sum + record.underpassCells.length; }, 0);
    var body = {
      schema: SCHEMA,
      version: VERSION,
      cols: dims.cols,
      rows: dims.rows,
      positionSchema: POSITION_SCHEMA,
      surfaces: surfaces,
      connectors: normalizedConnectors,
      receipt: {
        surfaceCount: surfaces.length,
        groundCells: groundCells.length,
        bridgeDecks: bridgeRecords.length,
        buildingSurfaces: building.surfaces.length,
        buildingConnectors: building.connectors.length,
        stackedColumns: stackedColumns,
        underpassColumns: underpassColumns,
        compatibility: "legacy-positions-prefer-open-bridge-decks"
      }
    };
    body.fingerprint = fingerprint(body);
    var verdict = validate(body);
    if (!verdict.ok) throw new Error("forge-surfaces: compiled contract is invalid: " + verdict.errors.join(" "));
    return body;
  }

  function validate(contract) {
    var errors = [], ids = {};
    if (!contract || contract.schema !== SCHEMA || contract.version !== VERSION) errors.push("Unsupported surface contract.");
    if (!contract || !Number.isInteger(contract.cols) || !Number.isInteger(contract.rows)) errors.push("Surface contract dimensions are invalid.");
    (contract && contract.surfaces || []).forEach(function (surface) {
      if (!surface.id || ids[surface.id]) errors.push("Walk-surface IDs must be present and unique.");
      ids[surface.id] = true;
      var cells = {};
      (surface.cells || []).forEach(function (cell) {
        var key = cellKey(cell.c, cell.r);
        if (!inBounds(contract, cell.c, cell.r)) errors.push("Surface " + surface.id + " has an out-of-bounds cell.");
        if (cells[key]) errors.push("Surface " + surface.id + " repeats cell " + key + ".");
        if (!Number.isFinite(Number(cell.elevationFt))) errors.push("Surface " + surface.id + " has a non-finite elevation.");
        cells[key] = true;
      });
    });
    (contract && contract.connectors || []).forEach(function (connector) {
      if (connector.deckSurfaceId && !ids[connector.deckSurfaceId]) errors.push("Connector " + connector.id + " has an unknown deck surface.");
      if (connector.underpassSurfaceId && !ids[connector.underpassSurfaceId]) errors.push("Connector " + connector.id + " has an unknown underpass surface.");
      (connector.path || []).forEach(function (point) {
        if (point.surfaceId && !ids[point.surfaceId]) errors.push("Connector " + connector.id + " path has an unknown surface.");
        else if (point.surfaceId) {
          var position = surfacePosition(contract, point.surfaceId, point.c, point.r, { includeBlocked: true });
          if (!position) errors.push("Connector " + connector.id + " path misses its walk surface.");
          else if (Math.abs(position.elevationFt - finite(point.elevationFt, Infinity)) > EPSILON) errors.push("Connector " + connector.id + " path elevation disagrees with its walk surface.");
        }
      });
    });
    return { ok: errors.length === 0, errors: errors };
  }

  function attach(map) {
    var contract = compileMap(map);
    map.surfaceContract = contract;
    map.meta = Object.assign({}, map.meta || {}, { surfaceContract: {
      schema: contract.schema,
      version: contract.version,
      fingerprint: contract.fingerprint,
      surfaceCount: contract.receipt.surfaceCount,
      underpassColumns: contract.receipt.underpassColumns
    } });
    return contract;
  }

  function samePosition(a, b) { return !!a && !!b && a.c === b.c && a.r === b.r && a.surfaceId === b.surfaceId; }
  function unitPosition(contract, unit) {
    return normalizePosition(contract, unit && { c: unit.c, r: unit.r, surfaceId: unit.surfaceId, elevationFt: unit.elevationFt });
  }
  function connectorSegments(contract) {
    var segments = [];
    (contract && contract.connectors || []).forEach(function (connector) {
      if (connector.state === "closed" || connector.state === "broken") return;
      var path = connector.path || [];
      for (var i = 0; i < path.length - 1; i++) {
        segments.push({ connector: connector, from: path[i], to: path[i + 1] });
        if (!connector.oneWay) segments.push({ connector: connector, from: path[i + 1], to: path[i] });
      }
    });
    return segments;
  }
  function transitionCostFt(unit, from, to, connector) {
    var horizontal = Math.max(Math.abs(to.c - from.c), Math.abs(to.r - from.r)) * 5;
    var vertical = Math.abs(finite(to.elevationFt, 0) - finite(from.elevationFt, 0));
    if (connector && connector.kind === "climb") {
      return finite(unit && (unit.climb || unit.climbSpeedFt), 0) > 0 ? Math.max(horizontal, vertical) : Math.max(horizontal, vertical) * 2;
    }
    return Math.max(5, horizontal, vertical);
  }
  function sameSurfaceNeighbors(contract, position) {
    var surface = surfaceById(contract, position.surfaceId), out = [];
    if (!surface) return out;
    DIRS.forEach(function (step) {
      var next = surfacePosition(contract, surface.id, position.c + step[0], position.r + step[1]);
      if (!next || Math.abs(next.elevationFt - position.elevationFt) > 5) return;
      if (step[0] && step[1]
        && !surfacePosition(contract, surface.id, position.c + step[0], position.r)
        && !surfacePosition(contract, surface.id, position.c, position.r + step[1])) return;
      out.push({ position: next, costFt: 5, via: "surface" });
    });
    return out;
  }
  function connectorNeighbors(contract, position, unit) {
    return connectorSegments(contract).filter(function (segment) { return samePosition(segment.from, position); }).map(function (segment) {
      return { position: copy(segment.to), costFt: transitionCostFt(unit, segment.from, segment.to, segment.connector),
        via: segment.connector.kind, connectorId: segment.connector.id };
    });
  }
  function reachable(contract, unit, units, budgetFt) {
    var start = unitPosition(contract, unit);
    if (!start) return {};
    var occupied = new Set(), except = unit && (unit.unit || unit.id);
    (units || []).forEach(function (candidate) {
      if (candidate.alive === false || (candidate.unit || candidate.id) === except) return;
      var at = unitPosition(contract, candidate); if (at) occupied.add(positionKey(at));
    });
    var startKey = positionKey(start), seen = {}, queue = [{ key: startKey, costFt: 0 }];
    seen[startKey] = { costFt: 0, from: null, position: start, via: "start" };
    while (queue.length) {
      queue.sort(function (a, b) { return a.costFt - b.costFt; });
      var current = queue.shift(), record = seen[current.key];
      if (!record || current.costFt !== record.costFt) continue;
      sameSurfaceNeighbors(contract, record.position).concat(connectorNeighbors(contract, record.position, unit)).forEach(function (next) {
        var key = positionKey(next.position), cost = record.costFt + next.costFt;
        if (cost > finite(budgetFt, finite(unit && unit.speed, 30)) || occupied.has(key)) return;
        if (!seen[key] || cost < seen[key].costFt) {
          seen[key] = { costFt: cost, from: current.key, position: copy(next.position), via: next.via, connectorId: next.connectorId || null };
          queue.push({ key: key, costFt: cost });
        }
      });
    }
    delete seen[startKey];
    return seen;
  }
  function pathTo(reach, unit, destination) {
    var path = [], key = positionKey(destination), home = positionKey({ c: unit.c, r: unit.r, surfaceId: unit.surfaceId });
    while (key && key !== home) {
      var record = reach[key]; if (!record) return [];
      path.unshift({ position: copy(record.position), costFt: record.costFt, via: record.via, connectorId: record.connectorId || null });
      key = record.from;
    }
    return path;
  }

  return {
    SCHEMA: SCHEMA,
    POSITION_SCHEMA: POSITION_SCHEMA,
    VERSION: VERSION,
    cellKey: cellKey,
    positionKey: positionKey,
    occupiedKey: occupiedKey,
    bridgeSurfaceId: bridgeSurfaceId,
    surfaceById: surfaceById,
    surfacePosition: surfacePosition,
    surfacesAt: surfacesAt,
    normalizePosition: normalizePosition,
    compileMap: compileMap,
    validate: validate,
    attach: attach,
    samePosition: samePosition,
    unitPosition: unitPosition,
    reachable: reachable,
    pathTo: pathTo,
    transitionCostFt: transitionCostFt,
    fingerprint: fingerprint,
    _internals: { hash32: hash32, stableStringify: stableStringify, pathSignature: pathSignature,
      pointInPolygon: pointInPolygon, tacticalConnectorPath: tacticalConnectorPath }
  };
});
