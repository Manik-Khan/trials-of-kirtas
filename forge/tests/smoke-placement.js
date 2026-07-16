/* smoke-placement.js — §5.2, the spread rule.
   Run: cd forge/tests && node smoke-placement.js

   The functions under test live inline in index.html. They are
   EXTRACTED from that file at test time, not retyped here. A copy would pass
   while the mock stayed broken, which is the failure mode this project keeps
   hitting. The fields are real: ForgeEngine.generate() over 40 seeds.        */
const fs   = require('fs');
const path = require('path');
const TG   = require('../tactics-geometry.js');
const Engine = require('../forge-engine.js');

const MOCK = path.join(__dirname, '..', 'index.html');

let pass = 0, fail = 0;
function t(name, ok, detail) {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '\u2713' : '\u2717'} ${name}${ok || !detail ? '' : `   ${detail}`}`);
}

/* ── extract a top-level `function NAME(` … matching brace, verbatim ─────── */
function extract(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} not found in the mock — did it get renamed?`);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`unbalanced braces reading ${name}`);
}

const html = fs.readFileSync(MOCK, 'utf8');
const sources = ['clusterAround', 'foeAnchor'].map(n => extract(html, n));

/* Constants the mock declares beside them. Read, not assumed. */
const grab = (re, label) => {
  const m = html.match(re);
  if (!m) throw new Error(`${label} not found in the mock`);
  return Number(m[1]);
};
const PC_SPREAD    = grab(/var PC_SPREAD\s*=\s*(\d+)/,    'PC_SPREAD');
const FOE_SPREAD   = grab(/var FOE_SPREAD\s*=\s*(\d+)/,   'FOE_SPREAD');
const FOE_BAND_MIN = grab(/var FOE_BAND_MIN\s*=\s*(\d+)/, 'FOE_BAND_MIN');
const FOE_BAND_MAX = grab(/FOE_BAND_MAX\s*=\s*(\d+)/,     'FOE_BAND_MAX');

/* ── the ambient the two functions close over, supplied per map ──────────── */
let CB = { map: null }, logs = [];
function clog(html) { logs.push(html); }
let tierOf = () => 0;
function tTier(c, r) { return tierOf(c, r); }
function cbDist(a, b) {
  const horiz = Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
  const vert  = Math.abs(tTier(a.c, a.r) - tTier(b.c, b.r));
  return Math.max(horiz, vert) * 5;
}
const scope = { TG, CB, clog, cbDist, tTier, FOE_BAND_MIN, FOE_BAND_MAX, Math, Set };
const factory = new Function(
  ...Object.keys(scope),
  sources.join('\n') + '\nreturn { clusterAround, foeAnchor };'
);
const { clusterAround, foeAnchor } = factory(...Object.values(scope));

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const minGap = set => {
  let m = Infinity;
  for (let i = 0; i < set.length; i++)
    for (let j = i + 1; j < set.length; j++) m = Math.min(m, cheb(set[i], set[j]));
  return set.length < 2 ? Infinity : m;
};

/* ── real maps ───────────────────────────────────────────────────────────── */
function fieldFor(seed) {
  const m = Engine.generate({ seed, heightMode: 'tiered' });
  const cells = [];
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
    const i = r * m.cols + c;
    if (!m.wall[i]) cells.push({ x: c, y: r, h: m.h[i] / 5 });
  }
  CB.map = m;
  tierOf = (c, r) => (c < 0 || r < 0 || c >= m.cols || r >= m.rows) ? 0 : (m.h[r * m.cols + c] / 5);
  return { map: m, cells };
}

console.log('\n\u2500\u2500 constants come from the mock, not from this file \u2500\u2500');
t(`PC_SPREAD  = ${PC_SPREAD}`,  PC_SPREAD === 1);
t(`FOE_SPREAD = ${FOE_SPREAD}`, FOE_SPREAD === 2);
t(`foe band ${FOE_BAND_MIN}\u2013${FOE_BAND_MAX} ft`, FOE_BAND_MIN === 40 && FOE_BAND_MAX === 90);

console.log('\n\u2500\u2500 spread is honoured on open ground \u2500\u2500');
{
  const cells = [];
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) cells.push({ x, y, h: 0 });
  const seed = { x: 10, y: 10 };

  const a = clusterAround(cells, seed, 4, {}, 0);
  t('minSep 0 packs tight, as it always did', a.length === 4 && minGap(a) === 1, `gap ${minGap(a)}`);

  const b = clusterAround(cells, seed, 4, {}, 1);
  t('minSep 1 leaves a clear square between allies', b.length === 4 && minGap(b) >= 2, `gap ${minGap(b)}`);

  const c = clusterAround(cells, seed, 6, {}, 2);
  t('minSep 2 leaves two', c.length === 6 && minGap(c) >= 3, `gap ${minGap(c)}`);
  t('and reports the sep it achieved', c.sep === 2 && c.short === false);
}

console.log('\n\u2500\u2500 a corridor relaxes rather than returning short \u2500\u2500');
{
  const corridor = [];
  for (let x = 0; x < 7; x++) corridor.push({ x, y: 0, h: 0 });   // 7 cells, want 4 at sep 2
  const r = clusterAround(corridor, { x: 0, y: 0 }, 4, {}, 2);
  t('all four are placed', r.length === 4, `got ${r.length}`);
  t('sep relaxed below the ask', r.sep < 2, `sep ${r.sep}`);
  t('and the relaxation is reported, not hidden', r.sep === 1 && r.short === false, `sep ${r.sep} short ${r.short}`);
}

console.log('\n\u2500\u2500 `taken` is committed, never poisoned by a failed search \u2500\u2500');
{
  const three = [{ x: 0, y: 0, h: 0 }, { x: 1, y: 0, h: 0 }, { x: 2, y: 0, h: 0 }];
  const taken = {};
  const r = clusterAround(three, three[0], 9, taken, 0);   // asks for more than exist
  t('returns what exists', r.length === 3);
  t('flags the shortfall', r.short === true);
  t('marks exactly the cells it returned', Object.keys(taken).length === 3, `${Object.keys(taken).length} keys`);
}

console.log('\n\u2500\u2500 the two sides never share a cell \u2500\u2500');
{
  let disjoint = 0, stacked = 0, seeds = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { cells } = fieldFor(seed);
    if (cells.length < 30) continue;
    seeds++;
    const taken = {};
    const hi = cells.filter(c => c.h === Math.max(...cells.map(z => z.h)));
    const pc = clusterAround(cells, hi[(hi.length / 2) | 0] || cells[0], 4, taken, PC_SPREAD);
    const anchor = foeAnchor(cells, pc, taken);
    const foe = clusterAround(cells, anchor || cells[cells.length - 1], 5, taken, FOE_SPREAD);
    const keys = new Set([...pc, ...foe].map(c => `${c.x},${c.y}`));
    if (keys.size === pc.length + foe.length) disjoint++;
    if (new Set(pc.map(c => `${c.x},${c.y}`)).size !== pc.length) stacked++;
  }
  t(`${seeds} real seeds: PC and foe cells always disjoint`, disjoint === seeds, `${disjoint}/${seeds}`);
  t('no PC ever stacked on another PC', stacked === 0, `${stacked} stacked`);
}

console.log('\n\u2500\u2500 foeAnchor prefers the 40\u201390 ft band, on real fields \u2500\u2500');
{
  let inBand = 0, anchored = 0, seeds = 0, closer = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { cells } = fieldFor(seed);
    if (cells.length < 30) continue;
    seeds++;
    const taken = {};
    const hi = cells.filter(c => c.h === Math.max(...cells.map(z => z.h)));
    const pc = clusterAround(cells, hi[(hi.length / 2) | 0] || cells[0], 4, taken, PC_SPREAD);
    const a = foeAnchor(cells, pc, taken);
    if (!a) continue;
    anchored++;
    const d = Math.min(...pc.map(p => cbDist({ c: p.x, r: p.y }, { c: a.x, r: a.y })));
    if (d >= FOE_BAND_MIN && d <= FOE_BAND_MAX) inBand++;
    if (d < 15) closer++;
  }
  t(`anchored on ${anchored}/${seeds} seeds`, anchored > seeds * 0.6, `${anchored}/${seeds}`);
  t('every anchor is at least 15 ft from the party', closer === 0, `${closer} too close`);
  t(`most anchors land in the band`, inBand >= anchored * 0.5, `${inBand}/${anchored} in band`);
}

console.log('\n\u2500\u2500 minSep 0 is exactly the old behaviour \u2500\u2500');
{
  const { cells } = fieldFor(7);
  const old = (cs, seed, n, taken) => {   // the pre-fix body, for equivalence only
    const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    const s = cs.slice().sort((a, b) => d2(a, seed) - d2(b, seed)), out = [];
    for (let i = 0; i < s.length && out.length < n; i++) {
      const k = `${s[i].x},${s[i].y}`;
      if (!taken[k]) { taken[k] = 1; out.push(s[i]); }
    }
    return out;
  };
  const seed = cells[0];
  const a = old(cells, seed, 5, {});
  const b = clusterAround(cells, seed, 5, {}, 0);
  t('same cells, same order', JSON.stringify(a) === JSON.stringify(b.slice()));
}

console.log(`\n${pass}/${pass + fail} passed${fail ? `  \u2014 ${fail} FAILED` : ''}\n`);
process.exit(fail ? 1 : 0);
