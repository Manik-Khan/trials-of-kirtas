/* smoke-tiers-rebase.js — the tiers field builder runs the CANONICAL generator,
   deterministically. Extracts the real buildTiersField from the mock (repo rule:
   real functions on the real field). */
const fs = require("fs"), path = require("path");
const FD = require("../forge-dungeon.js");
const MB = require("../map-bridge.js");
const FE = require("../forge-engine.js");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log("  FAIL " + name); } }

// 1. the stale inlined generator is GONE
ok("no inlined THEMES with stale keys", !/themeKey:'verdant'/.test(html) && !/'ancient'\s*:/.test(html));
ok("mock includes canonical scripts",
   /forge-dungeon\.js\?v=/.test(html) && /map-bridge\.js\?v=/.test(html) && /forge-engine\.js\?v=/.test(html));

// 2. extract the real buildTiersField (marker comments added in Step 3)
const m = html.match(/\/\*BTF-START\*\/([\s\S]*?)\/\*BTF-END\*\//);
ok("buildTiersField extractable", !!m);
if (m) {
  const T_WATER = 0, T_GRASS = 1, T_STONE = 2, T_PLAZA = 3, T_ROCK = 4;
  const documentStub = { getElementById: () => ({ textContent: "", style: {} }) };
  const fn = new Function(
    "window", "document", "ForgeDungeon", "MapBridge",
    "T_WATER", "T_GRASS", "T_STONE", "T_PLAZA", "T_ROCK", "STEP_FT", "BIOME", "flora", "mulberry32",
    m[1] + "\nreturn buildTiersField;"
  );
  const flora = () => ({ kinds: ["tree", "rock"], pal: {}, density: 1 });
  const mulberry32 = a => { a = a >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const build = fn({ ForgeEngine: FE }, documentStub, FD, MB, T_WATER, T_GRASS, T_STONE, T_PLAZA, T_ROCK, 5, "grass", flora, mulberry32);

  for (const theme of FD.THEME_KEYS) {
    const a = build(1234, { themeKey: theme }), b = build(1234, { themeKey: theme });
    ok(theme + ": deterministic height", Buffer.from(a.height.buffer).equals(Buffer.from(b.height.buffer)));
    ok(theme + ": deterministic occ",    Buffer.from(a.occ.buffer).equals(Buffer.from(b.occ.buffer)));
    ok(theme + ": deterministic props",  JSON.stringify(a.props) === JSON.stringify(b.props));
    const wf = MB.wallFeetFor(theme);
    let occOk = true;
    for (let i = 0; i < a.W * a.H; i++) if (a.type[i] === T_ROCK && a.occ[i] !== wf) { occOk = false; break; }
    ok(theme + ": rock occ == wallFeetFor(" + theme + ")=" + wf, occOk);
  }
  const c = build(99, {}), d = build(100, {});
  ok("different seeds differ", !Buffer.from(c.height.buffer).equals(Buffer.from(d.height.buffer)));
}
console.log("smoke-tiers-rebase: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
