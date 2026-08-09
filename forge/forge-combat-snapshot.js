/* forge-combat-snapshot.js
   Exact persistence authority for the Blueprint Combat surface. The authored
   Blueprint and Build edits remain immutable inputs; renderer, deployment,
   discovery, and disposable-fight state are saved beside them. */
(function (root, factory) {
  var BP = typeof module !== "undefined" && module.exports ? require("./forge-blueprint.js") : root.ForgeBlueprint;
  var FR = typeof module !== "undefined" && module.exports ? require("./forge-replay.js") : root.ForgeReplay;
  var api = factory(BP, FR);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ForgeCombatSnapshot = api;
})(typeof window !== "undefined" ? window : globalThis, function (BP, FR) {
  "use strict";

  var SCHEMA = "forge-combat-snapshot/v1";
  var SESSION_SCHEMA = "forge-blueprint-session/v1";
  var VERSION = 1;

  function copy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    return "{" + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ":" + stableStringify(value[key]);
    }).join(",") + "}";
  }
  function hash(value) {
    var text = stableStringify(value), result = 2166136261;
    for (var i = 0; i < text.length; i++) { result ^= text.charCodeAt(i); result = Math.imul(result, 16777619); }
    return ("00000000" + (result >>> 0).toString(16)).slice(-8);
  }
  function fieldFingerprint(map) {
    return "field-" + hash({
      cols: map.cols, rows: map.rows, h: map.h, wall: map.wall, occ: map.occ,
      coverShape: map.coverShape, connectors: map.connectors, props: map.props, meta: map.meta
    });
  }
  function rendererChoice(renderer) {
    renderer = renderer || {};
    var view = ["artwork", "board", "blueprint"].indexOf(renderer.view) >= 0 ? renderer.view : "board";
    var quality = ["basic", "balanced", "cinematic"].indexOf(renderer.quality) >= 0 ? renderer.quality : "balanced";
    return { view: view, quality: quality };
  }
  function fightRecord(fight) {
    if (!fight) return null;
    var saved = copy(fight);
    delete saved.map;
    return saved;
  }
  function validateFight(fight, map, blueprintFingerprint) {
    if (!fight) return;
    if (!Array.isArray(fight.units) || !fight.units.length) throw new Error("Combat snapshot fight requires units.");
    if (fight.identity && fight.identity.fingerprint && fight.identity.fingerprint !== blueprintFingerprint) {
      throw new Error("Combat snapshot fight belongs to a different Blueprint.");
    }
    fight.units.forEach(function (unit) {
      if (!unit || !unit.unit || !Number.isInteger(unit.c) || !Number.isInteger(unit.r)) throw new Error("Combat snapshot has an invalid unit position.");
      if (unit.c < 0 || unit.r < 0 || unit.c >= map.cols || unit.r >= map.rows) throw new Error("Combat snapshot unit is outside the Blueprint field.");
      if (map.wall[unit.r * map.cols + unit.c]) throw new Error("Combat snapshot unit occupies blocked Blueprint terrain.");
    });
  }
  function create(input) {
    input = input || {};
    if (!BP || !FR) throw new Error("Forge snapshot dependencies are unavailable.");
    var blueprint = copy(input.blueprint), edits = copy(input.edits || {});
    if (!blueprint || blueprint.schema !== "forge-blueprint/v1" || Number(blueprint.version) !== 1) {
      throw new Error("Combat snapshot requires forge-blueprint/v1.");
    }
    var map = BP.compile(blueprint, edits), blueprintFingerprint = BP.fingerprint(blueprint);
    var fight = fightRecord(input.fight);
    validateFight(fight, map, blueprintFingerprint);
    return {
      schema: SCHEMA, version: VERSION, savedAt: input.savedAt || new Date().toISOString(),
      authored: {
        blueprint: blueprint,
        blueprintFingerprint: blueprintFingerprint,
        structuralFingerprint: BP.structuralFingerprint(blueprint),
        edits: edits,
        fieldFingerprint: fieldFingerprint(map)
      },
      renderer: rendererChoice(input.renderer),
      deployment: {
        groups: copy(input.groups || []),
        record: copy(input.deployment || null)
      },
      presentation: {
        discovered: copy(input.discovered || []),
        calibration: copy(input.calibration || null),
        gridVisible: input.gridVisible !== false
      },
      combat: {
        selectedPartyKeys: copy(input.selectedPartyKeys || []),
        fight: fight
      }
    };
  }
  function restore(record) {
    if (!record || record.schema !== SCHEMA || Number(record.version) !== VERSION) throw new Error("Unknown Forge Combat snapshot version.");
    var authored = record.authored || {}, blueprint = copy(authored.blueprint), edits = copy(authored.edits || {});
    if (!blueprint || BP.fingerprint(blueprint) !== authored.blueprintFingerprint) throw new Error("Combat snapshot Blueprint fingerprint mismatch.");
    if (BP.structuralFingerprint(blueprint) !== authored.structuralFingerprint) throw new Error("Combat snapshot structural fingerprint mismatch.");
    var map = BP.compile(blueprint, edits);
    if (fieldFingerprint(map) !== authored.fieldFingerprint) throw new Error("Combat snapshot tactical field fingerprint mismatch.");
    var fight = copy(record.combat && record.combat.fight || null);
    validateFight(fight, map, authored.blueprintFingerprint);
    if (fight) fight.map = copy(map);
    return {
      blueprint: blueprint, edits: edits, map: map,
      renderer: rendererChoice(record.renderer),
      groups: copy(record.deployment && record.deployment.groups || []),
      deployment: copy(record.deployment && record.deployment.record || null),
      discovered: copy(record.presentation && record.presentation.discovered || []),
      calibration: copy(record.presentation && record.presentation.calibration || null),
      gridVisible: !record.presentation || record.presentation.gridVisible !== false,
      selectedPartyKeys: copy(record.combat && record.combat.selectedPartyKeys || []),
      fight: fight
    };
  }
  function roster(record) {
    var restored = restore(record), fight = restored.fight;
    if (!fight) throw new Error("A local fight is required before opening a shared table.");
    return fight.units.map(function (unit) {
      return {
        unit: unit.unit, name: unit.name, kind: unit.side === "foe" ? "foe" : "pc", side: unit.side,
        pos: { c: unit.c, r: unit.r }, hp: unit.hp, maxHp: unit.hpMax,
        resources: copy(unit.resources || {}), conditions: copy(unit.conditions || []), reacts: copy(unit.reacts || []),
        ac: unit.ac, speed: unit.speed, initiative: unit.initiative, action: copy(unit.action || null)
      };
    });
  }
  function replayBaseline(record) {
    var restored = restore(record), fight = restored.fight, rows = roster(record);
    var state = FR.initialState(rows), count = fight.units.length;
    state.status = "active";
    state.initiative = fight.units.map(function (unit) { return unit.unit; });
    state.turnsEnded = Math.max(0, (Math.max(1, Number(fight.round) || 1) - 1) * count + (Number(fight.turn) || 0));
    var active = fight.units[state.turnsEnded % count];
    state.economy = {
      unit: active.unit, movedFt: active.moved ? Number(active.speed) || 30 : 0,
      movementBonusFt: 0, movementCostFt: 0, usedAction: !!active.acted, usedBonus: false,
      attacked: !!active.acted, spellCasts: [], bonusSpellCast: false
    };
    state.rolls = {};
    state.initiativeEvidence = {};
    fight.units.forEach(function (unit) {
      state.rolls[unit.unit] = unit.initiative;
      state.initiativeEvidence[unit.unit] = { version: "snapshot", kind: "initiative", mode: "saved-total", total: unit.initiative, opaque: true };
    });
    return FR.snapshot(state);
  }
  function fightFromReplay(record, replayState) {
    var restored = restore(record), fight = restored.fight;
    if (!fight || !replayState) return fight;
    var definitions = {};
    fight.units.forEach(function (unit) { definitions[unit.unit] = unit; });
    var order = Array.isArray(replayState.initiative) && replayState.initiative.length
      ? replayState.initiative.slice() : fight.units.map(function (unit) { return unit.unit; });
    fight.units = order.map(function (key) {
      var unit = definitions[key], facts = replayState.units && replayState.units[key];
      if (!unit || !facts) return null;
      unit.c = facts.pos.c; unit.r = facts.pos.r; unit.hp = facts.hp; unit.hpMax = facts.maxHp;
      unit.alive = facts.hp > 0;
      unit.moved = replayState.economy && replayState.economy.unit === key && replayState.economy.movedFt > 0;
      unit.acted = replayState.economy && replayState.economy.unit === key && replayState.economy.usedAction;
      return unit;
    }).filter(Boolean);
    fight.turn = fight.units.length ? replayState.turnsEnded % fight.units.length : 0;
    fight.round = fight.units.length ? Math.floor(replayState.turnsEnded / fight.units.length) + 1 : 1;
    fight.map = copy(restored.map);
    return fight;
  }
  function toSessionMap(record) {
    restore(record);
    return { schema: SESSION_SCHEMA, version: VERSION, combatSnapshot: copy(record) };
  }
  function readSessionMap(map) {
    if (map && map.schema === SESSION_SCHEMA && Number(map.version) === VERSION && map.combatSnapshot) {
      return { kind: "blueprint", snapshot: copy(map.combatSnapshot) };
    }
    return { kind: "legacy", map: copy(map || null) };
  }

  return Object.freeze({
    SCHEMA: SCHEMA, SESSION_SCHEMA: SESSION_SCHEMA, VERSION: VERSION,
    create: create, restore: restore, roster: roster, replayBaseline: replayBaseline,
    fightFromReplay: fightFromReplay, toSessionMap: toSessionMap, readSessionMap: readSessionMap,
    fieldFingerprint: fieldFingerprint
  });
});
