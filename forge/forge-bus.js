/* ── forge-bus.js ─────────────────────────────────────────────────────
   Battle Forge TRANSPORT (FORGE_PROTOCOL.md §1/§7). The pipeline talks to
   a bus; Supabase in production (Task 9 adds makeSupabaseBus), an
   in-memory fake here for headless smokes. The memory bus MIRRORS the SQL
   identity gate: live session AND (overseer OR you control the unit).
   Keep the gate logic in step with schema_delta_forge.sql.
   Dual export: browser (window.ForgeBus) + node.                          */
(function (root, factory) {
  var FP = (typeof require !== "undefined") ? require("./forge-protocol.js") : root.ForgeProtocol;
  var api = factory(FP);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeBus = api;
})(typeof self !== "undefined" ? self : this, function (FP) {

  function makeMemoryBus(opts) {
    opts = opts || {};
    var controllers = opts.controllers || {};
    var overseer = opts.overseer || null;
    var status = opts.status || "active";
    var now = opts.now || function () { return Date.now(); };
    var log = [], subs = [], nextSeq = 1;
    var queue = [], delivering = false;
    function deliver(row) {
      queue.push(row);
      if (delivering) return;           // a nested publish just enqueues; the outer drain keeps order
      delivering = true;
      while (queue.length) {
        var r = queue.shift();
        subs.forEach(function (fn) { fn(JSON.parse(JSON.stringify(r))); });
      }
      delivering = false;
    }

    /* mirror of the RLS insert policy in schema_delta_forge.sql */
    function gate(actor, ev) {
      if (status !== "active") return "session not active (write by " + actor + " for " + ev.unit + ")";
      if (actor === overseer) return null;
      if (FP.OVERSEER_ONLY[ev.kind]) return "overseer-only kind: " + ev.kind + " (write by " + actor + ")";
      var mine = controllers[actor] || [];
      if (mine.indexOf(ev.unit) < 0) return "identity gate: " + actor + " does not control " + ev.unit;
      return null;
    }

    return {
      setStatus: function (s) { status = s; },
      connect: function (actor) {
        return {
          actor: actor,
          publish: function (ev) {
            var v = FP.validateEvent(ev);
            if (!v.ok) return { ok: false, why: v.why };
            var why = gate(actor, ev);
            if (why) return { ok: false, why: why };
            var row = { seq: nextSeq++, unit: ev.unit, actor: actor, kind: ev.kind,
                        payload: JSON.parse(JSON.stringify(ev.payload || {})), created_at: now() };
            log.push(row);
            deliver(row);
            return { ok: true, seq: row.seq };
          },
          subscribe: function (fn) { subs.push(fn); },
          fetchAll: function () { return log.map(function (r) { return JSON.parse(JSON.stringify(r)); }); }
        };
      }
    };
  }

  /* Production transport. Same conn contract as the memory bus; the §1 RLS
     policies are the gate. deps: {sb: Supabase client, sessionId: uuid}    */
  function makeSupabaseBus(deps) {
    var sb = deps.sb, sid = deps.sessionId;
    return {
      connect: function () {
        return {
          publish: function (ev) {
            var v = FP.validateEvent(ev);
            if (!v.ok) return Promise.resolve({ ok: false, why: v.why });
            return sb.from("forge_events")
              .insert({ session_id: sid, unit: ev.unit, kind: ev.kind, payload: ev.payload || {} })
              .select("id").single()
              .then(function (res) {
                if (res.error) return { ok: false, why: res.error.message };
                return { ok: true, seq: res.data.id };
              });
          },
          subscribe: function (fn) {
            sb.channel("forge:" + sid)
              .on("postgres_changes",
                { event: "INSERT", schema: "public", table: "forge_events",
                  filter: "session_id=eq." + sid },
                function (msg) {
                  var r = msg.new;
                  fn({ seq: r.id, unit: r.unit, actor: r.actor, kind: r.kind,
                       payload: r.payload, created_at: Date.parse(r.created_at) });
                })
              .subscribe(function (status) {
                if (status !== "SUBSCRIBED" && typeof console !== "undefined")
                  console.warn("[forge-bus] realtime channel status: " + status);
              });
          },
          fetchAll: function () {
            return sb.from("forge_events").select("*")
              .eq("session_id", sid).order("id", { ascending: true })
              .then(function (res) {
                if (res.error) { console.warn("[forge-bus] fetchAll:", res.error.message); return []; }
                return res.data.map(function (r) {
                  return { seq: r.id, unit: r.unit, actor: r.actor, kind: r.kind,
                           payload: r.payload, created_at: Date.parse(r.created_at) };
                });
              });
          }
        };
      }
    };
  }

  return { makeMemoryBus: makeMemoryBus, makeSupabaseBus: makeSupabaseBus };
});
