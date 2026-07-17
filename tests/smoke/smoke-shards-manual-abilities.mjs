// smoke-shards-manual-abilities.mjs
// Verifies the Manual ability-score path extracted from shards.html:
//  - effectiveAbilities(): with array/point-buy, racial bonuses layer on and cap at 20;
//    with method 'manual', the entered scores are returned verbatim (final totals).
//  - reverseMapStructural(): a character with stored {score} abilities but no _build is
//    recovered into Manual mode with the real final scores (the Vesperian case).
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../../shards.html', import.meta.url), 'utf8');

// extract a top-level function body by brace matching (these fns have no braces in strings)
function extractFn(name) {
  const start = html.indexOf('function ' + name + '(');
  let i = html.indexOf('{', start), depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start, i);
}

const ABILS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } };

// ── effectiveAbilities ──────────────────────────────────────────────────────
const effSrc = extractFn('effectiveAbilities');
const SpeciesUI = { combinedBonuses: () => ({ str: 2, con: 1 }) };
const FeatsUI = { advancementBonuses: () => ({}) };
const makeEff = (draft) => new Function('ABILS', 'draft', 'SpeciesUI', 'FeatsUI', effSrc + '; return effectiveAbilities;')(ABILS, draft, SpeciesUI, FeatsUI);

const effArray = makeEff({ method: 'array', abilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } })({});
ok('array: racial bonus layers on (str 15+2=17, con 13+1=14)', effArray.str === 17 && effArray.con === 14);

const effCap = makeEff({ method: 'array', abilities: { str: 19, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } })({});
ok('array: respects the 20 hard cap (19+2 -> 20)', effCap.str === 20);

const effManual = makeEff({ method: 'manual', abilities: { str: 8, dex: 18, con: 16, int: 14, wis: 12, cha: 10 } })({});
ok('manual: returns entered scores unchanged (no racial layering)', effManual.str === 8 && effManual.dex === 18 && effManual.con === 16);
ok('manual: ignores feat advancement too', effManual.cha === 10 && effManual.int === 14);
const effManualHigh = makeEff({ method: 'manual', abilities: { str: 22, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } })({});
ok('manual: allows scores above 20 (no cap on final totals)', effManualHigh.str === 22);

// ── reverseMapStructural (reforge recovery) ─────────────────────────────────
const rmSrc = extractFn('reverseMapStructural');
const reverseMap = new Function('ABILS', 'DATA', 'classDef', rmSrc + '; return reverseMapStructural;')(ABILS, { races: [], backgrounds: [] }, () => null);

// Vesperian-shaped structural: {score, mod} per ability, NO _build snapshot
const built = reverseMap({ abilities: {
  str: { score: 8, mod: -1 }, dex: { score: 18, mod: 4 }, con: { score: 16, mod: 3 },
  int: { score: 14, mod: 2 }, wis: { score: 12, mod: 1 }, cha: { score: 10, mod: 0 },
} });
ok('reforge recovery selects Manual mode', built.method === 'manual');
ok('reforge recovery loads the real final scores', built.abilities.str === 8 && built.abilities.dex === 18 && built.abilities.cha === 10);
ok('reforge recovery covers all six abilities', ABILS.every(k => typeof built.abilities[k] === 'number'));

const builtNone = reverseMap({});
ok('no stored abilities -> Manual not forced', builtNone.method === undefined && builtNone.abilities === undefined);

console.log('\nsmoke-shards-manual-abilities: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
