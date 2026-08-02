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

  function compileMap(map) {
    var dims = mapDimensions(map), heights = validateMapArray(map, "h", dims.count), walls = validateMapArray(map, "wall", dims.count);
    var connectors = Array.isArray(map.connectors) ? map.connectors : [];
    var bridgeRecords = [], suppressGround = {};

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
      if (!walls[index] && !suppressGround[cellKey(c, r)]) {
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
    });
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
    fingerprint: fingerprint,
    _internals: { hash32: hash32, stableStringify: stableStringify, pathSignature: pathSignature }
  };
});
