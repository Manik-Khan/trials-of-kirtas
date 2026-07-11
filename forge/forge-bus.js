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
            /* Field 2026-07-11: this channel was built once — any drop
               (CHANNEL_ERROR / TIMED_OUT / CLOSED: laptop sleep, a throttled
               background tab, a network blip) left the device deaf behind one
               console.warn, and every echo after it read as "lost". The
               app-level stall watchdog then crawled the fight forward in
               12-second resync steps — the field's "desynced and looping"
               foe turn. The transport now owns its own recovery: resubscribe
               on a FRESH topic (supabase-js keeps per-topic state) with
               capped backoff, then backfill every row this device missed
               while deaf. Rows may arrive twice around a reconnect — the
               pipeline dedups by seq (forge-pipeline catchUp/`seen`), per
               contract. deps.onTransport (optional) narrates drops/recovery
               to the surface; retryMs (optional) exists for the smoke. */
            var retryMs = deps.retryMs || 500;
            var hi = 0, gen = 0, failCount = 0, reopening = false;
            function note(msg) {
              if (typeof console !== "undefined") console.warn("[forge-bus] " + msg);
              if (deps.onTransport) { try { deps.onTransport(msg); } catch (e) {} }
            }
            function deliver(r) {
              if (r.id > hi) hi = r.id;
              fn({ seq: r.id, unit: r.unit, actor: r.actor, kind: r.kind,
                   payload: r.payload, created_at: Date.parse(r.created_at) });
            }
            function backfill() {
              sb.from("forge_events").select("*")
                .eq("session_id", sid).gt("id", hi).order("id", { ascending: true })
                .then(function (res) {
                  if (res.error) { note("catch-up read failed: " + res.error.message); return; }
                  res.data.forEach(deliver);
                });
            }
            function open() {
              gen++;
              var ch = sb.channel("forge:" + sid + ":" + gen);
              ch.on("postgres_changes",
                  { event: "INSERT", schema: "public", table: "forge_events",
                    filter: "session_id=eq." + sid },
                  function (msg) { deliver(msg.new); })
                .subscribe(function (status) {
                  if (status === "SUBSCRIBED") {
                    failCount = 0;
                    if (gen > 1) { note("connection restored — catching up on missed events."); backfill(); }
                    return;
                  }
                  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
                    if (reopening) return;   // one reopen per drop — a flapping channel must not storm
                    reopening = true;
                    failCount++;
                    note("connection dropped (" + status + ") — reconnecting…");
                    try { sb.removeChannel(ch); } catch (e) {}
                    setTimeout(function () { reopening = false; open(); },
                      Math.min(15000, retryMs * Math.pow(2, Math.min(failCount, 5))));
                  }
                });
            }
            open();
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
