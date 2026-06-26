// smoke-shards-proficiencies.mjs
// Exercises the Proficiencies step's PURE core, extracted verbatim from shards.html:
// resolveProf (class/race/bg + bgCustom -> model), profTakenSet (cross-source dimming),
// flattenProficiencies (model + picks -> name lists the derive consumes), and the skill
// canonicalizer. Proves the tandem behaviour: the bgCustom flag flips the background's
// fixed skills into a free choice, and anything granted anywhere dims everywhere else.
import { readFileSync } from 'fs';

const html = readFileSync(new URL('./shards.html', import.meta.url), 'utf8');
const start = html.indexOf('var PROF_SKILLS = [');
const end = html.indexOf('var ProfUI = (function(){');
if (start < 0 || end < 0 || end <= start) { console.log('could not slice the proficiency core'); process.exit(1); }
const core = html.slice(start, end);
const { resolveProf, flattenProficiencies, profTakenSet, normSkillName, countGrants } =
  (new Function(core + '\n; return { resolveProf, flattenProficiencies, profTakenSet, normSkillName, countGrants };'))();

// ── sample build: Wizard 3 / Eladrin / Sage ──
const data = {
  className: 'Wizard',
  classProf: {
    skills: [{ choose: { from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'], count: 2 } }],
    weapons: ['daggers', 'darts', 'slings', 'quarterstaffs', 'light crossbows'], armor: [], tools: []
  },
  raceName: 'Eladrin',
  race: {
    name: 'Eladrin',
    skillProficiencies: { fixed: ['perception'], anyCount: 0, choose: [] },     // High Elf Keen Senses
    languages: { fixed: ['Common', 'Elvish'], anyStandard: 0, any: 1 },          // + one extra language
    toolProficiencies: { fixed: [], anyCount: 0, choose: [] },
    weaponProficiencies: { fixed: ['Longsword', 'Shortsword', 'Shortbow', 'Longbow'], anyCount: 0, choose: [] },
    armorProficiencies: { fixed: [], anyCount: 0, choose: [] }
  },
  bgName: 'Sage',
  bgProf: {
    skills: { fixed: ['arcana', 'history'], anyCount: 0, choose: [] },
    languages: { fixed: [], anyStandard: 2, any: 0 },
    tools: { fixed: [], anyCount: 0, choose: [] }
  }
};

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } };
const names = a => a.map(x => x.name);

// ── canonicalization ──
ok("normSkillName lowercases->canonical ('arcana'->'Arcana')", normSkillName('arcana') === 'Arcana');
ok("normSkillName multiword ('sleight of hand')", normSkillName('sleight of hand') === 'Sleight of Hand');

// ── default (no customize) ──
const m = resolveProf(data, false);
ok('skills.fixed has race Perception', names(m.skills.fixed).includes('Perception'));
ok('skills.fixed has bg Arcana + History (canonical)', names(m.skills.fixed).includes('Arcana') && names(m.skills.fixed).includes('History'));
const wizChoice = m.skills.choices.find(c => c.src === 'class');
ok('class skill choice present (choose 2 of 6)', !!wizChoice && wizChoice.count === 2 && wizChoice.pool.length === 6);
ok('class pool is canonical', wizChoice.pool.includes('Arcana') && wizChoice.pool.includes('Investigation'));

// cross-source dimming: Arcana/History (granted by bg) are taken relative to the Wizard choice
const takenForWiz = profTakenSet(m.skills, {}, wizChoice.id);
ok('dimming: Arcana taken (granted by bg) for the class choice', takenForWiz['Arcana'] === true);
ok('dimming: History taken for the class choice', takenForWiz['History'] === true);
ok('dimming: Perception taken (race fixed) for the class choice', takenForWiz['Perception'] === true);
ok('dimming: Investigation NOT yet taken', !takenForWiz['Investigation']);

// a pick in the class choice is NOT in its own taken set, but IS for a sibling
const picks1 = { skills: { [wizChoice.id]: ['Investigation', 'Stealth'] } };
ok('a choice never dims its own picks', profTakenSet(m.skills, picks1.skills, wizChoice.id)['Investigation'] !== true);

// languages: race fixed + race "any 1" + bg "anyStandard 2"
ok('languages.fixed has Common + Elvish (race)', names(m.languages.fixed).includes('Common') && names(m.languages.fixed).includes('Elvish'));
ok('race language choice (any 1) present', m.languages.choices.some(c => c.src === 'race' && c.count === 1));
ok('bg language choice (standard 2) present', m.languages.choices.some(c => c.src === 'bg' && c.count === 2));

// weapons: race fixed folds in (display-only granted)
ok('weapons.fixed has race Longsword', names(m.weapons.fixed).includes('Longsword'));

// ── customize ON: bg fixed skills flip to a free choice (the tandem behaviour) ──
const mc = resolveProf(data, true);
ok('custom: bg Arcana/History no longer FIXED', !names(mc.skills.fixed).includes('Arcana') && !names(mc.skills.fixed).includes('History'));
ok('custom: race Perception STILL fixed', names(mc.skills.fixed).includes('Perception'));
const bgCust = mc.skills.choices.find(c => c.id === 'bg-cust-sk');
ok('custom: bg becomes choose-2 from all 18', !!bgCust && bgCust.count === 2 && bgCust.pool.length === 18);
ok('custom: count matches what the bg would have granted', countGrants(data.bgProf.skills) === 2);

// ── flatten -> the NAME lists the derive consumes ──
const picks = {
  skills: { [wizChoice.id]: ['Investigation', 'Stealth'] },
  languages: { 'bg-lgstd': ['Draconic', 'Infernal'], 'race-lgany': ['Abyssal'] }
};
const flat = flattenProficiencies(m, picks);
ok('flatten skills = race ∪ bg ∪ picks', ['Perception', 'Arcana', 'History', 'Investigation', 'Stealth'].every(s => flat.skills.includes(s)));
ok('flatten skills deduped (no Arcana twice)', flat.skills.filter(s => s === 'Arcana').length === 1);
ok('flatten languages = race fixed ∪ picks', ['Common', 'Elvish', 'Draconic', 'Infernal', 'Abyssal'].every(l => flat.languages.includes(l)));
ok('flatten weapons carries race grants', flat.weapons.includes('Longsword'));

console.log(`\nproficiencies core: ${pass}/${pass + fail} checks pass` + (fail ? ` — ${fail} FAILED` : ' \u2713'));
process.exit(fail ? 1 : 0);
