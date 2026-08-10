/* forge-combat-shared.js
   Pure adapter between the guarded Blueprint fight and the existing Forge
   event protocol. Rules resolve locally; only self-contained facts travel. */
(function (root, factory) {
  var Local = typeof module !== "undefined" && module.exports ? require("./forge-combat-local.js") : root.ForgeCombatLocal;
  var api = factory(Local);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ForgeCombatShared = api;
})(typeof window !== "undefined" ? window : globalThis, function (Local) {
  "use strict";

  var VERSION = 1;
  function copy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function finite(value, fallback) { value = Number(value); return Number.isFinite(value) ? value : fallback; }
  function unitPosition(unit) {
    var position = { c: Number(unit.c), r: Number(unit.r) };
    if (unit.surfaceId) { position.surfaceId = unit.surfaceId; position.elevationFt = finite(unit.elevationFt, 0); }
    return position;
  }
  function canControl(me, unit) {
    return !!(me && unit && (me.overseer || Array.isArray(me.units) && me.units.indexOf(unit) >= 0));
  }
  function prepareMove(fight, destination, baseSeq) {
    if (!Local) throw new Error("Forge local-combat authority is unavailable.");
    var result = Local.moveActive(fight, destination);
    if (!result.ok) return result;
    var active = Local.activeUnit(result.fight), path = copy(result.path || []);
    return {
      ok: true, message: result.message, previewFight: result.fight, path: path,
      resolved: {
        final_cell: unitPosition(active), path: path, cost_ft: finite(result.costFt, path.length * 5),
        base_seq: finite(baseSeq, 0), label: active.name
      }
    };
  }
  function prepareAttack(fight, targetId, baseSeq) {
    if (!Local) throw new Error("Forge local-combat authority is unavailable.");
    var seeded = copy(fight);
    seeded.eventIndex = Math.max(finite(seeded.eventIndex, 0), finite(baseSeq, 0));
    var attacker = Local.activeUnit(seeded), target = seeded.units.find(function (unit) { return unit.unit === targetId; });
    var result = Local.resolveAttack(seeded, targetId);
    if (!result.ok) return result;
    return {
      ok: true, message: result.message, previewFight: result.fight,
      declared: {
        target: targetId, roll: result.roll, total: result.total, defense: result.defense,
        mode: attacker.action && attacker.action.kind || "attack", action_id: attacker.action && attacker.action.id,
        label: attacker.action && attacker.action.label || "Attack", base_seq: finite(baseSeq, 0)
      },
      resolved: {
        target: targetId, hit: result.hit, dmg: result.damage, slot: "action",
        roll: result.roll, total: result.total, defense: result.defense,
        label: attacker.action && attacker.action.label || "Attack", target_label: target && target.name || targetId,
        cover: result.sight && result.sight.cover || "none", base_seq: finite(baseSeq, 0)
      }
    };
  }
  function names(units) {
    var byId = {};
    (units || []).forEach(function (unit) { byId[unit.unit] = unit.name || unit.unit; });
    return byId;
  }
  function eventMessage(row, byId) {
    var payload = row.payload || {}, actor = byId[row.unit] || payload.label || row.unit;
    if (row.kind === "move_resolved") {
      var at = payload.interrupted_at || payload.final_cell || {};
      return actor + " moved " + finite(payload.cost_ft, (payload.path || []).length * 5) + " ft to " + at.c + "," + at.r
        + (at.surfaceId ? " · " + at.surfaceId.replace(/^surface-/, "").replace(/-/g, " ") + " at " + finite(at.elevationFt, 0) + " ft" : "") + ".";
    }
    if (row.kind === "attack_resolved") {
      var target = payload.target_label || byId[payload.target] || payload.target || "the target";
      return actor + " used " + (payload.label || "Attack") + ": " + finite(payload.roll, 0) + " vs AC " + finite(payload.defense, 0)
        + (payload.hit ? " — " + finite(payload.dmg, 0) + " damage to " + target + "." : " — miss.")
        + (payload.cover && payload.cover !== "none" ? " Cover: " + payload.cover + "." : "");
    }
    if (row.kind === "turn_ended") return actor + " ended the turn.";
    return "";
  }
  function transcript(events, units) {
    var byId = names(units);
    return (events || []).map(function (row) { return eventMessage(row, byId); }).filter(Boolean);
  }

  return Object.freeze({
    VERSION: VERSION, canControl: canControl, unitPosition: unitPosition,
    prepareMove: prepareMove, prepareAttack: prepareAttack,
    eventMessage: eventMessage, transcript: transcript
  });
});
