/* ── forge-pipeline.js ────────────────────────────────────────────────
   Battle Forge acting-client PIPELINE (FORGE_PROTOCOL.md §3–§6). Wraps a
   bus connection: keeps a live replayed state, publishes this client's
   actions as declared → resolved pairs, asks reaction prompts mid-action
   and waits for the answers (exactly one asker per prompt — the device
   already mid-pipeline). Rules stay with the caller: resolveFacts()
   computes resolutions; deps.reactions() names candidates. This module
   ferries facts. Dual export: browser (window.ForgePipeline) + node.      */
(function (root, factory) {
  var FP = (typeof require !== "undefined") ? require("./forge-protocol.js") : root.ForgeProtocol;
  var FR = (typeof require !== "undefined") ? require("./forge-replay.js") : root.ForgeReplay;
  var api = factory(FP, FR);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgePipeline = api;
})(typeof self !== "undefined" ? self : this, function (FP, FR) {

  function makePipeline(deps) {
    var conn = deps.conn, roster = deps.roster;
    var now = deps.now || function () { return Date.now(); };
    var reactions = deps.reactions || function () { return []; };
    var events = [];
    var state = FR.initialState(roster);
    var awaiting = null;   // {promptSeq, resolve} — this client asked and is paused
    var answeredEarly = {};   // prompt_seq -> answer row that arrived before we learned our own prompt's seq

    function controlsUnit(u) { return !!deps.me.overseer || deps.me.units.indexOf(u) >= 0; }

    function rebuild() { state = FR.replayLog(roster, events); }

    function ingest(row) {
      for (var k = events.length - 1; k >= 0; k--) {
        if (events[k].seq === row.seq) return;          // realtime redelivery / fetch overlap
        if (events[k].seq < row.seq) break;             // events is seq-ascending; early out
      }
      events.push(row);
      if (row.kind === "override" || row.kind === "restore") rebuild();  // corrections rewrite the past
      else FR.applyEvent(state, row, null);
      if (row.kind === "prompt" && controlsUnit(row.payload.to) && deps.onPrompt) deps.onPrompt(row);
      if (row.kind === "prompt_answered" && awaiting) {
        if (row.payload.prompt_seq === awaiting.promptSeq) {
          var done = awaiting; awaiting = null; done.resolve(row);
        } else if (awaiting.promptSeq === null) {
          answeredEarly[row.payload.prompt_seq] = row;   // answer beat our own publish echo — hold it
        }
      }
      if (deps.onEvent) deps.onEvent(row, state);
    }
    conn.subscribe(ingest);

    function publish(unit, kind, payload) {
      var ev = FP.makeEvent(unit, kind, payload);
      var v = FP.validateEvent(ev);
      if (!v.ok) return Promise.resolve({ ok: false, why: v.why });
      return Promise.resolve(conn.publish(ev));
    }

    /* ask each candidate one at a time, in order (spec §4: chained prompts).
       The awaiting token is claimed BEFORE the prompt publishes, so an
       instant answer on a synchronous bus cannot slip past the pause. */
    function ask(unit, cand) {
      return new Promise(function (resolve) {
        var token = { promptSeq: null, resolve: resolve };
        awaiting = token;
        publish(unit, "prompt", { to: cand.to, react: cand.react,
          context: cand.context || {}, timeout: 20 })
          .then(function (r) {
            if (!r.ok) { awaiting = null; resolve(null); return; }
            token.promptSeq = r.seq;
            var early = answeredEarly[r.seq];
            if (early && awaiting === token) {
              delete answeredEarly[r.seq];
              awaiting = null;
              resolve(early);
            }
          });
      });
    }
    function askAll(unit, declaredRow) {
      var answers = [], asked = {};
      function next() {
        var cands = reactions(state, declaredRow, answers) || [];
        var c = null;
        for (var i = 0; i < cands.length; i++) {   // never re-ask the same (to, react):
          var key = cands[i].to + "|" + cands[i].react;   // a declined prompt must not loop
          if (!asked[key]) { c = cands[i]; asked[key] = true; break; }
        }
        if (!c) return Promise.resolve(answers);
        return ask(unit, c).then(function (a) { answers.push(a); return next(); });
      }
      return next();
    }

    function act(unit, declareKind, declarePayload, resolveKind, resolveFacts) {
      return publish(unit, declareKind, declarePayload).then(function (r) {
        if (!r.ok) return r;
        var declaredRow = { seq: r.seq, unit: unit, kind: declareKind, payload: declarePayload };
        return askAll(unit, declaredRow).then(function (answers) {
          return publish(unit, resolveKind, resolveFacts(answers));
        });
      });
    }

    return {
      state: function () { return state; },
      events: function () { return events.slice(); },
      activeUnit: function () { return FR.activeUnit(state); },
      stateAt: function (seq) {
        return FR.replayLog(roster, events.filter(function (e) { return e.seq <= seq; }));
      },
      catchUp: function () {
        return Promise.resolve(conn.fetchAll()).then(function (all) {
          var seen = {};
          events.forEach(function (e) { seen[e.seq] = true; });
          all.forEach(function (e) { if (!seen[e.seq]) events.push(e); });
          events.sort(function (a, b) { return a.seq - b.seq; });
          rebuild(); return state;
        });
      },

      move: function (unit, path, resolveFacts) {
        return act(unit, "move_declared", { path: path }, "move_resolved", resolveFacts);
      },
      attack: function (unit, facts, resolveFacts) {
        // resolutions are self-contained facts: carry the declared target so
        // replay never depends on the shared pendingAction slot
        return act(unit, "attack_declared", facts, "attack_resolved", function (answers) {
          return Object.assign({ target: facts.target }, resolveFacts(answers));
        });
      },
      useAbility: function (unit, facts) { return publish(unit, "ability_used", facts); },
      rollInitiative: function (unit, roll) { return publish(unit, "initiative_rolled", { roll: roll }); },
      endTurn: function (unit) { return publish(unit, "turn_ended", {}); },
      chat: function (unit, text) { return publish(unit, "chat", { text: text }); },
      answerPrompt: function (unit, promptSeq, use, extra) {
        return publish(unit, "prompt_answered",
          Object.assign({ prompt_seq: promptSeq, use: !!use }, extra || {}));
      },

      /* overseer tools — the bus identity gate is the enforcement */
      start: function () { return publish("__session", "session_started", {}); },
      setInitiative: function (order) { return publish("__session", "initiative_set", { order: order }); },
      override: function (seq, correction) {
        return publish("__session", "override", { corrects_seq: seq, correction: correction });
      },
      restoreTo: function (toSeq) {
        var snap = FR.replayLog(roster, events.filter(function (e) { return e.seq <= toSeq; }));
        return publish("__session", "restore", { to_seq: toSeq, snapshot: FR.snapshot(snap) });
      },
      edit: function (changes) { return publish("__session", "edit", { changes: changes }); },
      end: function () { return publish("__session", "session_ended", {}); },

      /* timeout watch — the overseer device calls this on a UI tick; a stale
         prompt re-targets to the overseer's screen (spec §4.5) */
      checkTimeouts: function () {
        var p = state.pendingPrompt;
        if (p && deps.me.overseer && p.created_at != null &&
            now() - p.created_at > p.timeout * 1000) {
          if (deps.onPromptFallback) deps.onPromptFallback(p);
          return p;
        }
        return null;
      }
    };
  }

  return { makePipeline: makePipeline };
});
