// smoke-shards-classvariant-spells.mjs
// Proves loadClassSpellList now honors `classVariant`: builds the live wizard list and
// checks that classVariant-only spells (Absorb Elements + others) are present, that
// class[] spells are untouched, and that the list grew past its old class-only size.
import { readFileSync } from 'fs';

const code = readFileSync(new URL('../../soul-shards-data.js', import.meta.url), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'window', code)(mod, mod.exports, {});
const D = mod.exports;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } };

const wiz = await D.loadClassSpellList('Wizard', { detail: false });
const names = new Set(wiz.map(s => s.name));

// the reported bug
ok('Absorb Elements is now on the wizard list', names.has('Absorb Elements'));
const ae = wiz.find(s => s.name === 'Absorb Elements');
ok('Absorb Elements is level 1, school A (abjuration)', !!ae && ae.level === 1 && ae.school === 'A');

// other classVariant-only spells that were silently missing (PHB + TCE)
['Augury', 'Divination', 'Enhance Ability', 'Speak with Dead', 'Blade of Disaster'].forEach(n =>
  ok('classVariant spell now present: ' + n, names.has(n)));

// no regression: class[] spells still present
['Fireball', 'Shield', 'Mage Armor', 'Fire Bolt'].forEach(n =>
  ok('class[] spell still present: ' + n, names.has(n)));

// the list grew meaningfully (class-only was ~240; classVariant adds ~100 more)
ok('wizard list is substantially larger now (> 320)', wiz.length > 320);

// sanity: bucketing data intact
ok('every entry carries a numeric level + school code', wiz.every(s => typeof s.level === 'number' && typeof s.school === 'string'));
ok('no duplicate spell names', names.size === wiz.length);

console.log('\nsmoke-shards-classvariant-spells: ' + pass + ' passed, ' + fail + ' failed  (wizard list size=' + wiz.length + ')');
if (fail) process.exit(1);
