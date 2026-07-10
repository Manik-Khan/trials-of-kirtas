/* ── forge-protocol.js ────────────────────────────────────────────────
   Battle Forge event VOCABULARY (FORGE_PROTOCOL.md §2). Every event is a
   fact said at the table; state is derived by replaying them in order.
   17 kinds. No turn_started — turn start is derived (spec §2).
   Dual export: browser (window.ForgeProtocol) + node.                    */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeProtocol = api;
})(typeof self !== "undefined" ? self : this, function () {

  var KINDS = [
    "session_started", "initiative_rolled", "initiative_set", "turn_ended",
    "move_declared", "move_resolved", "attack_declared", "attack_resolved",
    "ability_used", "prompt", "prompt_answered", "reaction_declared", "chat",
    "override", "restore", "edit", "session_ended"
  ];

  /* enforced by the bus/RLS identity gate, listed here for UI greying */
  var OVERSEER_ONLY = {
    session_started: 1, initiative_set: 1, session_ended: 1,
    override: 1, restore: 1, edit: 1
  };

  /* required payload fields per kind — presence checks on facts, not rules */
  var REQ = {
    initiative_rolled: ["roll"], initiative_set: ["order"],
    move_declared: ["path"], move_resolved: ["final_cell"],
    attack_declared: ["target", "roll"], attack_resolved: ["hit"],
    ability_used: ["ability", "targets"],
    prompt: ["to", "react", "timeout"], prompt_answered: ["prompt_seq", "use"],
    reaction_declared: ["react", "trigger_seq"],
    chat: ["text"], override: ["corrects_seq", "correction"],
    restore: ["to_seq", "snapshot"], edit: ["changes"]
  };

  function makeEvent(unit, kind, payload) {
    return { unit: unit, kind: kind, payload: payload || {} };
  }

  function validateEvent(ev) {
    if (!ev || typeof ev !== "object") return { ok: false, why: "not an object" };
    if (KINDS.indexOf(ev.kind) < 0) return { ok: false, why: "unknown kind: " + ev.kind };
    if (typeof ev.unit !== "string" || !ev.unit) return { ok: false, why: "missing unit" };
    var req = REQ[ev.kind] || [];
    for (var i = 0; i < req.length; i++)
      if (ev.payload == null || ev.payload[req[i]] === undefined)
        return { ok: false, why: ev.kind + " missing payload." + req[i] };
    return { ok: true };
  }

  return { KINDS: KINDS, OVERSEER_ONLY: OVERSEER_ONLY, makeEvent: makeEvent, validateEvent: validateEvent };
});
