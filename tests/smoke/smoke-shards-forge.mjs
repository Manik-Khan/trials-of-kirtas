// smoke-shards-forge.mjs
// Verifies the shards.html FORGE WIRING headlessly: extracts the real buildStructuralPreview
// from shards.html and runs it against the actual engine + merge + derive modules with a real
// class model + race model. (The live loadClass fetch is M's preview-deploy check; this proves
// the input-construction → deriveStructural → merged-structural path is correct.)
import { readFileSync } from 'fs';

const win = {};
function loadCjs(path) {
  const m = { exports: {} };
  new Function('module', 'exports', 'window', readFileSync(path, 'utf8'))(m, m.exports, win);
  return m.exports;
}
const Engine = loadCjs('./soul-shards-engine.js');
const SC     = loadCjs('./soul-shards-spellcasting.js');
const Derive = loadCjs('./soul-shards-derive.js');
// cross-reference on the shared window the modules closed over, so deriveStructural's
// default-dep path (window.SoulShardsEngine / window.SoulShardsSpellcasting) resolves —
// exactly as the three <script> tags wire them on the real page.
win.SoulShardsEngine = Engine; win.SoulShardsSpellcasting = SC; win.SoulShardsDerive = Derive;

// globals the extracted function expects (as shards.html provides them at runtime)
globalThis.SoulShardsDerive = Derive;
globalThis.SoulShardsSpellcasting = SC;
globalThis.effectiveAbilities = () => ({ str: 13, dex: 14, con: 14, int: 8, wis: 11, cha: 17 });
globalThis.bgDisplayName = () => 'Captain';
globalThis.draft = { name: 'Cosmere Runestar', level: 2, subclass: { n: 'The Hexblade' }, subrace: null, bg: { n: 'Captain' }, hp: undefined };

// minimal-but-correct models the engine/derive read
const WARLOCK = {
  name: 'Warlock', source: 'PHB', hd: 8, savingThrows: ['wis', 'cha'],
  subclassTitle: 'Otherworldly Patron', subclassChoiceLevel: 1,
  spellcasting: { progression: 'pact', ability: 'cha', prepared: false, cantripsKnown: [2, 2], spellsKnown: [2, 3], spellListClass: 'Warlock' },
  slotsByLevel: { 1: [1,0,0,0,0,0,0,0,0], 2: [2,0,0,0,0,0,0,0,0] },
  featuresByLevel: {
    1: [{ name: 'Otherworldly Patron', level: 1, source: 'PHB', gainSubclass: true, entries: ['A bargain with an otherworldly being.'] },
        { name: 'Pact Magic', level: 1, source: 'PHB', entries: ['Facility with spells.'] }],
    2: [{ name: 'Eldritch Invocations', level: 2, source: 'PHB', entries: ['Two invocations.'] }]
  },
  subclasses: [{ name: 'The Hexblade', shortName: 'Hexblade', source: 'XGE', spellcasting: null, slotsByLevel: {},
    featuresByLevel: { 1: [{ name: "Hexblade's Curse", level: 1, source: 'XGE', entries: ['Curse a foe.'] },
                           { name: 'Hex Warrior', level: 1, source: 'XGE', entries: ['CHA for a bonded weapon.'] }] } }]
};
const ASTRAL_ELF = {
  name: 'Astral Elf', source: 'AAG', size: 'Medium', speed: { walk: 30, label: '30 ft.' }, darkvision: 60,
  abilityBonuses: {}, abilityChoices: [], subraces: [],
  traits: [{ name: 'Fey Ancestry', entries: ['Advantage vs charm.'], source: 'AAG' },
           { name: 'Starlight Step', entries: ['Teleport 30 ft.'], source: 'AAG' }]
};

// pull the REAL buildStructuralPreview out of shards.html
const html = readFileSync('shards.html', 'utf-8');
const m = html.match(/function buildStructuralPreview\(classEntries, race\)\{[\s\S]*?\n\}/);
if (!m) { console.log('could not extract buildStructuralPreview'); process.exit(1); }
const buildStructuralPreview = (new Function('return (' + m[0] + ')'))();

const out = buildStructuralPreview([
  { model: WARLOCK, level: 2, subclassShortName: 'Hexblade' }
], ASTRAL_ELF);

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n + '  ->  ' + JSON.stringify(out && out[n.split(' ')[0]])); } };

ok('no _error (modules wired)', !out._error);
ok('classLabel = Warlock 2', out.classLabel === 'Warlock 2');
ok('subclass = The Hexblade', out.subclass === 'The Hexblade');
ok('classes[] present', Array.isArray(out.classes) && out.classes[0].name === 'Warlock' && out.classes[0].subclass === 'The Hexblade');
ok('proficiencyBonus 2 / level 2', out.proficiencyBonus === 2 && out.level === 2);
ok('abilities cha {17,+3}', out.abilities && out.abilities.cha.score === 17 && out.abilities.cha.mod === 3);
ok('save CHA proficient (Warlock first)', out.saves.cha.proficient === true && out.saves.cha.bonus === 5);
ok('combat hitDice 2d8', out.combat.hitDice === '2d8');
ok('combat spell DC 13 / atk 5', out.combat.spellSaveDC === 13 && out.combat.spellAttackBonus === 5);
ok('race speed 30 folded in', out.combat.speed === 30);
ok('race darkvision 60 folded in', out.combat.senses && out.combat.senses.darkvision === 60);
ok('race trait present (Fey Ancestry, race: provenance)', out.features.some(f => f.name === 'Fey Ancestry' && f.source === 'race:Astral Elf'));
ok('class feature origin-stamped (class:Warlock)', out.features.some(f => f.name === 'Pact Magic' && f.source === 'class:Warlock'));
// spellcasting: single-class Warlock -> ONE pact pool, no shared pool; groups empty (picker pending)
ok('spellcasting present', !!out.spellcasting);
ok('pact pool present, 2 slots short rest', out.spellcasting.pools.length === 1 &&
   out.spellcasting.pools[0].label === 'Pact Magic' && out.spellcasting.pools[0].max === 2 && /short rest/.test(out.spellcasting.pools[0].recharge));
ok('groups empty (spells pending P6a picker)', Array.isArray(out.spellcasting.groups) && out.spellcasting.groups.length === 0);
ok('_incomplete is a non-empty list', Array.isArray(out._incomplete) && out._incomplete.length > 0);
ok('_incomplete flags the pending spell picker', out._incomplete.some(x => /spell picker/i.test(x)));

console.log(`\nshards.html forge wiring: ${pass}/${pass + fail} checks pass` + (fail ? ` — ${fail} FAILED` : ' \u2713'));
process.exit(fail ? 1 : 0);
