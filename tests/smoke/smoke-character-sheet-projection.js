// Canonical character projection: modern spellcasting wins over stale legacy
// data, corrections affect every consumer, and Forge receives the same result.
const fs = require('fs');
const path = require('path');
const Projection = require('../../character-sheet-projection.js');
const ForgeKit = require('../../forge/forge-kit-derive.js');

let pass = 0, fail = 0;
function ok(name, condition) { if (condition) pass++; else { fail++; console.log('  FAIL ' + name); } }
function names(structural) {
  return (structural.spellcasting.groups || []).flatMap(function (group) {
    return (group.spells || []).map(function (spell) { return spell.name; });
  });
}

const caim = {
  key: 'caim', name: 'Caim', vitals: { hp: 24 }, inventory: [],
  structural: {
    name: 'Caim', race: 'Zariel Tiefling', level: 5, proficiencyBonus: 3,
    abilities: { dex:{mod:3}, wis:{mod:3}, cha:{mod:1} },
    combat: { hpMax:24, ac:16, speed:40, initiative:3 },
    // This is the precise field failure: reforge authored the modern list but
    // the merge retained the prior tiefling spell in the legacy map.
    spells: { 1:[{ name:'Hellish Rebuke', castingTime:'1 reaction' }] },
    spellcasting: { groups:[
      { level:0, spells:[{ name:'Thaumaturgy', source:'Zariel Tiefling' }] },
      { level:1, spells:[{ name:'Searing Smite', source:'Zariel Tiefling' }] },
      { level:2, spells:[{ name:'Branding Smite', source:'Zariel Tiefling' }] }
    ] },
    features: [{ name:'Flurry of Blows', source:'class:Monk', desc:'Two strikes.' }],
    corrections: { version:2, active:[
      { id:'hide_searing', kind:'spell', action:'suppress', name:'Searing Smite', source:'Zariel Tiefling', status:'confirmed' },
      { id:'add_shield', kind:'spell', action:'add', name:'Shield', level:1, source:'Sorcerer', status:'confirmed', spell:{castingTime:'1 reaction'} },
      { id:'hide_flurry', kind:'feature', action:'suppress', name:'Flurry of Blows', source:'class:Monk', status:'confirmed' }
    ], history:[] }
  }
};

const projected = Projection.projectStructural(caim.structural);
const projectedNames = names(projected);
ok('modern spellcasting wins over stale legacy Hellish Rebuke', !projectedNames.includes('Hellish Rebuke'));
ok('modern Zariel Branding Smite remains present', projectedNames.includes('Branding Smite'));
ok('spell suppression is applied', !projectedNames.includes('Searing Smite'));
ok('manual spell addition is applied', projectedNames.includes('Shield'));
ok('feature suppression is applied', !projected.features.some(f => f.name === 'Flurry of Blows'));
ok('projection never mutates stored legacy data', caim.structural.spells[1][0].name === 'Hellish Rebuke');

const forge = ForgeKit.derive(caim, { assembledActions: [] });
const forgeSpellNames = (forge.tabs.spells || []).map(tile => tile.label);
ok('Forge does not rebuild the stale spell tile', !forgeSpellNames.includes('Hellish Rebuke'));
ok('Forge reactions use the projected manual Shield', !!(forge.react && forge.react.shield));
ok('Zariel Tiefling does not regain a hard-coded Hellish Rebuke reaction', !(forge.react && forge.react.hellishRebuke));
ok('Forge uses projected features too', !(forge.tabs.actions || []).some(tile => tile.label === 'Flurry of Blows'));

const party = fs.readFileSync(path.join(__dirname, '..', '..', 'party.html'), 'utf8');
ok('party imports the full-sheet projection door', party.includes("import { toRenderShape } from './sheet-mount.js?v=src1'"));
ok('party no longer reads structural.spells', !party.includes('structural.spells'));

console.log('smoke-character-sheet-projection: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
