// smoke-derive-proficiencies.mjs
// Locks the derive half of the proficiency slice: given input.proficiencies (the resolved
// NAME lists the Proficiencies step hands over), deriveStructural must emit the 18-row
// skills[] with correct bonuses + prof flags, the passive Perception/Insight scalars, and
// a structural.proficiencies block — and must no longer flag any of those as _incomplete.
import { readFileSync } from 'fs';

const win = {};
function loadCjs(path) {
  const m = { exports: {} };
  new Function('module', 'exports', 'window', readFileSync(new URL(path, import.meta.url), 'utf8'))(m, m.exports, win);
  return m.exports;
}
const Engine = loadCjs('../../soul-shards-engine.js');
const SC = loadCjs('../../soul-shards-spellcasting.js');
const Derive = loadCjs('../../soul-shards-derive.js');
win.SoulShardsEngine = Engine; win.SoulShardsSpellcasting = SC;

const WIZ = {
  name: 'Wizard', source: 'PHB', hd: 6, savingThrows: ['int', 'wis'],
  subclassTitle: 'Arcane Tradition', subclassChoiceLevel: 2,
  spellcasting: { progression: 'full', ability: 'int', prepared: true, cantripsKnown: [3, 3, 3], spellsKnown: null },
  slotsByLevel: { 3: [4, 2, 0, 0, 0, 0, 0, 0, 0] },
  featuresByLevel: { 1: [{ name: 'Arcane Recovery', level: 1, source: 'PHB', entries: ['Recover slots.'] }] },
  subclasses: []
};
// INT 18 (+4), WIS 12 (+1), DEX 14 (+2); level 3 -> PB +2
const out = Derive.deriveStructural({
  name: 'The Wiz', abilities: { str: 10, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
  classes: [{ model: WIZ, level: 3 }],
  proficiencies: {
    skills: ['Arcana', 'History', 'Investigation', 'Perception'],
    languages: ['Common', 'Elvish', 'Draconic', 'Infernal'],
    tools: [], weapons: ['Daggers', 'Quarterstaffs'], armor: []
  }
}, { engine: Engine, spellcasting: SC });
const s = out.structural;
const sk = n => s.skills.find(x => x.name === n);

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n + '  ->  ' + JSON.stringify(sk(n.split("'")[1] || ''))); } };

ok('skills[] has all 18 rows', Array.isArray(s.skills) && s.skills.length === 18);
ok("'Arcana' INT proficient = +6 (4 + pb 2)", sk('Arcana').bonus === 6 && sk('Arcana').prof === true && sk('Arcana').attr === 'int');
ok("'Perception' WIS proficient = +3 (1 + pb 2)", sk('Perception').bonus === 3 && sk('Perception').prof === true);
ok("'Investigation' INT proficient = +6", sk('Investigation').bonus === 6 && sk('Investigation').prof === true);
ok("'Stealth' DEX NOT proficient = +2", sk('Stealth').bonus === 2 && sk('Stealth').prof === false);
ok("'Medicine' WIS NOT proficient = +1", sk('Medicine').bonus === 1 && sk('Medicine').prof === false);
ok('passivePerception = 13 (10 + Perception +3)', s.passivePerception === 13);
ok('passiveInsight = 11 (10 + Insight +1, not proficient)', s.passiveInsight === 11);
ok('structural.proficiencies.languages carried', Array.isArray(s.proficiencies.languages) && s.proficiencies.languages.includes('Draconic'));
ok('structural.proficiencies.skills mirrors proficient skills', s.proficiencies.skills.includes('Arcana') && s.proficiencies.skills.length === 4);
ok('structural.proficiencies.weapons carried', s.proficiencies.weapons.includes('Daggers'));

// _incomplete must no longer flag skills / passives / proficiencies, but still flags actions + spells
ok('_incomplete no longer flags skills[]', !out._incomplete.some(x => /^skills\[\]/.test(x)));
ok('_incomplete no longer flags passives', !out._incomplete.some(x => /passivePerception/i.test(x)));
ok('_incomplete no longer flags proficiencies', !out._incomplete.some(x => /^proficiencies \(/.test(x)));
ok('_incomplete still flags actions[] (next slice)', out._incomplete.some(x => /^actions\[\]/.test(x)));
ok('_incomplete still flags the pending spell picker', out._incomplete.some(x => /spell picker/i.test(x)));

// degenerate path: NO proficiency input -> all skills at bare ability mod, no crash
const bare = Derive.deriveStructural({ name: 'Bare', abilities: { str: 10, dex: 14, con: 12, int: 8, wis: 10, cha: 13 }, classes: [{ model: WIZ, level: 3 }] }, { engine: Engine, spellcasting: SC });
ok('no-proficiency input still yields 18 skills', bare.structural.skills.length === 18);
ok('no-proficiency input -> none proficient', bare.structural.skills.every(x => x.prof === false));
ok('no-proficiency input -> Stealth = bare DEX +2', bare.structural.skills.find(x => x.name === 'Stealth').bonus === 2);

console.log(`\nderive proficiency output: ${pass}/${pass + fail} checks pass` + (fail ? ` — ${fail} FAILED` : ' \u2713'));
process.exit(fail ? 1 : 0);
