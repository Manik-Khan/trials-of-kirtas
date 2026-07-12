/* ── forge-replay.js ──────────────────────────────────────────────────
   Battle Forge REDUCER (FORGE_PROTOCOL.md). State is never stored — it is
   derived by replaying the event log top to bottom. This module applies
   FACTS; it never re-runs rules (rules live in tactics-geometry and the
   acting client). Turn start is DERIVED: initiative_set order + count of
   turn_ended (spec §2 — an explicit turn_started would break the identity
   gate). Dual export: browser (window.ForgeReplay) + node.                */
(function (root, factory) {
  var FP = (typeof require !== "undefined") ? require("./forge-protocol.js") : root.ForgeProtocol;
  var api = factory(FP);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeReplay = api;
})(typeof self !== "undefined" ? self : this, function (FP) {

  function initialState(roster) {
    var units = {};
    (roster || []).forEach(function (u) {
      units[u.unit] = {
        side: u.side, pos: { c: u.pos.c, r: u.pos.r },
        hp: u.hp, maxHp: (u.maxHp != null ? u.maxHp : u.hp),
        conditions: [], reacts: (u.reacts || []).slice(),
        reactionUsed: false, downed: false, advGrant: null
      };
    });
    return {
      status: "staging", units: units, rolls: {}, initiative: null,
      turnsEnded: 0, pendingAction: null, pendingPrompt: null,
      chat: [], lastSeq: 0,
      economy: { unit: null, movedFt: 0, usedAction: false, usedBonus: false, attacked: false }
    };
  }

  function activeUnit(state) {
    if (!state.initiative || state.status !== "active") return null;
    return state.initiative[state.turnsEnded % state.initiative.length];
  }

  /* Action economy is a DERIVED FACT of the log (never bookkept locally). It is
     reset for whoever is active now and rebuilt by replaying the turn's facts.
     Facts only, no rules: movement is path length ×5, action/bonus come off the
     publisher's `slot` (default "action" for legacy rows), a `restores:"action"`
     ability (Action Surge) refunds the action. */
  function resetEconomy(state) {
    state.economy = { unit: activeUnit(state), movedFt: 0, usedAction: false, usedBonus: false, attacked: false };
  }
  function spendSlot(state, unit, p, isAttack) {
    if (!state.economy || unit !== state.economy.unit) return;
    if (p.restores === "action") { state.economy.usedAction = false; return; }
    var slot = p.slot || "action";
    if (slot === "bonus") { state.economy.usedBonus = true; }
    else if (slot === "free") { /* no economy cost */ }
    else { state.economy.usedAction = true; if (isAttack) state.economy.attacked = true; }
  }
  function turnEconomy(state) {
    var e = state.economy || { unit: null, movedFt: 0, usedAction: false, usedBonus: false, attacked: false };
    return { unit: e.unit, movedFt: e.movedFt, usedAction: e.usedAction,
             usedBonus: e.usedBonus, attacked: e.attacked };
  }
  function round(state) {
    if (!state.initiative) return 0;
    return Math.floor(state.turnsEnded / state.initiative.length) + 1;
  }

  function applyDamage(u, dmg) { u.hp = Math.max(0, u.hp - dmg); u.downed = (u.hp === 0); }
  function applyEffects(state, effects) {
    (effects || []).forEach(function (e) {
      var u = state.units[e.unit]; if (!u) return;
      if (e.dmg) applyDamage(u, e.dmg);
      if (e.heal) { u.hp = Math.min(u.maxHp, u.hp + e.heal); if (u.hp > 0) u.downed = false; }
      if (e.add_condition && u.conditions.indexOf(e.add_condition) < 0) u.conditions.push(e.add_condition);
      if (e.remove_condition) u.conditions = u.conditions.filter(function (c) { return c !== e.remove_condition; });
      // advantage-on-next-attack grant (Silvery Barbs rider now; Help/familiars
      // later). A fact, not a roll — replays identically. `advGrant.reason` is
      // display only. Consumed when the unit's own attack resolves (below).
      if (e.grant_advantage) u.advGrant = { reason: e.grant_reason || "granted" };
    });
  }

  /* An attacker spends any standing advantage grant the moment it attacks — the
     grant is "next attack," so a resolved attack clears the flag on the actor. */
  function consumeAdvGrant(state, unitKey) {
    var u = state.units[unitKey];
    if (u) u.advGrant = null;
  }

  /* applyEvent mutates state. `corrections` maps seq → corrected payload
     (pre-scanned overrides — Task 4). Unknown kinds are ignored, narrated. */
  function applyEvent(state, row, corrections) {
    var p = row.payload || {};
    if (corrections && corrections[row.seq]) p = Object.assign({}, p, corrections[row.seq]);
    switch (row.kind) {
      case "session_started": state.status = "active"; resetEconomy(state); break;
      case "initiative_rolled": state.rolls[row.unit] = p.roll; break;
      case "initiative_set": {
        var prevRound = round(state);   // BEFORE overwriting order/turnsEnded
        state.initiative = p.order.slice();
        if (p.resume_at != null && state.initiative.indexOf(p.resume_at) >= 0) {
          // mid-fight re-order (FORGE_BOARD.md §6 reinforcements): resume at the
          // named unit in the current round — a new goblin must not restart the round
          state.turnsEnded = (Math.max(1, prevRound) - 1) * state.initiative.length
                           + state.initiative.indexOf(p.resume_at);
        } else {
          if (p.resume_at != null) console.warn("[forge-replay] resume_at not in order — restarting round: " + p.resume_at);
          state.turnsEnded = 0;
        }
        Object.keys(state.units).forEach(function (k) { state.units[k].reactionUsed = false; });
        resetEconomy(state);   // a re-order re-seats the active unit; fresh economy
        break;
      }
      case "turn_ended": {
        state.turnsEnded++;
        var next = activeUnit(state);   // reaction refreshes at the start of your turn
        if (next && state.units[next]) state.units[next].reactionUsed = false;
        state.pendingAction = null;
        resetEconomy(state);   // the next unit begins with a full turn's economy
        break;
      }
      case "session_ended": state.status = "ended"; break;
      case "move_declared":
        state.pendingAction = { kind: "move", unit: row.unit, path: p.path, seq: row.seq };
        break;
      case "move_resolved": {
        var mv = state.units[row.unit];
        var stop = p.interrupted_at || p.final_cell;
        if (mv && stop) mv.pos = { c: stop.c, r: stop.r };
        if (p.undo_of != null) {
          // a player's own Undo-move (Priority 3): a self-published compensating
          // move_resolved that returns the unit to its pre-move cell (final_cell)
          // and REFUNDS the undone move's distance from the economy (undo_ft is
          // a carried fact — replay stays pure, no lookup, old logs stay valid).
          if (state.economy && row.unit === state.economy.unit && p.undo_ft)
            state.economy.movedFt = Math.max(0, state.economy.movedFt - p.undo_ft);
        } else {
          // economy: movement is a derived fact — sum the declared path length ×5
          // for the active unit (path from the matching move_declared, else payload).
          var mpath = (state.pendingAction && state.pendingAction.kind === "move" &&
                       state.pendingAction.unit === row.unit) ? state.pendingAction.path : p.path;
          if (state.economy && row.unit === state.economy.unit && mpath)
            state.economy.movedFt += mpath.length * 5;
        }
        state.pendingAction = null;
        break;
      }
      case "attack_declared":
        state.pendingAction = { kind: "attack", unit: row.unit, target: p.target, roll: p.roll, seq: row.seq };
        break;
      case "attack_resolved": {
        var tgt = p.target || (state.pendingAction && state.pendingAction.target);
        if (p.hit && tgt && state.units[tgt]) applyDamage(state.units[tgt], p.dmg || 0);
        consumeAdvGrant(state, row.unit);   // "next attack" grant is spent by attacking
        applyEffects(state, p.effects);
        spendSlot(state, row.unit, p, true);   // an attack spends its slot (default action)
        state.pendingAction = null;
        break;
      }
      case "ability_used":
        applyEffects(state, p.effects);
        spendSlot(state, row.unit, p, false);   // action / bonus / free per payload.slot
        break;
      case "prompt":
        state.pendingPrompt = {
          seq: row.seq, asker: row.unit, to: p.to, react: p.react,
          timeout: p.timeout, context: p.context || null, created_at: row.created_at
        };
        break;
      case "prompt_answered": {
        var pp = state.pendingPrompt;
        if (!pp || pp.seq !== p.prompt_seq || pp.to !== row.unit) break;   // stale/duplicate/foreign answer: inert
        if (p.use && state.units[row.unit]) state.units[row.unit].reactionUsed = true;
        applyEffects(state, p.effects);
        state.pendingPrompt = null;
        break;
      }
      case "reaction_declared":
        if (state.units[row.unit]) state.units[row.unit].reactionUsed = true;
        applyEffects(state, p.effects);
        break;
      case "chat":
        state.chat.push({ unit: row.unit, text: p.text, seq: row.seq });
        break;
      case "override": break;   // consumed by replayLog's pre-scan, not at position
      case "restore": {
        var snap = JSON.parse(JSON.stringify(p.snapshot));
        Object.keys(state).forEach(function (k) { delete state[k]; });
        Object.assign(state, snap);
        break;
      }
      case "edit":
        (p.changes || []).forEach(function (ch) {
          if (ch.add_unit) {
            var au = ch.add_unit;
            if (!au.unit || !au.pos || au.hp == null || state.units[au.unit]) {
              console.warn("[forge-replay] add_unit ignored: " +
                (au.unit && state.units[au.unit] ? "duplicate unit " + au.unit : "missing unit/pos/hp"));
              return;
            }
            state.units[au.unit] = {
              side: au.side || "foe", pos: { c: au.pos.c, r: au.pos.r },
              hp: au.hp, maxHp: (au.maxHp != null ? au.maxHp : au.hp),
              conditions: [], reacts: (au.reacts || []).slice(),
              reactionUsed: false, downed: false, advGrant: null,
              name: au.name || au.unit, statblock: au.statblock || null
            };
            return;
          }
          var t = state.units[ch.unit]; if (!t) return;
          if (ch.pos) t.pos = { c: ch.pos.c, r: ch.pos.r };
          if (ch.hp != null) { t.hp = Math.max(0, Math.min(t.maxHp, ch.hp)); t.downed = (t.hp === 0); }
          if (ch.conditions) t.conditions = ch.conditions.slice();
        });
        break;
      default:
        if (FP.KINDS.indexOf(row.kind) < 0)
          console.warn("[forge-replay] unknown kind ignored: " + row.kind);
        break;                          // remaining kinds land in Tasks 3–4
    }
    state.lastSeq = row.seq;
    return state;
  }

  /* Pre-scan overrides (seq → correction), then replay in order. A restore
     resets state to its snapshot mid-replay — the dead branch is applied and
     then erased, one replay path (spec §5). */
  function replayLog(roster, rows) {
    var corrections = {};
    rows.forEach(function (row) {
      if (row.kind === "override") corrections[row.payload.corrects_seq] = row.payload.correction;
    });
    var state = initialState(roster);
    rows.forEach(function (row) { applyEvent(state, row, corrections); });
    return state;
  }

  function snapshot(state) { return JSON.parse(JSON.stringify(state)); }

  return {
    initialState: initialState, activeUnit: activeUnit, round: round,
    applyEvent: applyEvent, replayLog: replayLog, snapshot: snapshot,
    turnEconomy: turnEconomy
  };
});
