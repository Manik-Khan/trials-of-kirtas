/* smoke-starter-kits.js — Task 16's session-mode live-stats overlay
   (liveStatsFor/kitFor/loadLiveStats) never got a persisted smoke — this
   extracts the REAL functions from the mock (repo rule: real functions on
   the real field) via SK-START/SK-END marker comments and drives them with
   a stubbed CharacterData. Also covers Finding 2: the generic kit must
   carry ac/speed/init defaults so a folder PC without a live sheet never
   resolves to an auto-hit ac of 0. */
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "topography-test-mock.html"), "utf8");

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log("  FAIL " + name); } }
function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const m = html.match(/\/\*SK-START\*\/([\s\S]*?)\/\*SK-END\*\//);
ok("liveStatsFor/kitFor/loadLiveStats extractable", !!m);

function makeSandbox(STARTER_KITS, characterData, forgeKitDerive) {
  const clog = function () {};              // narration UI — not under test here
  const escapeHtml = function (s) { return String(s); };
  const win = { CharacterData: characterData, ForgeKitDerive: forgeKitDerive };
  const fn = new Function(
    "window", "STARTER_KITS", "clog", "escapeHtml",
    m[1] + "\nreturn { loadLiveStats: loadLiveStats, liveStatsFor: liveStatsFor, " +
      "kitFor: kitFor, GENERIC_PC_KIT: GENERIC_PC_KIT, __liveStatsWarned: __liveStatsWarned, " +
      "__genericKitWarned: __genericKitWarned };"
  );
  return fn(win, STARTER_KITS, clog, escapeHtml);
}

async function main() {
  if (!m) {
    console.log("smoke-starter-kits: " + pass + " passed, " + fail + " failed");
    process.exit(1);
  }

  // shared STARTER_KITS fixture used across scenarios — snapshotted before
  // and after every sandbox run to prove liveStatsFor/kitFor never mutate it
  const STARTER_KITS = {
    cosmere: { name: "Cosmere", hp: 20, ac: 1, speed: 1, init: 1, res: {}, react: null,
      actions: [{ label: "Eldritch Blast", kind: "attack", rng: 24, hit: 5, dmg: "1d10+3" }] },
    vesperian: { name: "Vesperian", hp: 40, ac: 18, speed: 30, init: 4, res: {}, react: null,
      actions: [{ label: "Longsword", kind: "attack", rng: 1, hit: 6, dmg: "1d8+6" }] },
  };
  const before = JSON.stringify(STARTER_KITS);

  // 1. live stats overlay: party row with full structural.combat →
  //    liveStatsFor maps initiative→init and passes ac/speed through.
  {
    const party = [{ key: "cosmere", structural: { combat: { ac: 18, speed: 30, initiative: 2 } } }];
    const sb = makeSandbox(STARTER_KITS, { loadParty: () => Promise.resolve(party) });
    await sb.loadLiveStats();
    const stats = sb.liveStatsFor("cosmere");
    ok("liveStatsFor: full live sheet → {ac,speed,init}", deepEq(stats, { ac: 18, speed: 30, init: 2 }));
    ok("liveStatsFor: full live sheet never warns", sb.__liveStatsWarned.cosmere !== true);
  }

  // 2. missing character → null/fallback + the once-per-boot warn flag set
  //    (assert the flag itself, not console output).
  {
    const sb = makeSandbox(STARTER_KITS, { loadParty: () => Promise.resolve([]) });
    await sb.loadLiveStats();
    const stats1 = sb.liveStatsFor("cosmere");
    ok("liveStatsFor: missing character → null", stats1 === null);
    ok("liveStatsFor: missing character sets warn flag once", sb.__liveStatsWarned.cosmere === true);
    const stats2 = sb.liveStatsFor("cosmere");
    ok("liveStatsFor: missing character stays null on repeat call", stats2 === null);
    ok("liveStatsFor: warn flag stays set (still once)", sb.__liveStatsWarned.cosmere === true);
  }

  // 3. kitFor known key, NO derive layer loaded → the exact STARTER_KITS
  //    entry (same reference) — the raw fallback survives a missing module.
  {
    const sb = makeSandbox(STARTER_KITS, { loadParty: () => Promise.resolve([]) });
    await sb.loadLiveStats();
    const kit = sb.kitFor("vesperian");
    ok("kitFor: known key (no derive layer) returns STARTER_KITS entry", kit === STARTER_KITS.vesperian);
  }

  // 3b. Round-3 §E1: with ForgeKitDerive present, the starter branch WRAPS —
  //     tabs always exist, so the forge bar never renders empty on a raw kit.
  {
    const FKD = require("../forge-kit-derive.js");
    const sb = makeSandbox(STARTER_KITS, { loadParty: () => Promise.resolve([]) }, FKD);
    await sb.loadLiveStats();
    const kit = sb.kitFor("vesperian");
    ok("kitFor: starter branch wraps via wrapStarterKit", !!kit && kit.fallback === "starter");
    ok("kitFor: wrapped starter kit carries tabs", !!kit && !!kit.tabs && Array.isArray(kit.tabs.attacks));
    ok("kitFor: wrapped starter kit keeps the hand-tuned actions", !!kit && kit.actions.length === STARTER_KITS.vesperian.actions.length);
    ok("kitFor: wrapping never mutates the raw kit", STARTER_KITS.vesperian.tabs === undefined);
  }

  // 4. kitFor unknown key (sheet exists, no STARTER_KITS entry) → generic kit.
  //    Finding 2: generic kit must carry ac/speed/init defaults.
  {
    const party = [{ key: "wanderer", name: "Wanderer", structural: { combat: {} } }];
    const sb = makeSandbox(STARTER_KITS, { loadParty: () => Promise.resolve(party) });
    await sb.loadLiveStats();
    const kit = sb.kitFor("wanderer");
    ok("kitFor: unknown-key generic kit has actions.length>=1", !!kit && kit.actions.length >= 1);
    ok("kitFor: unknown-key generic kit has react===null", !!kit && kit.react === null);
    ok("kitFor: unknown-key generic kit has ac (Finding 2)", !!kit && kit.ac !== undefined && kit.ac !== 0);
    ok("kitFor: unknown-key generic kit has speed (Finding 2)", !!kit && kit.speed !== undefined);
    ok("kitFor: unknown-key generic kit has init (Finding 2)", !!kit && kit.init !== undefined);
    ok("kitFor: GENERIC_PC_KIT itself carries ac:10/speed:30/init:0",
      sb.GENERIC_PC_KIT.ac === 10 && sb.GENERIC_PC_KIT.speed === 30 && sb.GENERIC_PC_KIT.init === 0);
  }

  // 5. kitFor unknown key with no sheet at all → null (unchanged pre-Task-16 behavior).
  {
    const sb = makeSandbox(STARTER_KITS, { loadParty: () => Promise.resolve([]) });
    await sb.loadLiveStats();
    const kit = sb.kitFor("ghost");
    ok("kitFor: no-sheet no-kit key → null", kit === null);
  }

  // 6. kitFor/liveStatsFor never mutate STARTER_KITS across every scenario above.
  const after = JSON.stringify(STARTER_KITS);
  ok("STARTER_KITS never mutated by liveStatsFor/kitFor", before === after);

  console.log("smoke-starter-kits: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
}

main();
