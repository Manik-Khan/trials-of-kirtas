/* ── forge-board.js ───────────────────────────────────────────────────
   Battle Forge event→BOARD translator (FORGE_BOARD.md §2). Pure: takes an
   event row plus the replayed state before/after it and names the board
   verbs — walk this path, set this HP, open this prompt. The renderer
   implements the verbs; this module never touches the DOM or three.js.
   Also: the claim rule's JS twin (UI greying; SQL enforces) and the
   sheet-mirror plan (absolute values — rewinds just re-set).
   Dual export: browser (window.ForgeBoard) + node.                       */
(function (root, factory) {
  var FR = (typeof require !== "undefined") ? require("./forge-replay.js") : root.ForgeReplay;
  var api = factory(FR);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeBoard = api;
})(typeof self !== "undefined" ? self : this, function (FR) {

  function controls(me, unit) { return !!me.overseer || (me.units || []).indexOf(unit) >= 0; }

  function canClaim(session, uid, unit) {
    if (!session) return { ok: false, why: "no fight" };
    if (session.status === "ended") return { ok: false, why: "fight is over" };
    var row = (session.roster || []).filter(function (r) { return r.unit === unit; })[0];
    if (!row) return { ok: false, why: "not in this fight" };
    if ((row.kind || "pc") !== "pc") return { ok: false, why: "foes are the DM's" };
    var ctl = session.controllers || {};
    var owner = Object.keys(ctl).filter(function (k) { return (ctl[k] || []).indexOf(unit) >= 0; })[0];
    if (owner && owner !== uid) return { ok: false, why: "already claimed" };
    return { ok: true };
  }

  /* diff units before→after: positions and hp. Robust to any kind. */
  function unitDiffs(before, after) {
    var verbs = [];
    Object.keys(after.units || {}).forEach(function (k) {
      var a = after.units[k], b = (before.units || {})[k];
      if (!b) { verbs.push({ t: "spawn", unit: k, u: a }); return; }
      if (a.hp !== b.hp) verbs.push({ t: "hp", unit: k, hp: a.hp, maxHp: a.maxHp, downed: a.downed, delta: a.hp - b.hp });
      if (a.pos.c !== b.pos.c || a.pos.r !== b.pos.r) verbs.push({ t: "jump", unit: k, to: { c: a.pos.c, r: a.pos.r } });
    });
    Object.keys(before.units || {}).forEach(function (k) {
      if (!(after.units || {})[k]) verbs.push({ t: "despawn", unit: k });
    });
    return verbs;
  }

  function turnVerb(before, after) {
    var was = FR.activeUnit(before), is = FR.activeUnit(after);
    if (is && is !== was) return [{ t: "turn", unit: is, round: FR.round(after) }];
    return [];
  }

  function verbsFor(row, before, after) {
    var verbs = [];
    switch (row.kind) {
      case "restore": case "override":
        return [{ t: "resync" }];
      case "session_started": case "session_ended":
        verbs.push({ t: "status", status: after.status });
        verbs = verbs.concat(turnVerb(before, after));
        break;
      case "initiative_set": case "encounter_region_activated":
        verbs.push({ t: "order", order: (after.initiative || []).slice(), active: FR.activeUnit(after) });
        verbs = verbs.concat(turnVerb(before, after));
        break;
      case "turn_ended":
        verbs = verbs.concat(turnVerb(before, after));
        break;
      case "move_resolved": {
        var mv = after.units[row.unit];
        // prefer the declared path; fall back to the path the resolve fact now
        // carries itself (bite-1 fix, 2026-07-11: a lost move_declared row used
        // to silently degrade the tween to a jump — facts are self-contained)
        var path = (row.payload && row.payload.path)
                || (before.pendingAction && before.pendingAction.unit === row.unit && before.pendingAction.path) || null;
        if (mv) verbs.push(path ? { t: "walk", unit: row.unit, path: path, to: { c: mv.pos.c, r: mv.pos.r } }
                                : { t: "jump", unit: row.unit, to: { c: mv.pos.c, r: mv.pos.r } });
        verbs = verbs.concat(unitDiffs(before, after).filter(function (v) { return !(v.t === "jump" && v.unit === row.unit); }));
        break;
      }
      case "prompt":
        verbs.push({ t: "prompt", prompt: after.pendingPrompt });
        break;
      case "prompt_answered":
        if (before.pendingPrompt && (!after.pendingPrompt || before.pendingPrompt.seq !== after.pendingPrompt.seq)) verbs.push({ t: "prompt_clear" });
        if (after.pendingPrompt && (!before.pendingPrompt || before.pendingPrompt.seq !== after.pendingPrompt.seq)) verbs.push({ t: "prompt", prompt: after.pendingPrompt });
        verbs = verbs.concat(unitDiffs(before, after));
        break;
      case "chat":
        verbs.push({ t: "chat", unit: row.unit, text: (row.payload || {}).text });
        break;
      default:   // attack_resolved, ability_used, edit, initiative_rolled, declares…
        verbs = verbs.concat(unitDiffs(before, after));
        break;
    }
    return verbs;
  }

  /* Dead-foe auto-skip (field 2026-07-11: a dead foe's turn stranded the
     fight — foeTurn() hard no-ops on !u.alive and endTurn()'s button gate
     never fires for foes, so nothing published turn_ended). Pure DECISION
     only: returns the active unit's key when the turn is seated on a downed
     FOE in a live fight, else null. Downed PCs are never skipped — death
     saves are theirs to roll. The caller (the overseer's device, gated on
     controls() + no publish in flight) publishes the narrated turn_ended;
     the reducer stays untouched, so old logs replay identically and the
     skip is an ordinary fact in the log. */
  function deadFoeSkip(state) {
    if (!state || state.status !== "active") return null;
    var k = FR.activeUnit(state);
    var u = k && (state.units || {})[k];
    if (!u || u.side === "pc" || !u.downed) return null;
    return k;
  }

  /* Stable or dead PCs no longer owe a death save. The overseer may advance
     their inert initiative seat; an unconscious PC with unresolved saves must
     keep the seat so their controller can roll. */
  function settledPcSkip(state){
    if(!state||state.status!=="active")return null;var k=FR.activeUnit(state),u=k&&state.units&&state.units[k],ds=u&&u.deathSaves;
    if(!u||u.side!=="pc"||!u.downed||!ds||(!ds.stable&&!ds.dead))return null;
    return k;
  }

  /* Sheet mirror (FORGE_BOARD.md §5): my units only, absolute hp. */
  function mirrorPlan(before, after, myUnits, rosterByUnit) {
    var out = [];
    (myUnits || []).forEach(function (u) {
      var a = (after.units || {})[u], b = (before.units || {})[u];
      var ref = rosterByUnit && rosterByUnit[u] && rosterByUnit[u].sheet_ref;
      if (a && b && ref && a.hp !== b.hp) out.push({ key: ref, vitals: { hp: a.hp } });
    });
    return out;
  }

  return { verbsFor: verbsFor, controls: controls, canClaim: canClaim, mirrorPlan: mirrorPlan, deadFoeSkip: deadFoeSkip, settledPcSkip:settledPcSkip };
});
