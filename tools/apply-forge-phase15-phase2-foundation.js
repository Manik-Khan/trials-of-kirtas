#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repo = path.resolve(process.argv[2] || process.cwd());
const bundleRoot = path.resolve(__dirname, "..");
const plan = new Map();

function fail(message) {
  console.error("\nABORT:", message);
  process.exit(1);
}
function read(rel) {
  const abs = path.join(repo, rel);
  if (!fs.existsSync(abs)) fail("missing repository file: " + rel);
  return fs.readFileSync(abs, "utf8");
}
function replaceOnce(text, needle, replacement, label) {
  const first = text.indexOf(needle);
  if (first < 0) fail(label + ": anchor not found (the live file has drifted)");
  if (text.indexOf(needle, first + needle.length) >= 0) fail(label + ": anchor appears more than once");
  return text.slice(0, first) + replacement + text.slice(first + needle.length);
}
function replaceRegexOnce(text, regex, replacement, label) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  const re = new RegExp(regex.source, flags);
  const matches = Array.from(text.matchAll(re));
  if (matches.length !== 1) fail(label + ": expected one match, found " + matches.length);
  return text.replace(regex, replacement);
}
function schedule(rel, content) {
  plan.set(rel, content);
}
function scheduleNew(rel) {
  const src = path.join(bundleRoot, rel);
  if (!fs.existsSync(src)) fail("bundle is incomplete: " + rel);
  const content = fs.readFileSync(src, "utf8");
  const dst = path.join(repo, rel);
  if (fs.existsSync(dst)) {
    const current = fs.readFileSync(dst, "utf8");
    if (current !== content) fail(rel + " already exists with different content; reconcile it manually");
  }
  schedule(rel, content);
}

let topo = read("forge/topography-test-mock.html");
let engine = read("forge/forge-engine.js");

topo = replaceOnce(
  topo,
  '<script src="map-bridge.js?v=fb1"></script>\n<script src="forge-engine.js?v=fb1"></script>',
  '<script src="map-bridge.js?v=fb1"></script>\n<script src="forge-generator-foundation.js?v=g2f1"></script>\n<script src="forge-engine.js?v=fb1"></script>',
  "topography foundation include"
);

topo = replaceOnce(
  topo,
`   URL switches make browser A/B checks possible without another deploy:
     ?storybook=0  restores the v1 cylinder + gradient backdrop
     ?parallax=0   keeps sky + horizon, hides far/mid/near cards
     ?landmarks=0  hides the optional hero landmark card               */
const STORYBOOK_PARAMS=new URLSearchParams(location.search);
const STORYBOOK_ON=STORYBOOK_PARAMS.get('storybook')!=='0';
const PARALLAX_ON=STORYBOOK_PARAMS.get('parallax')!=='0';
const LANDMARKS_ON=STORYBOOK_PARAMS.get('landmarks')!=='0';`,
`   Storybook sky + painted horizon are the approved default. The extracted
   parallax/landmark cards have baked matte/checkerboard pixels, so they are
   parked behind explicit experiment flags until rebuilt with real alpha:
     ?storybook=0  restores the v1 cylinder + gradient backdrop
     ?parallax=1   opts into the experimental far/mid/near cards
     ?landmarks=1  opts into the experimental hero landmark card       */
const STORYBOOK_PARAMS=new URLSearchParams(location.search);
const STORYBOOK_ON=STORYBOOK_PARAMS.get('storybook')!=='0';
const PARALLAX_ON=STORYBOOK_PARAMS.get('parallax')==='1';
const LANDMARKS_ON=STORYBOOK_PARAMS.get('landmarks')==='1';`,
  "storybook opt-in flags"
);

topo = replaceOnce(
  topo,
  "  return {W,H,height,type,foot,props,occ,name:D.name};",
  "  return {W,H,height,type,foot,props,occ,name:D.name,\n          /* Preserve the generator's semantic marks even before combat units exist. */\n          spawns:(D.spawns||[]).map(s=>({c:s.x,r:s.y,roomId:s.roomId,tier:s.tier,side:null})),\n          /* Guarded: terrain must still render if the foundation script fails to\n             load; forgeSessionMap() narrates the missing module at save time. */\n          generatorMeta:window.ForgeGeneratorFoundation?window.ForgeGeneratorFoundation.graphMetadata(D):null};",
  "tier graph metadata"
);

const oldParams = `function forgeParams(){
  return { seed: parseInt(document.getElementById('seed').value)||7,
           theme: BIOME,
           sliders: { roomCount:+document.getElementById('rooms').value,
                      loopChance:(+document.getElementById('loops').value)/100,
                      decorDensity:(+document.getElementById('decor').value)/100,
                      verticality:5,
                      foes:+document.getElementById('foes').value } };
}
window.__forgeParams = forgeParams;`;
const newParams = `function forgeParams(){
  const seed=parseInt(document.getElementById('seed').value)||7;
  const gf=window.ForgeGeneratorFoundation;
  return { seed,
           theme: BIOME,
           sliders: { roomCount:+document.getElementById('rooms').value,
                      loopChance:(+document.getElementById('loops').value)/100,
                      decorDensity:(+document.getElementById('decor').value)/100,
                      verticality:5,
                      foes:+document.getElementById('foes').value },
           /* Phase 2 foundation only: legacy-dungeon preserves today's terrain.
              Archetype-specific elevation/connectors land in the next terrain bite. */
           generatorVersion:gf?gf.GENERATOR_VERSION:null,
           archetype:'legacy-dungeon',
           stageSeeds:gf?gf.stageSeeds(seed):null };
}
window.__forgeParams = forgeParams;
/* Save both the reproducible recipe AND the exact battlefield. Keeping the old
   seed/theme/sliders keys at the top level means existing session boot code and
   staged-fight summaries continue to work without a database migration. */
function forgeSessionMap(){
  const gf=window.ForgeGeneratorFoundation;
  if(!gf) throw new Error('Forge generator foundation did not load');
  const params=forgeParams();
  if(!F) return params;
  const map=combatMapFromF();
  map.props=(F.props||[]).map(p=>Object.assign({},p));
  /* Prefer the units actually standing on the board. Before combat placement,
     retain the generator's semantic spawn marks instead of silently saving []. */
  const live=(typeof CB!=='undefined'&&CB&&Array.isArray(CB.units)&&CB.units.length)
    ? CB.units.map(u=>({c:u.c,r:u.r,side:u.side||null,unit:u.key||u.unit||u.id||null,alive:u.alive!==false}))
    : (F.spawns||[]).map(s=>Object.assign({},s));
  map.spawns=live;
  map.meta=Object.assign({},map.meta||{}, {source:'topography-test-mock',name:F.name||null});
  return gf.encounterEnvelope(map,params,F.generatorMeta||null);
}
window.__forgeSessionMap=forgeSessionMap;`;
topo = replaceOnce(topo, oldParams, newParams, "session recipe + snapshot envelope");

topo = replaceOnce(
  topo,
  "      overseer: uid, map: __forgeParams(), roster: buildRoster(), controllers: {}, status: 'staging'",
  "      overseer: uid, map: __forgeSessionMap(), roster: buildRoster(), controllers: {}, status: 'staging'",
  "session save uses exact snapshot"
);

engine = replaceRegexOnce(
  engine,
  /function generate\(params\) \{\r?\n([ \t]*)var p = Object\.assign\(\{\}, DEFAULTS, params \|\| \{\}\);\r?\n([ \t]*)var seed =/,
  function (match, i1, i2) {
    return "function generate(params) {\n" + i1 + "var p = Object.assign({}, DEFAULTS, params || {});\n" +
      i1 + "if (p.themeKey != null && FD.THEME_KEYS.indexOf(p.themeKey) < 0) {\n" +
      i1 + "  throw new Error(\"forge-engine: unknown themeKey \\\"\" + p.themeKey + \"\\\" (expected one of: \" + FD.THEME_KEYS.join(\", \" ) + \")\");\n" +
      i1 + "}\n" + i2 + "var seed =";
  },
  "forge-engine unknown-theme guard"
);

schedule("forge/topography-test-mock.html", topo);
schedule("forge/forge-engine.js", engine);
scheduleNew("forge/forge-generator-foundation.js");
scheduleNew("forge/tests/smoke-generator-foundation.js");
scheduleNew("forge/camera-discovery-mock.html");

/* Validate the whole plan before writing anything. */
for (const [rel, content] of plan) {
  if (!content || typeof content !== "string") fail("empty output planned for " + rel);
  if (rel.endsWith("topography-test-mock.html")) {
    if (!content.includes("PARALLAX_ON=STORYBOOK_PARAMS.get('parallax')==='1'")) fail("parallax opt-in verification failed");
    if (!content.includes("map: __forgeSessionMap()")) fail("snapshot save verification failed");
    if (!content.includes("forge-generator-foundation.js?v=g2f1")) fail("foundation include verification failed");
  }
  if (rel.endsWith("forge-engine.js") && !content.includes("forge-engine: unknown themeKey")) fail("theme guard verification failed");
}

const temps = [];
try {
  for (const [rel, content] of plan) {
    const abs = path.join(repo, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const tmp = abs + ".phase2-tmp-" + process.pid;
    fs.writeFileSync(tmp, content, "utf8");
    temps.push([tmp, abs]);
  }
  for (const [tmp, abs] of temps) fs.renameSync(tmp, abs);
} catch (e) {
  for (const [tmp] of temps) { try { fs.unlinkSync(tmp); } catch (_) {} }
  fail(e.message || String(e));
}

console.log("Applied Battle Forge Phase 1.5 + Phase 2 foundation:");
for (const rel of plan.keys()) console.log("  " + rel);
console.log("\nNo commit or push was performed.");
