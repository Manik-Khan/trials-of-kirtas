/* smoke-bus-reconnect — known-answer: the REAL makeSupabaseBus survives a
   dropped realtime channel. Field 2026-07-11: the channel was built once, so
   any CHANNEL_ERROR/TIMED_OUT/CLOSED left the device deaf and the fight
   crawled forward on the 12s stall watchdog. The bus must now (a) resubscribe
   on a fresh topic, (b) backfill the rows it missed while deaf, (c) narrate
   through onTransport, and (d) never storm the server on a flapping channel.
   The fake below is transport only — every function under test is the real
   forge-bus.js. */
const FB = require("../forge-bus.js");
let pass = 0, fail = 0;
function ok(n, c) { if (c) { pass++; } else { fail++; console.log("  FAIL " + n); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeFakeSb(rowsStore) {
  const channels = [];
  return {
    channels,
    channel(topic) {
      const ch = {
        topic, cbs: [], statusCb: null, removed: false,
        on(kind, filter, cb) { ch.cbs.push(cb); return ch; },
        subscribe(cb) { ch.statusCb = cb; return ch; },
        emit(row) { ch.cbs.forEach((cb) => cb({ new: row })); },
      };
      channels.push(ch);
      return ch;
    },
    removeChannel(ch) { ch.removed = true; },
    from() {
      const q = {
        _gt: 0,
        select() { return q; }, eq() { return q; },
        gt(_c, v) { q._gt = v; return q; },
        order() { return Promise.resolve({ data: rowsStore.filter((r) => r.id > q._gt), error: null }); },
      };
      return q;
    },
  };
}
const row = (id) => ({ id, unit: "gob1", actor: "dm", kind: "move_resolved", payload: {}, created_at: "2026-07-11T00:00:00Z" });

(async function () {
  const rows = [row(1)];
  const sb = makeFakeSb(rows);
  const notes = [], got = [];
  const conn = FB.makeSupabaseBus({ sb, sessionId: "s1", retryMs: 1, onTransport: (m) => notes.push(m) }).connect();
  conn.subscribe((e) => got.push(e.seq));

  console.log("\n── a healthy channel just delivers ──");
  ok("one channel opened", sb.channels.length === 1);
  sb.channels[0].statusCb("SUBSCRIBED");
  sb.channels[0].emit(row(1));
  ok("live row delivered", got.join(",") === "1");
  ok("no transport notes while healthy", notes.length === 0);

  console.log("\n── the drop: resubscribe on a fresh topic ──");
  sb.channels[0].statusCb("CHANNEL_ERROR");
  ok("dead channel removed", sb.channels[0].removed === true);
  ok("drop narrated", notes.some((m) => m.indexOf("dropped") >= 0));
  await sleep(20);
  ok("a second channel opened", sb.channels.length === 2);
  ok("fresh topic, not a reused one", sb.channels[1].topic !== sb.channels[0].topic);

  console.log("\n── the recovery: backfill what was missed while deaf ──");
  rows.push(row(2), row(3)); // landed while the device was deaf
  sb.channels[1].statusCb("SUBSCRIBED");
  await sleep(20);
  ok("missed rows backfilled in order", got.join(",") === "1,2,3");
  ok("recovery narrated", notes.some((m) => m.indexOf("restored") >= 0));

  console.log("\n── duplicates are the pipeline's job, not a crash ──");
  sb.channels[1].emit(row(3));
  ok("dup delivery passes through (pipeline dedups by seq)", got.join(",") === "1,2,3,3");

  console.log("\n── CLOSED reopens too; a flapping channel can't storm ──");
  sb.channels[1].statusCb("CLOSED");
  sb.channels[1].statusCb("CLOSED"); // second signal for the same drop
  sb.channels[1].statusCb("CHANNEL_ERROR"); // and a third
  await sleep(30);
  ok("exactly one new channel per drop", sb.channels.length === 3);
  sb.channels[2].statusCb("SUBSCRIBED");
  await sleep(20);
  ok("nothing new to backfill, nothing re-delivered", got.join(",") === "1,2,3,3");

  console.log("\n" + pass + "/" + (pass + fail) + " passed\n");
  process.exit(fail ? 1 : 0);
})();
