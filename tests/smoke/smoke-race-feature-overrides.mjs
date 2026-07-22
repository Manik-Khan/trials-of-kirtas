// Proves two 5etools relationships survive the real normalize → engine → derive path:
//   1. a subrace trait marked data.overwrite replaces the base trait and its spells;
//   2. refClassFeature children nested under a listed feature become sheet rows.
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Data = require('../../soul-shards-data.js');
const Engine = require('../../soul-shards-engine.js');
const Spellcasting = require('../../soul-shards-spellcasting.js');
const Derive = require('../../soul-shards-derive.js');

let pass = 0, fail = 0;
function ok(label, condition, detail) {
  if (condition) pass++;
  else { fail++; console.log('  FAIL: ' + label + (detail === undefined ? '' : ' → ' + JSON.stringify(detail))); }
}

const monkFile = {
  class: [{
    name: 'Monk', source: 'PHB', hd: { faces: 8 }, proficiency: ['str', 'dex'],
    classFeatures: ['Ki|Monk||2'], classTableGroups: [], startingProficiencies: {},
  }],
  subclass: [], subclassFeature: [],
  classFeature: [
    { name: 'Ki', source: 'PHB', className: 'Monk', classSource: 'PHB', level: 2, entries: [
      'You start knowing three such features.',
      { type: 'entries', entries: [
        { type: 'refClassFeature', classFeature: 'Flurry of Blows|Monk||2' },
        { type: 'refClassFeature', classFeature: 'Patient Defense|Monk||2' },
        { type: 'refClassFeature', classFeature: 'Step of the Wind|Monk||2' },
      ] },
    ] },
    { name: 'Flurry of Blows', source: 'PHB', className: 'Monk', classSource: 'PHB', level: 2, entries: ['Spend 1 ki point to make two unarmed strikes.'] },
    { name: 'Patient Defense', source: 'PHB', className: 'Monk', classSource: 'PHB', level: 2, entries: ['Spend 1 ki point to take the Dodge action.'] },
    { name: 'Step of the Wind', source: 'PHB', className: 'Monk', classSource: 'PHB', level: 2, entries: ['Spend 1 ki point to Disengage or Dash.'] },
  ],
};

const baseTiefling = {
  name: 'Tiefling', source: 'PHB', size: ['M'], speed: 30,
  additionalSpells: [{ known: { 1: ['thaumaturgy#c'] }, innate: { 3: { daily: { 1: ['hellish rebuke#2'] } }, 5: { daily: { 1: ['darkness'] } } }, ability: 'cha' }],
  entries: [
    { type: 'entries', name: 'Hellish Resistance', entries: ['You have resistance to fire damage.'] },
    { type: 'entries', name: 'Infernal Legacy', entries: ['You know thaumaturgy, hellish rebuke, and darkness.'] },
  ],
};
const zarielEntry = {
  name: 'Zariel', source: 'MTF', raceName: 'Tiefling', raceSource: 'PHB',
  additionalSpells: [{ known: { 1: ['thaumaturgy#c'] }, innate: { 3: { daily: { 1: ['searing smite#2'] } }, 5: { daily: { 1: ['branding smite'] } } }, ability: 'cha' }],
  entries: [{ type: 'entries', name: 'Legacy of Avernus', data: { overwrite: 'Infernal Legacy' }, entries: ['You know thaumaturgy, searing smite, and branding smite.'] }],
};

const monk = Data.normalizeClass(monkFile);
const built = Engine.build({ classModel: monk, level: 2, abilities: { str: 14, dex: 16, con: 14, int: 10, wis: 16, cha: 10 } });
const builtNames = built.features.map(f => f.name);
ok('Ki remains a top-level feature', builtNames.includes('Ki'), builtNames);
ok('Flurry of Blows is promoted from its linked record', builtNames.includes('Flurry of Blows'), builtNames);
ok('Patient Defense is promoted from its linked record', builtNames.includes('Patient Defense'), builtNames);
ok('Step of the Wind is promoted from its linked record', builtNames.includes('Step of the Wind'), builtNames);
ok('linked features appear exactly once', new Set(builtNames).size === builtNames.length, builtNames);

const tiefling = Data.normalizeRace(baseTiefling, [zarielEntry]);
const zariel = tiefling.subraces[0];
ok('Zariel records Infernal Legacy as overwritten', zariel.overwrites.includes('Infernal Legacy'), zariel.overwrites);
ok('Zariel marks its spell block as a replacement', zariel.replacesAdditionalSpells === true, zariel);

const derived = Derive.deriveStructural({
  name: 'Caim', abilities: { str: 14, dex: 16, con: 14, int: 10, wis: 16, cha: 13 },
  classes: [{ model: monk, level: 2 }], race: tiefling, subraceName: 'Zariel',
  background: { name: 'Urchin' }, spells: [], choices: [], feats: [], proficiencies: {},
}, { engine: Engine, spellcasting: Spellcasting });
const derivedNames = derived.structural.features.map(f => f.name);
ok('derived sheet excludes the overwritten Infernal Legacy row', !derivedNames.includes('Infernal Legacy'), derivedNames);
ok('derived sheet includes Legacy of Avernus', derivedNames.includes('Legacy of Avernus'), derivedNames);
ok('derived sheet includes the promoted Flurry row', derivedNames.includes('Flurry of Blows'), derivedNames);

function extractFunction(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing function: ' + name);
  let depth = 0, end = src.indexOf('{', start);
  for (; end < src.length; end++) {
    if (src[end] === '{') depth++;
    else if (src[end] === '}' && --depth === 0) { end++; break; }
  }
  return src.slice(start, end);
}
const shards = readFileSync(new URL('../../shards.html', import.meta.url), 'utf8');
const raceSpellFns = new Function('draft', 'raceName',
  extractFunction(shards, 'spellSourcesFor') + '\n' + extractFunction(shards, 'collectAdditional') +
  '\nreturn { spellSourcesFor, collectAdditional };'
)({ subrace: { n: 'Zariel' } }, () => 'Tiefling');
const sources = raceSpellFns.spellSourcesFor(tiefling);
const blocks = raceSpellFns.collectAdditional(tiefling);
const blockText = JSON.stringify(blocks).toLowerCase();
ok('spell picker uses only the replacing Zariel source', sources.length === 1 && sources[0].id === 'subrace', sources);
ok('spell picker drops Hellish Rebuke and Darkness', !blockText.includes('hellish rebuke') && !blockText.includes('darkness'), blocks);
ok('spell picker keeps Searing Smite and Branding Smite', blockText.includes('searing smite') && blockText.includes('branding smite'), blocks);

console.log((fail ? '✗' : '✓') + ' race-feature-overrides: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
