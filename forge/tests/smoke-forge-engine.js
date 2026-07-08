/* Proves the Battle Forge engine end-to-end (CommonJS so the engine's own
   require() chain resolves). Run: node smoke-forge-engine.js */
const Engine = require("../forge-engine.js");
const MB = require("../map-bridge.js");
const Geo = require("../tactics-geometry.js");

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? "\u2713 " : "\u2717 ") + n); };
const idx = (cols, c, r) => r * cols + c;

// ── RELIABILITY: every seed yields a valid, spawnable, reachable map ──
let good = 0, threw = 0;
for (let s = 1; s <= 50; s++) {
  try {
    const m = Engine.generate({ seed: s });
    const okMap = MB.validate(m).ok
      && m.spawns.some(x => x.side === "pc") && m.spawns.some(x => x.side === "foe")
      && m.spawns.every(x => !m.wall[idx(m.cols, x.c, x.r)]);
    if (okMap) good++;
  } catch (e) { threw++; }
}
ok("50 seeds each produce a valid, spawnable map (none thrown)", good === 50 && threw === 0);

const map = Engine.generate({ seed: 7, party: 4, foes: 5 });
ok("map carries the bridge contract", typeof map.cols === "number" && map.h.length === map.cols * map.rows);
ok("PC and foe spawns are placed", map.spawns.filter(s => s.side === "pc").length >= 1 &&
   map.spawns.filter(s => s.side === "foe").length >= 1);
ok("no spawn lands on a wall", map.spawns.every(s => !map.wall[idx(map.cols, s.c, s.r)]));

// PC↔foe mutual reachability (the engine's own gate, re-checked here)
const pc0 = map.spawns.find(s => s.side === "pc");
const reach = Engine._internals.bfsReach(map, { c: pc0.c, r: pc0.r });
ok("every spawn is mutually reachable from a PC start", map.spawns.every(s => reach.has(s.c + "," + s.r)));

// ── COMPLETION: heights come baked in (tiered) or off (flat) ──
const tiered = Engine.generate({ seed: 7, heightMode: "tiered" });
ok("tiered mode bakes in real elevation", tiered.h.some(v => v > 0));
const flat = Engine.generate({ seed: 7, heightMode: "flat" });
ok("flat mode is level ground", flat.h.every(v => v === 0));
const tall = Engine.generate({ seed: 7, heightMode: "tiered", verticality: 10 });
ok("verticality scales the elevation", Math.max(...tall.h) >= Math.max(...tiered.h));

// ── CONTROL: DM params take effect ──
ok("biome is honoured", Engine.generate({ seed: 7, themeKey: "frost" }).meta.biome === "frost");
const big = Engine.generate({ seed: 7, roomCount: 14 });
const small = Engine.generate({ seed: 7, roomCount: 5 });
ok("room count changes the map", big.cols * big.rows !== small.cols * small.rows || big.spawns.length !== small.spawns.length);
ok("same seed + params is deterministic",
   JSON.stringify(Engine.generate({ seed: 7 }).spawns) === JSON.stringify(Engine.generate({ seed: 7 }).spawns));

// ── the payoff: a generated map drives the real combat engine ──
const token = { c: pc0.c, r: pc0.r, speed: 30 };
ok("a party token can actually move on the generated map", Object.keys(Geo.movementReach(map, token)).length > 0);
const foe0 = map.spawns.find(s => s.side === "foe");
const v = Geo.losVerdict(map, { c: pc0.c, r: pc0.r }, { c: foe0.c, r: foe0.r });
ok("line-of-sight resolves between real spawns", v && typeof v.canTarget === "boolean");
ok("generated elevation registers as terrain the rules read",
   typeof Geo.heightAt(map, foe0.c, foe0.r) === "number");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
