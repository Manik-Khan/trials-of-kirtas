// smoke-shards-ek-school.mjs
// Drives the Eldritch Knight / Arcane Trickster school+budget rule spliced into shards.html.
// Extracts the marked block and evaluates it with stubbed _ent / _detail / picks / SCHOOL.
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../../shards.html', import.meta.url), 'utf8');
const A = html.indexOf('// ==== EK SCHOOL RULE (start)');
const B = html.indexOf('// ==== EK SCHOOL RULE (end) ====');
const block = html.slice(A, B + '// ==== EK SCHOOL RULE (end) ===='.length);

const SCHOOL = { A:'Abjuration', V:'Evocation', E:'Enchantment', I:'Illusion', C:'Conjuration', D:'Divination', T:'Transmutation', N:'Necromancy' };

const api = new Function('SCHOOL', `
  var _ent = null, _detail = {}, _picksKnown = [];
  function picks(){ return { known: _picksKnown }; }
  function esc(x){ return String(x); }
  ${block}
  return {
    setEnt: e => { _ent = e; },
    setDetail: d => { _detail = d; },
    setKnown: k => { _picksKnown = k; },
    ekRule, ekOutCount, ekBlocked, ekNote
  };
`)(SCHOOL);

// spell -> school fixture
api.setDetail({
  'Shield': { school:'A' }, 'Absorb Elements': { school:'A' }, 'Mage Armor': { school:'A' },
  'Fireball': { school:'V' }, 'Find Familiar': { school:'C' }, 'Detect Magic': { school:'D' },
  'Charm Person': { school:'E' }, 'Disguise Self': { school:'I' },
});

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } };

// not an EK/AT -> no rule
api.setEnt({ mode:'known', subclass:'Champion', level:3 }); api.setKnown([]);
ok('non-caster subclass: ekRule is null', api.ekRule() === null);
api.setEnt({ mode:'prepared', subclass:'Eldritch Knight', level:3 });
ok('prepared mode: ekRule is null', api.ekRule() === null);

// EK budget by level (anyAt 3/8/14/20)
const budgetAt = L => { api.setEnt({ mode:'known', subclass:'Eldritch Knight', level:L }); return api.ekRule().budget; };
ok('EK lvl 3  -> budget 1', budgetAt(3) === 1);
ok('EK lvl 7  -> budget 1', budgetAt(7) === 1);
ok('EK lvl 8  -> budget 2', budgetAt(8) === 2);
ok('EK lvl 14 -> budget 3', budgetAt(14) === 3);
ok('EK lvl 20 -> budget 4', budgetAt(20) === 4);
ok('EK schools are abjuration+evocation', JSON.stringify(api.ekRule().schools) === JSON.stringify(['A','V']));

// M's exact lvl-3 example: Shield (A) + Absorb Elements (A) + Find Familiar (C)
api.setEnt({ mode:'known', subclass:'Eldritch Knight', level:3 });
api.setKnown(['Shield', 'Absorb Elements']);          // two in-school picked
ok('Absorb Elements (A) is allowed (in-school)', api.ekBlocked('Absorb Elements') === false);
ok('Find Familiar (C) allowed while budget free', api.ekBlocked('Find Familiar') === false);
ok('out-of-school count is 0 so far', api.ekOutCount() === 0);

api.setKnown(['Shield', 'Absorb Elements', 'Find Familiar']);   // free pick spent
ok('out-of-school count is now 1', api.ekOutCount() === 1);
ok('a 2nd off-school pick (Detect Magic/D) is blocked', api.ekBlocked('Detect Magic') === true);
ok('Charm Person (E) also blocked at budget', api.ekBlocked('Charm Person') === true);
ok('Mage Armor (A) still allowed (in-school)', api.ekBlocked('Mage Armor') === false);
ok('Fireball (V) still allowed (in-school)', api.ekBlocked('Fireball') === false);

// budget grows: at lvl 8 a second off-school pick is fine
api.setEnt({ mode:'known', subclass:'Eldritch Knight', level:8 });
api.setKnown(['Shield', 'Find Familiar']);            // 1 off-school, budget 2
ok('EK lvl 8: 2nd off-school (Detect Magic) allowed', api.ekBlocked('Detect Magic') === false);

// Arcane Trickster mirror: enchantment + illusion
api.setEnt({ mode:'known', subclass:'Arcane Trickster', level:3 });
api.setKnown(['Charm Person', 'Disguise Self']);      // both in-school for AT
ok('AT schools are enchantment+illusion', JSON.stringify(api.ekRule().schools) === JSON.stringify(['E','I']));
ok('AT: Disguise Self (I) in-school allowed', api.ekBlocked('Disguise Self') === false);
ok('AT: Shield (A) is off-school, allowed while budget free', api.ekBlocked('Shield') === false);
api.setKnown(['Charm Person', 'Disguise Self', 'Shield']);
ok('AT: 2nd off-school (Fireball/V) blocked', api.ekBlocked('Fireball') === true);

// note text
api.setEnt({ mode:'known', subclass:'Eldritch Knight', level:3 });
api.setKnown(['Shield']);
const note = api.ekNote();
ok('note names both schools', /Abjuration/.test(note) && /Evocation/.test(note));
ok('note shows budget 0 / 1', /0 \/ 1/.test(note));
ok('note is empty for a non-restricted caster', (api.setEnt({ mode:'prepared', subclass:'x', level:1 }), api.ekNote() === ''));

console.log('\nsmoke-shards-ek-school: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
