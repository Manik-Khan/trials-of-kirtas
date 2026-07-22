/* Forge encounter-region activation authority · version 1
   Deployment owns exact positions. This module owns only when an authored
   group joins initiative; discovery/visibility remain separate systems. */
(function (root, factory) {
  var FD = (typeof require !== "undefined") ? require("./forge-deployment.js") : root.ForgeDeployment;
  var api = factory(FD);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ForgeEncounterRegions = api;
})(typeof window !== "undefined" ? window : globalThis, function (FD) {
  "use strict";

  var VERSION = 1;
  var MODES = Object.freeze({ ACTIVE: "active", ENTER: "enter", DM: "dm" });

  function copy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function choice(value, values, fallback) { return values.indexOf(value) >= 0 ? value : fallback; }
  function defaultMode(role) { return role === "enemy" ? MODES.ENTER : MODES.ACTIVE; }

  function normalizeRule(input, group, homeRegionId) {
    input = input || {}; group = group || {};
    var mode = choice(input.mode, [MODES.ACTIVE, MODES.ENTER, MODES.DM], defaultMode(group.role));
    return {
      groupId: String(group.id || input.groupId || ""),
      label: String(group.label || input.label || group.id || input.groupId || "Group"),
      role: String(group.role || input.role || "enemy"),
      unitIds: (group.unitIds || input.unitIds || []).slice(),
      mode: mode,
      triggerRegionId: mode === MODES.ENTER ? String(input.triggerRegionId || homeRegionId || "") : null,
      homeRegionId: homeRegionId || input.homeRegionId || null
    };
  }

  function buildRecord(deployment, map, overrides) {
    overrides = overrides || {};
    var errors = [], groups = [];
    (deployment && deployment.groups || []).forEach(function (raw, index) {
      var group = FD && FD.normalizeGroup ? FD.normalizeGroup(raw, index) : copy(raw);
      var region = group.anchor && FD && FD.regionForPoint ? FD.regionForPoint(map, group.anchor) : null;
      var rule = normalizeRule(overrides[group.id], group, region && region.id || null);
      if (rule.mode === MODES.ENTER && !rule.triggerRegionId)
        errors.push(rule.label + " needs an entry region");
      groups.push(rule);
    });
    return { version: VERSION, resolved: !!(deployment && deployment.resolved) && errors.length === 0,
      groups: groups, errors: errors };
  }

  function normalizeRecord(record) {
    if (!record || Number(record.version) !== VERSION || !Array.isArray(record.groups)) return null;
    return { version: VERSION, resolved: record.resolved !== false,
      groups: record.groups.map(function (raw) { return normalizeRule(raw, raw, raw.homeRegionId || null); }),
      errors: (record.errors || []).slice() };
  }

  function applyToRoster(roster, record) {
    var normalized = normalizeRecord(record), byUnit = {};
    if (!normalized || !normalized.resolved) return (roster || []).map(function (row) { return Object.assign({}, row); });
    normalized.groups.forEach(function (group) {
      group.unitIds.forEach(function (unit) { byUnit[unit] = group; });
    });
    return (roster || []).map(function (row) {
      var group = byUnit[row.unit];
      if (!group) return Object.assign({}, row);
      return Object.assign({}, row, {
        encounterGroupId: group.groupId,
        encounterGroupLabel: group.label,
        encounterGroupRole: group.role,
        encounterActivationMode: group.mode,
        encounterTriggerRegionId: group.triggerRegionId,
        encounterHomeRegionId: group.homeRegionId
      });
    });
  }

  function groupsFromRoster(roster) {
    var configured = (roster || []).some(function (row) { return !!row.encounterGroupId; });
    if (!configured) return null;
    var groups = {};
    (roster || []).forEach(function (row) {
      if (!row.encounterGroupId) return;
      var id = row.encounterGroupId, mode = choice(row.encounterActivationMode,
        [MODES.ACTIVE, MODES.ENTER, MODES.DM], MODES.ACTIVE);
      if (!groups[id]) groups[id] = {
        id: id, label: row.encounterGroupLabel || id, role: row.encounterGroupRole || (row.side === "foe" ? "enemy" : "party"),
        unitIds: [], mode: mode, triggerRegionId: row.encounterTriggerRegionId || null,
        homeRegionId: row.encounterHomeRegionId || null,
        state: mode === MODES.ACTIVE ? "active" : "waiting", reason: null, activatedSeq: null
      };
      groups[id].unitIds.push(row.unit);
    });
    return { version: VERSION, groups: groups };
  }

  function groupForUnit(state, unitId) {
    var groups = state && state.encounterRegions && state.encounterRegions.groups || {};
    var ids = Object.keys(groups);
    for (var i = 0; i < ids.length; i++) if (groups[ids[i]].unitIds.indexOf(unitId) >= 0) return groups[ids[i]];
    return null;
  }

  function initialInitiativeUnits(roster) {
    var configured = (roster || []).some(function (row) { return !!row.encounterGroupId; });
    if (!configured) return (roster || []).map(function (row) { return row.unit; });
    return (roster || []).filter(function (row) {
      return !row.encounterGroupId || row.encounterActivationMode === MODES.ACTIVE;
    }).map(function (row) { return row.unit; });
  }

  function regionIdForPoint(map, at) {
    var region = FD && FD.regionForPoint ? FD.regionForPoint(map, at) : null;
    return region && region.id || null;
  }

  function groupsTriggeredByEntry(state, unitId, regionId) {
    var unit = state && state.units && state.units[unitId];
    if (!unit || unit.side !== "pc" || unit.downed || !regionId) return [];
    var groups = state.encounterRegions && state.encounterRegions.groups || {};
    return Object.keys(groups).map(function (id) { return groups[id]; }).filter(function (group) {
      return group.state === "waiting" && group.mode === MODES.ENTER && group.triggerRegionId === regionId;
    });
  }

  function hostileWaitingGroup(state, attackerId, targetId) {
    var attacker = state && state.units && state.units[attackerId], target = state && state.units && state.units[targetId];
    if (!attacker || !target || attacker.side === target.side) return null;
    var group = groupForUnit(state, targetId);
    return group && group.state === "waiting" ? group : null;
  }

  function initiativeOrderForActivation(state, groupId) {
    var group = state && state.encounterRegions && state.encounterRegions.groups && state.encounterRegions.groups[groupId];
    var order = state && state.initiative ? state.initiative.slice() : [];
    if (!group) return order;
    var additions = group.unitIds.filter(function (unit) { return order.indexOf(unit) < 0; });
    additions.sort(function (a, b) { return (Number(state.rolls[b]) || 0) - (Number(state.rolls[a]) || 0) || String(a).localeCompare(String(b)); });
    additions.forEach(function (unit) {
      var score = state.rolls[unit] == null ? -Infinity : Number(state.rolls[unit]);
      var at = order.length;
      for (var i = 0; i < order.length; i++) {
        var other = state.rolls[order[i]] == null ? -Infinity : Number(state.rolls[order[i]]);
        if (score > other) { at = i; break; }
      }
      order.splice(at, 0, unit);
    });
    return order;
  }

  function activationPayload(state, groupId, reason) {
    return { group_id: groupId, reason: reason || "dm", order: initiativeOrderForActivation(state, groupId),
      resume_at: state && state.initiative && state.initiative.length ? state.initiative[state.turnsEnded % state.initiative.length] : null,
      preserve_turn: true };
  }

  return Object.freeze({
    VERSION: VERSION, MODES: MODES, defaultMode: defaultMode, normalizeRule: normalizeRule,
    buildRecord: buildRecord, normalizeRecord: normalizeRecord, applyToRoster: applyToRoster,
    groupsFromRoster: groupsFromRoster, groupForUnit: groupForUnit,
    initialInitiativeUnits: initialInitiativeUnits, regionIdForPoint: regionIdForPoint,
    groupsTriggeredByEntry: groupsTriggeredByEntry, hostileWaitingGroup: hostileWaitingGroup,
    initiativeOrderForActivation: initiativeOrderForActivation, activationPayload: activationPayload
  });
});
