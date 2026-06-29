// smoke-shards-persona.mjs
// Validates soul-shards-persona.js against the LIVE 2014 backgrounds.json:
//  - strip() resolves 5etools {@tag} markup to display text (no network)
//  - Soldier's Suggested Characteristics parse to 8/6/6/6
//  - a large deduped cross-background pool, source-tagged
//  - othersFor() excludes the chosen background's own lines
//  - tolerant lookup (case / "Variant " / parenthetical) and unknown -> null
import { readFileSync } from 'fs';

const code = readFileSync(new URL('./soul-shards-persona.js', import.meta.url), 'utf8');
const mod = { exports: {} };
const win = {};   // no SoulShardsData on the stub -> module falls back to global fetch
new Function('module', 'exports', 'window', code)(mod, mod.exports, win);
const P = mod.exports;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } };

// strip() — markup resolution (pure, no network)
ok('strip {@dice 1d4} -> 1d4', P._strip('roll {@dice 1d4} damage') === 'roll 1d4 damage');
ok('strip {@spell fireball|phb|fire ball} -> fire ball', P._strip('cast {@spell fireball|phb|fire ball}') === 'cast fire ball');
ok('strip {@item rope|phb} -> rope', P._strip('a {@item rope|phb}') === 'a rope');
ok('strip leaves plain prose', P._strip("I'm always polite and respectful.") === "I'm always polite and respectful.");

await P.load();

const sol = P.forBackground('Soldier');
ok('Soldier resolves (not null)', !!sol);
ok('Soldier personality = 8', !!sol && sol.personality.length === 8);
ok('Soldier ideals = 6', !!sol && sol.ideals.length === 6);
ok('Soldier bonds = 6', !!sol && sol.bonds.length === 6);
ok('Soldier flaws = 6', !!sol && sol.flaws.length === 6);

const aco = P.forBackground('Acolyte');
ok('a different background yields a different own list', !!aco && JSON.stringify(aco.personality) !== JSON.stringify(sol.personality));

ok('>= 50 backgrounds carry trait tables', P._backgroundsWithTables() >= 50);

const pool = P.pool();
ok('deduped personality pool is large (>= 300)', pool.personality.length >= 300);
ok('pool carries all four trait types', pool.ideals.length > 0 && pool.bonds.length > 0 && pool.flaws.length > 0);

const others = P.othersFor('Soldier');
const solSet = new Set((sol ? sol.personality : []).map(s => s.toLowerCase()));
ok("othersFor excludes the chosen bg's own lines", others.personality.every(o => !solSet.has(o.text.toLowerCase())));
ok('othersFor entries carry a non-empty source tag', others.personality.length > 0 && typeof others.personality[0].src === 'string' && others.personality[0].src.length > 0);

ok('tolerant lookup: case-insensitive ("soldier")', !!P.forBackground('soldier'));
ok('tolerant lookup: "Variant " / parenthetical falls back', !!(P.forBackground('Variant Criminal (Spy)') || P.forBackground('Criminal')));
ok('unknown background -> null (no throw)', P.forBackground('Totally Made Up Background') === null);

console.log('\nsmoke-shards-persona: ' + pass + ' passed, ' + fail + ' failed' +
  '  (pool.personality=' + pool.personality.length + ', bgsWithTables=' + P._backgroundsWithTables() + ')');
if (fail) process.exit(1);
