/* Forge authored-architecture authority · version 2
   Small, snapshot-safe wall/gate layer plus Temple region discovery. Pure data;
   the canonical Forge surface owns THREE meshes and authoring controls. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeArchitecture = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = 2;
  var SCHEMA = "forge-architecture";
  var KINDS = Object.freeze({ wall: { heightFt: 10, blocks: true }, parapet: { heightFt: 5, blocks: true }, gate: { heightFt: 0, blocks: false } });

  function key(c, r) { return c + "," + r; }
  function copy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function integer(value) { var n = Number(value); return Number.isInteger(n) ? n : null; }

  function normalizeEdit(edit) {
    var c = integer(edit && edit.c), r = integer(edit && edit.r), kind = String(edit && edit.kind || "").toLowerCase();
    if (c == null || r == null || !KINDS[kind]) return null;
    var out = { c: c, r: r, kind: kind }, heightFt = Number(edit && edit.heightFt);
    if (KINDS[kind].blocks && Number.isFinite(heightFt) && heightFt > 0) out.heightFt = Math.max(KINDS[kind].heightFt, Math.min(60, Math.round(heightFt * 2) / 2));
    return out;
  }

  function record(edits) {
    var byCell = {}, order = [];
    (edits || []).forEach(function (raw) {
      var edit = normalizeEdit(raw); if (!edit) return;
      var k = key(edit.c, edit.r); if (!byCell[k]) order.push(k); byCell[k] = edit;
    });
    return { schema: SCHEMA, version: VERSION, fog: "region-grey", blocks: order.map(function (k) { return byCell[k]; }) };
  }

  function normalizeRecord(value) {
    if (!value || value.schema !== SCHEMA || [1, VERSION].indexOf(Number(value.version)) < 0) return record([]);
    return record(value.blocks);
  }

  function heightFt(edit) {
    var normalized = normalizeEdit(edit), def = normalized && KINDS[normalized.kind];
    return def ? Number(normalized.heightFt != null ? normalized.heightFt : def.heightFt) : 0;
  }

  function editRecord(value, edit) {
    var current = normalizeRecord(value), next = normalizeEdit(edit);
    if (!next) return current;
    return record(current.blocks.filter(function (b) { return b.c !== next.c || b.r !== next.r; }).concat([next]));
  }

  function eraseRecord(value, c, r) {
    var current = normalizeRecord(value), col = integer(c), row = integer(r);
    return record(current.blocks.filter(function (b) { return b.c !== col || b.r !== row; }));
  }

  function lineCells(anchor, direction, length, cols, rows) {
    var startC = integer(anchor && anchor.c), startR = integer(anchor && anchor.r), count = Math.max(0, integer(length) || 0);
    var step = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }[String(direction || "").toLowerCase()], out = [];
    if (startC == null || startR == null || !step) return out;
    for (var i = 1; i <= count; i++) {
      var c = startC + step[0] * i, r = startR + step[1] * i;
      if (c < 0 || r < 0 || c >= Number(cols) || r >= Number(rows)) break;
      out.push({ c: c, r: r });
    }
    return out;
  }

  function cloneMap(map) {
    var out = Object.assign({}, map), n = Number(map.cols) * Number(map.rows);
    ["h", "wall", "occ"].forEach(function (name) { out[name] = Array.from(map[name] || []); });
    out.coverShape = map.coverShape == null ? new Array(n).fill(null) : Array.from(map.coverShape);
    out.connectors = copy(map.connectors || []); out.ledges = copy(map.ledges || []); out.meta = copy(map.meta || {});
    return out;
  }

  function inBounds(map, c, r) { return !!map && c >= 0 && r >= 0 && c < map.cols && r < map.rows; }

  function apply(map, value) {
    var out = cloneMap(map), normalized = normalizeRecord(value), blocking = {}, required = requiredConnectorCells(map);
    normalized.blocks.forEach(function (edit) {
      if (!inBounds(out, edit.c, edit.r)) return;
      var i = edit.r * out.cols + edit.c, def = KINDS[edit.kind], targetHeightFt = heightFt(edit);
      out.wall[i] = !!def.blocks;
      out.occ[i] = targetHeightFt;
      out.coverShape[i] = def.blocks ? { kind: "full", source: "authored-" + edit.kind, heightFt: targetHeightFt } : null;
      if (def.blocks) blocking[key(edit.c, edit.r)] = true;
    });
    out.connectors.forEach(function (connector) {
      var hit = (connector.path || []).some(function (p) { return blocking[key(p.c, p.r)]; });
      if (hit && !(connector.path || []).some(function (p) { return required[key(p.c, p.r)] === connector.id; })) {
        connector.state = "closed"; connector.blocksWhenClosed = true; connector.architectureClosed = true;
      }
    });
    out.meta = Object.assign({}, out.meta || {}, { architecture: normalized });
    return out;
  }

  function requiredConnectorCells(map) {
    var intent = map && map.meta && map.meta.intent || map && map.intent, connectorById = {}, protectedCells = {};
    (map && map.connectors || []).forEach(function (c) { if (c && c.id) connectorById[c.id] = c; });
    (intent && intent.routes || []).filter(function (route) { return !!route.required; }).forEach(function (route) {
      (route.connectorIds || []).forEach(function (id) {
        var connector = connectorById[id];
        (connector && connector.path || []).forEach(function (p) { protectedCells[key(p.c, p.r)] = id; });
      });
    });
    return protectedCells;
  }

  function firstOpen(region, map) {
    var cells = region && region.cells || [];
    for (var i = 0; i < cells.length; i++) if (inBounds(map, cells[i].c, cells[i].r) && !map.wall[cells[i].r * map.cols + cells[i].c]) return cells[i];
    return null;
  }

  function reachable(map, start) {
    var seen = {}, queue = start ? [start] : [];
    if (start) seen[key(start.c, start.r)] = true;
    while (queue.length) {
      var at = queue.shift();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (step) {
        var c = at.c + step[0], r = at.r + step[1], k = key(c, r);
        if (!seen[k] && inBounds(map, c, r) && !map.wall[r * map.cols + c]) { seen[k] = true; queue.push({ c: c, r: r }); }
      });
    }
    return seen;
  }

  function audit(map, value) {
    var normalized = normalizeRecord(value), errors = [], protectedCells = requiredConnectorCells(map);
    normalized.blocks.forEach(function (edit) {
      if (!inBounds(map, edit.c, edit.r)) errors.push("Architecture block leaves the battlefield at " + key(edit.c, edit.r));
      else if (KINDS[edit.kind].blocks && protectedCells[key(edit.c, edit.r)]) errors.push("Required ascent blocked at " + key(edit.c, edit.r));
    });
    var applied = apply(map, normalized), intent = applied.meta && applied.meta.intent, regions = intent && intent.regions || [];
    if (regions.length) {
      var start = firstOpen(regions[0], applied), seen = reachable(applied, start);
      regions.forEach(function (region) {
        if (!(region.cells || []).some(function (cell) { return !!seen[key(cell.c, cell.r)]; })) errors.push("Required region unreachable: " + region.id);
      });
    }
    return { ok: errors.length === 0, errors: errors, record: normalized, map: applied };
  }

  function regionIndex(intent) {
    var exact = {}, bounds = [];
    (intent && intent.regions || []).forEach(function (region, order) {
      var box = { id: region.id, order: order, minC: Infinity, minR: Infinity, maxC: -Infinity, maxR: -Infinity };
      (region.cells || []).forEach(function (cell) {
        exact[key(cell.c, cell.r)] = region.id;
        box.minC = Math.min(box.minC, cell.c); box.maxC = Math.max(box.maxC, cell.c);
        box.minR = Math.min(box.minR, cell.r); box.maxR = Math.max(box.maxR, cell.r);
      });
      if (box.minC !== Infinity) bounds.push(box);
    });
    function at(c, r) {
      var direct = exact[key(c, r)]; if (direct) return direct;
      var best = null, distance = Infinity;
      bounds.forEach(function (box) {
        var dc = c < box.minC ? box.minC - c : (c > box.maxC ? c - box.maxC : 0);
        var dr = r < box.minR ? box.minR - r : (r > box.maxR ? r - box.maxR : 0);
        var d = dc + dr;
        if (d < distance || d === distance && box.order < best.order) { best = box; distance = d; }
      });
      return best && best.id || null;
    }
    return { at: at, ids: bounds.map(function (box) { return box.id; }) };
  }

  function regionStates(index, currentSources, historySources) {
    var states = {};
    (historySources || []).forEach(function (p) { var id = index.at(p.c, p.r); if (id) states[id] = Math.max(states[id] || 0, 1); });
    (currentSources || []).forEach(function (p) { var id = index.at(p.c, p.r); if (id) states[id] = 2; });
    return states;
  }

  function regionStateAt(index, states, c, r) {
    var id = index && index.at(c, r); return id ? Number(states && states[id] || 0) : 0;
  }

  return {
    VERSION: VERSION, SCHEMA: SCHEMA, KINDS: KINDS,
    normalizeEdit: normalizeEdit, record: record, normalizeRecord: normalizeRecord, editRecord: editRecord, eraseRecord: eraseRecord, heightFt: heightFt, lineCells: lineCells,
    apply: apply, audit: audit, requiredConnectorCells: requiredConnectorCells,
    regionIndex: regionIndex, regionStates: regionStates, regionStateAt: regionStateAt
  };
});
