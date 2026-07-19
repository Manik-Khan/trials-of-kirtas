/* Forge deployment-group authority · version 1
   Pure deterministic planning over an accepted map snapshot. The map authors
   regions and routes; the DM-authored flag is the only regional anchor. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ForgeDeployment = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var VERSION = 1;
  var ROLES = Object.freeze({ PARTY: "party", ALLY: "ally", ENEMY: "enemy" });
  var CONTROLLER_POLICIES = Object.freeze({ UNIT_OWNERS: "unit-owners", OVERSEER: "overseer" });

  function point(value) {
    if (!value || !Number.isFinite(Number(value.c)) || !Number.isFinite(Number(value.r))) return null;
    return { c: Math.floor(Number(value.c)), r: Math.floor(Number(value.r)) };
  }

  function pointKey(value) { return value.c + "," + value.r; }
  function copy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function hash32(value) {
    var text = String(value), hash = 2166136261;
    for (var i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }

  function assertChoice(value, choices, fallback) {
    return choices.indexOf(value) >= 0 ? value : fallback;
  }

  function normalizeGroup(input, index) {
    input = input || {};
    var role = assertChoice(input.role, [ROLES.PARTY, ROLES.ALLY, ROLES.ENEMY], ROLES.ENEMY);
    var policy = assertChoice(input.controllerPolicy,
      [CONTROLLER_POLICIES.UNIT_OWNERS, CONTROLLER_POLICIES.OVERSEER],
      role === ROLES.PARTY ? CONTROLLER_POLICIES.UNIT_OWNERS : CONTROLLER_POLICIES.OVERSEER);
    var units = [], seen = {};
    (Array.isArray(input.unitIds) ? input.unitIds : []).forEach(function (unit) {
      unit = String(unit || "").trim();
      if (unit && !seen[unit]) { seen[unit] = true; units.push(unit); }
    });
    var manual = {};
    Object.keys(input.manualPositions || {}).forEach(function (unit) {
      var at = point(input.manualPositions[unit]);
      if (at && seen[unit]) manual[unit] = at;
    });
    var id = String(input.id || ("deployment-group-" + (Number(index || 0) + 1))).trim();
    return {
      id: id,
      label: String(input.label || id).trim() || id,
      role: role,
      controllerPolicy: policy,
      unitIds: units,
      anchor: point(input.anchor),
      formationSeed: Number.isFinite(Number(input.formationSeed)) ? Number(input.formationSeed) >>> 0 : hash32(id),
      manualPositions: manual
    };
  }

  function mapIntent(map) { return map && map.meta && map.meta.intent || map && map.intent || null; }
  function mapConnectors(map) { return Array.isArray(map && map.connectors) ? map.connectors : []; }
  function inBounds(map, at) { return !!(map && at && at.c >= 0 && at.r >= 0 && at.c < map.cols && at.r < map.rows); }
  function cellIndex(map, at) { return at.r * map.cols + at.c; }

  function intentRegions(map) {
    var intent = mapIntent(map);
    return Array.isArray(intent && intent.regions) ? intent.regions : [];
  }

  function regionRecord(map, region) {
    var cells = [], seen = {};
    (Array.isArray(region && region.cells) ? region.cells : []).forEach(function (raw) {
      var at = point(raw);
      if (at && inBounds(map, at) && !seen[pointKey(at)]) { seen[pointKey(at)] = true; cells.push(at); }
    });
    return { id: String(region && region.id || ""), role: String(region && region.role || ""),
      elevationFt: Number(region && region.elevationFt || 0), cells: cells, cellSet: seen };
  }

  function regionForPoint(map, at) {
    if (!at) return null;
    var key = pointKey(at), regions = intentRegions(map);
    for (var i = 0; i < regions.length; i++) {
      var record = regionRecord(map, regions[i]);
      if (record.cellSet[key]) return record;
    }
    return null;
  }

  function connectorCells(map) {
    var out = {};
    mapConnectors(map).forEach(function (connector) {
      (Array.isArray(connector && connector.path) ? connector.path : []).forEach(function (raw) {
        var at = point(raw); if (at) out[pointKey(at)] = true;
      });
    });
    return out;
  }

  function propCells(map) {
    var out = {};
    (Array.isArray(map && map.props) ? map.props : []).forEach(function (prop) {
      var at = point(prop && { c: prop.c != null ? prop.c : prop.x, r: prop.r != null ? prop.r : prop.y });
      if (at) out[pointKey(at)] = true;
    });
    return out;
  }

  function hazardCells(map) {
    var out = {}, hazards = map && map.meta && map.meta.hazards;
    (Array.isArray(hazards) ? hazards : []).forEach(function (hazard) {
      var points = Array.isArray(hazard && hazard.cells) ? hazard.cells : [hazard];
      points.forEach(function (raw) { var at = point(raw); if (at) out[pointKey(at)] = true; });
    });
    return out;
  }

  function deploymentBlocked(map) {
    var out = connectorCells(map), props = propCells(map), hazards = hazardCells(map);
    Object.keys(props).forEach(function (key) { out[key] = true; });
    Object.keys(hazards).forEach(function (key) { out[key] = true; });
    return out;
  }

  function cellLegality(map, at, region, blocked, occupied) {
    if (!inBounds(map, at)) return "cell is outside the battlefield";
    if (!region || !region.cellSet[pointKey(at)]) return "cell is outside the group's flagged region";
    if (map.wall && map.wall[cellIndex(map, at)]) return "cell is blocked by terrain";
    if (blocked[pointKey(at)]) return "cell is reserved for a connector, landing, prop, or hazard";
    if (occupied && occupied[pointKey(at)]) return "cell is already reserved by another combatant";
    return "";
  }

  function chebyshev(a, b) { return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r)); }
  function requestedSpacing(role) { return role === ROLES.ENEMY ? 2 : 1; }

  function planGroup(map, input, options) {
    options = options || {};
    var group = normalizeGroup(input, options.index), errors = [], warnings = [], positions = {};
    var occupied = Object.assign({}, options.occupied || {}), blocked = deploymentBlocked(map);
    if (!map || !Number.isInteger(map.cols) || !Number.isInteger(map.rows)) errors.push("battlefield map is missing");
    if (!group.unitIds.length) errors.push(group.label + " has no combatants");
    if (!group.anchor) errors.push(group.label + " needs a deployment flag");
    var region = group.anchor && regionForPoint(map, group.anchor);
    if (group.anchor && !region) errors.push(group.label + " flag is outside an authored deployment region");
    if (region) {
      var flagWhy = cellLegality(map, group.anchor, region, blocked, null);
      if (flagWhy) errors.push(group.label + " flag is illegal: " + flagWhy);
    }

    var manualCells = [];
    if (region) group.unitIds.forEach(function (unit) {
      var at = group.manualPositions[unit];
      if (!at) return;
      var why = cellLegality(map, at, region, blocked, occupied);
      if (!why && manualCells.some(function (other) { return pointKey(other) === pointKey(at); }))
        why = "cell is already used by another manual position";
      if (why) errors.push(unit + " manual position is illegal: " + why);
      else { positions[unit] = copy(at); manualCells.push(at); occupied[pointKey(at)] = true; }
    });

    var candidates = [];
    if (region) region.cells.forEach(function (at) {
      if (!cellLegality(map, at, region, blocked, occupied)) candidates.push({ c: at.c, r: at.r,
        distance: chebyshev(at, group.anchor), tie: hash32(group.id + "|" + group.formationSeed + "|" + pointKey(at)) });
    });
    candidates.sort(function (a, b) { return a.distance - b.distance || a.tie - b.tie || a.r - b.r || a.c - b.c; });

    var remaining = group.unitIds.filter(function (unit) { return !positions[unit]; });
    var want = options.minSep == null ? requestedSpacing(group.role) : Math.max(0, Number(options.minSep) | 0);
    var placed = [], actual = want;
    for (var sep = want; sep >= 0; sep--) {
      placed = [];
      for (var i = 0; i < candidates.length && placed.length < remaining.length; i++) {
        var candidate = candidates[i];
        var clash = placed.concat(manualCells).some(function (other) { return chebyshev(candidate, other) <= sep; });
        if (!clash) placed.push(candidate);
      }
      actual = sep;
      if (placed.length >= remaining.length) break;
    }
    remaining.forEach(function (unit, index) {
      if (placed[index]) positions[unit] = { c: placed[index].c, r: placed[index].r };
    });
    if (actual < want && Object.keys(positions).length === group.unitIds.length)
      warnings.push(group.label + " formation compressed from " + want + " to " + actual + " clear square(s)");
    if (Object.keys(positions).length < group.unitIds.length)
      errors.push(group.label + " fits " + Object.keys(positions).length + " of " + group.unitIds.length + " combatants in " + (region ? region.id : "no region"));

    return {
      ok: errors.length === 0,
      version: VERSION,
      group: group,
      regionId: region && region.id || null,
      positions: positions,
      capacity: candidates.length + manualCells.length,
      requestedCount: group.unitIds.length,
      placedCount: Object.keys(positions).length,
      spacing: { requested: want, actual: actual, compressed: actual < want },
      errors: errors,
      warnings: warnings
    };
  }

  function planDraft(map, inputs) {
    var groups = Array.isArray(inputs) ? inputs.map(normalizeGroup) : [], errors = [], unitOwners = {}, occupied = {}, plans = [];
    groups.forEach(function (group) {
      group.unitIds.forEach(function (unit) {
        if (unitOwners[unit]) errors.push(unit + " belongs to both " + unitOwners[unit] + " and " + group.label);
        else unitOwners[unit] = group.label;
      });
    });
    groups.forEach(function (group, index) {
      var plan = planGroup(map, group, { index: index, occupied: occupied });
      plans.push(plan);
      if (plan.ok) Object.keys(plan.positions).forEach(function (unit) { occupied[pointKey(plan.positions[unit])] = unit; });
      errors = errors.concat(plan.errors);
    });
    return { ok: errors.length === 0, version: VERSION, groups: groups, plans: plans, errors: errors,
      positions: plans.reduce(function (out, plan) { Object.keys(plan.positions).forEach(function (unit) { out[unit] = copy(plan.positions[unit]); }); return out; }, {}) };
  }

  function roleSide(role) { return role === ROLES.ENEMY ? "foe" : "pc"; }

  function applyToRoster(roster, record) {
    if (!record || !record.resolved) return Array.isArray(roster) ? roster : [];
    var groupsByUnit = {};
    (record.groups || []).forEach(function (raw, index) {
      var group = normalizeGroup(raw, index);
      group.unitIds.forEach(function (unit) { groupsByUnit[unit] = group; });
    });
    return (Array.isArray(roster) ? roster : []).map(function (row) {
      var group = groupsByUnit[row.unit], at = record.positions && point(record.positions[row.unit]);
      if (!group || !at) return Object.assign({}, row);
      return Object.assign({}, row, { pos: at, side: roleSide(group.role), deploymentGroupId: group.id,
        controllerPolicy: group.controllerPolicy });
    });
  }

  function deploymentRecord(groups, draft) {
    draft = draft || planDraft(null, groups);
    return { version: VERSION, groups: (groups || []).map(normalizeGroup), positions: copy(draft.positions || {}), resolved: !!draft.ok };
  }

  return Object.freeze({
    VERSION: VERSION,
    ROLES: ROLES,
    CONTROLLER_POLICIES: CONTROLLER_POLICIES,
    normalizeGroup: normalizeGroup,
    regionForPoint: regionForPoint,
    deploymentBlocked: deploymentBlocked,
    cellLegality: cellLegality,
    planGroup: planGroup,
    planDraft: planDraft,
    deploymentRecord: deploymentRecord,
    applyToRoster: applyToRoster,
    roleSide: roleSide,
    pointKey: pointKey,
    hash32: hash32
  });
});
