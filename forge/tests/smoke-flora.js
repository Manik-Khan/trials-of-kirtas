/* smoke-flora.js — biome flora + wall hardness.
   Run: cd forge/tests && node smoke-flora.js

   Everything under test is EXTRACTED from topography-test-mock.html at test
   time — the real inlined generator core, the real buildTiersField, the real
   FLORA table, the real PROP_FT. A copy would pass while the mock stayed
   broken (CONTEXT_Forge §7).

   Three invariants, each one a bug that actually shipped:
     1. Walls are hard.        T_ROCK is never walkable, never passable.
     2. Flora clears walls.    Trees used to be 100% wall-adjacent, by
                               construction, which is why they read as planted
                               inside them: a camera-facing quad ~1.4 units wide
                               standing in a 1-unit cell beside a taller box.
     3. Every kind has a height. A kind absent from PROP_FT occludes NOTHING,
                               silently. Sight is decided by tier*5 + occ.       */
const fs = require('fs');
const path = require('path');
const TG = require('../tactics-geometry.js');
const MB = require('../map-bridge.js');

const MOCK = path.join(__dirname, '..', 'topography-test-mock.html');
const html = fs.readFileSync(MOCK, 'utf8');
const LINES = html.split('\n');

let pass = 0, fail = 0;
function t(name, ok, detail) {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '\u2713' : '\u2717'} ${name}${ok || !detail ? '' : `   ${detail}`}`);
}

/* ── extraction ──────────────────────────────────────────────────────────── */
function balanced(src, from, open, close) {
  let i = src.indexOf(open, from), d = 0;
  for (; i < src.length; i++) {
    if (src[i] === open) d++;
    else if (src[i] === close && --d === 0) return i;
  }
  throw new Error('unbalanced');
}
function fn(name) {
  const s = html.indexOf(`function ${name}(`);
  if (s < 0) throw new Error(`function ${name} missing from the mock`);
  return html.slice(s, balanced(html, s, '{', '}') + 1);
}
function obj(decl) {
  const s = html.indexOf(decl);
  if (s < 0) throw new Error(`${decl} missing from the mock`);
  return html.slice(s, balanced(html, s, '{', '}') + 1) + ';';
}

/* the generator core, verbatim: mulberry32 through the end of generateDungeon */
const genStart = LINES.findIndex(l => l.startsWith('function mulberry32('));
/* findIndex's second argument is thisArg, NOT a start index. Search explicitly. */
const genEnd = (() => {
  for (let i = genStart + 1; i < LINES.length; i++)
    if (LINES[i].startsWith('/* \u2550\u2550\u2550')) return i;
  return -1;
})();
if (genStart < 0 || genEnd < 0) throw new Error('generator core boundaries moved');
const GEN = LINES.slice(genStart, genEnd).join('\n');

const SRC = [
  GEN,
  obj('const PROP_FT = {') || obj('const PROP_FT={'),
  fn('propOccFt'),
  obj('const FLORA = {'),
  'const flora = () => FLORA[BIOME] || FLORA.grass;',
  "const FLORA_KINDS = new Set(['tree','cypress','pine','snowpine','poplar','bush','bare','reed','mushroom']);",
  fn('buildTiersField'),
  fn('walkableCells'),
  fn('combatMapFromF'),
  'return { buildTiersField, walkableCells, combatMapFromF, FLORA, PROP_FT, FLORA_KINDS, propOccFt };',
].join('\n');

const T_WATER = 0, T_GRASS = 1, T_STONE = 2, T_PLAZA = 3, T_ROCK = 4;
const WALL_FT = 7, STEP_FT = 5;
const EMPTY_OCC = n => new Float32Array(n);
const documentStub = { getElementById: () => ({ textContent: '' }) };
const windowStub = { performance: { now: () => Date.now() } };

function build(seed, biome) {
  let F = null;
  const src = SRC.replace(
    'return { buildTiersField',
    `F = buildTiersField(${seed});\n  return { F, cells: walkableCells(), map: combatMapFromF(), buildTiersField`
  );
  const make = new Function(
    'BIOME', 'T_WATER', 'T_GRASS', 'T_STONE', 'T_PLAZA', 'T_ROCK',
    'WALL_FT', 'STEP_FT', 'EMPTY_OCC', 'document', 'window', 'TG', 'F', src);
  return make(biome, T_WATER, T_GRASS, T_STONE, T_PLAZA, T_ROCK,
              WALL_FT, STEP_FT, EMPTY_OCC, documentStub, windowStub, TG, null);
}

const { FLORA, PROP_FT, FLORA_KINDS } = build(1, 'grass');
const BIOMES = Object.keys(FLORA);

console.log('\n\u2500\u2500 every flora kind carries an occluder height \u2500\u2500');
{
  const kinds = new Set();
  BIOMES.forEach(b => FLORA[b].kinds.forEach(k => kinds.add(k)));
  const missing = [...kinds].filter(k => PROP_FT[k] == null);
  t(`${kinds.size} distinct kinds across ${BIOMES.length} biomes`, kinds.size > 0);
  t('none is missing from PROP_FT', missing.length === 0, `missing ${missing.join(', ')}`);
  t('all are recognised as flora by placeProp', [...kinds].every(k => FLORA_KINDS.has(k)),
    [...kinds].filter(k => !FLORA_KINDS.has(k)).join(', '));

  /* PROP_FT mirrors map-bridge PROP_UNITS x 5. Drift silently changes cover. */
  const drift = [...kinds].filter(k => MB.PROP_UNITS[k] != null &&
                                       Math.abs(MB.PROP_UNITS[k] * 5 - PROP_FT[k]) > 1e-9);
  t('PROP_FT agrees with map-bridge PROP_UNITS \u00d7 5 ft', drift.length === 0,
    drift.map(k => `${k}: ${PROP_FT[k]} vs ${MB.PROP_UNITS[k] * 5}`).join('; '));
}

console.log('\n\u2500\u2500 the biome actually changes what grows \u2500\u2500');
{
  const sets = BIOMES.map(b => new Set(FLORA[b].kinds));
  t('tundra grows no bare-leaf oaks', !sets[BIOMES.indexOf('tundra')].has('tree'));
  t('tundra grows snowpine', sets[BIOMES.indexOf('tundra')].has('snowpine'));
  t('cavern grows mushrooms, not trees',
    sets[BIOMES.indexOf('cavern')].has('mushroom') && !sets[BIOMES.indexOf('cavern')].has('tree'));
  t('swamp grows reeds', sets[BIOMES.indexOf('swamp')].has('reed'));
  t('no two biomes share an identical kind list',
    new Set(BIOMES.map(b => FLORA[b].kinds.join(','))).size === BIOMES.length);
  t('every biome has a density', BIOMES.every(b => typeof FLORA[b].density === 'number' && FLORA[b].density > 0));
  t('every biome has a three-stop leaf palette', BIOMES.every(b => FLORA[b].pal.leaf.length === 3));
}

console.log('\n\u2500\u2500 walls are hard, and flora clears them (30 seeds \u00d7 every biome) \u2500\u2500');
{
  let seeds = 0, rockWalkable = 0, rockPassable = 0, floraOnRock = 0,
      floraAdjWall = 0, floraTotal = 0, offBiome = 0;
  for (const biome of BIOMES) {
    const allowed = new Set(FLORA[biome].kinds);
    for (let seed = 1; seed <= 30; seed++) {
      let r; try { r = build(seed, biome); } catch (e) { continue; }
      const { F, cells, map } = r;
      if (biome === BIOMES[0]) seeds++;
      const at = (x, y) => y * F.W + x;

      cells.forEach(c => { if (F.type[at(c.x, c.y)] === T_ROCK) rockWalkable++; });
      for (let i = 0; i < F.W * F.H; i++) if (F.type[i] === T_ROCK && !map.wall[i]) rockPassable++;

      (F.props || []).forEach(p => {
        if (!FLORA_KINDS.has(p.kind)) return;
        floraTotal++;
        if (!allowed.has(p.kind)) offBiome++;
        const i = at(p.x, p.y);
        if (F.type[i] === T_ROCK) floraOnRock++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = p.x + dx, ny = p.y + dy;
          if (nx < 0 || ny < 0 || nx >= F.W || ny >= F.H) continue;
          if (F.type[at(nx, ny)] === T_ROCK) { floraAdjWall++; break; }
        }
      });
    }
  }
  t(`${seeds} seeds \u00d7 ${BIOMES.length} biomes, ${floraTotal} flora placed`, floraTotal > 500, `${floraTotal}`);
  t('no walkable cell is a wall', rockWalkable === 0, `${rockWalkable}`);
  t('no wall is passable', rockPassable === 0, `${rockPassable}`);
  t('no flora stands on a wall', floraOnRock === 0, `${floraOnRock}`);
  t('no flora stands against a wall', floraAdjWall === 0, `${floraAdjWall} adjacent`);
  t('every plant belongs to its biome', offBiome === 0, `${offBiome} off-biome`);
}

console.log(`\n${pass}/${pass + fail} passed${fail ? `  \u2014 ${fail} FAILED` : ''}\n`);
process.exit(fail ? 1 : 0);
