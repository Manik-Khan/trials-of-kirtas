// smoke-spells-racial.mjs
// Verifies Gap-1 capture: a NON-CASTER class with a spell-granting RACE (Yuan-Ti Rogue,
// Tiefling Fighter, …) now gets a spellcasting block with the RACIAL ability/DC, the racial
// spells bucketed by level, and each spell's ability preserved for the sheet editor — while
// existing class casters are untouched. Drives the real derive + spellcasting modules.
import { readFileSync } from 'fs';

const win = {};
function loadCjs(path){ const m = { exports:{} }; new Function('module','exports','window', readFileSync(path,'utf8'))(m, m.exports, win); return m.exports; }
const Engine = loadCjs('./soul-shards-engine.js');
const SC     = loadCjs('./soul-shards-spellcasting.js');
const Derive = loadCjs('./soul-shards-derive.js');
win.SoulShardsEngine = Engine; win.SoulShardsSpellcasting = SC; win.SoulShardsDerive = Derive;

let pass = 0, fail = 0;
function ok(name, cond, got){ if (cond){ pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name + (got !== undefined ? '  (got: ' + JSON.stringify(got) + ')' : '')); } }

// Yuan-Ti Rogue 3: Cha 16 (+3), pb 2 -> DC 13, atk +5  (matches the live sheet)
const ROGUE_ABIL = { str:10, dex:16, con:14, int:11, wis:14, cha:16 };
const RACIAL = [
  { name:'Poison Spray',      level:'cantrip', origin:'race', source:'Yuan-Ti', ability:'cha' },
  { name:'Animal Friendship', level:1,         origin:'race', source:'Yuan-Ti', ability:'cha' },
  { name:'Suggestion',        level:2,         origin:'race', source:'Yuan-Ti', ability:'cha' }
];

console.log('\n[1] deriveSpellcasting \u2014 racial-only (non-caster Rogue + Yuan-Ti grants)');
{
  const sc = SC.deriveSpellcasting({
    totalLevel:3, abilities:ROGUE_ABIL,
    classes:[{ name:'Rogue', level:3, ability:null, prepared:false }],   // no spellcasting class
    spells:RACIAL
  });
  ok('ability resolves to Charisma', sc.ability === 'Charisma', sc.ability);
  ok('save DC = 13 (8 + pb2 + cha+3)', sc.saveDC === 13, sc.saveDC);
  ok('attack bonus = +5', sc.attackBonus === 5, sc.attackBonus);
  const heads = (sc.groups || []).map(g => g.heading);
  ok('three level groups (cantrip / 1st / 2nd)', sc.groups && sc.groups.length === 3, heads);
  const flat = (sc.groups || []).flatMap(g => g.spells);
  ok('all three racial spells present', flat.length === 3, flat.map(s => s.name));
  ok('every spell tagged origin:race', flat.every(s => s.origin === 'race'), flat.map(s => s.origin));
  ok('per-spell ability preserved (cha) for the editor', flat.every(s => s.ability === 'cha'), flat.map(s => s.ability));
}

console.log('\n[2] deriveSpellcasting \u2014 regression: a real class caster is unchanged');
{
  const sc = SC.deriveSpellcasting({
    totalLevel:3, abilities:{ str:8, dex:14, con:14, int:18, wis:12, cha:10 },
    classes:[{ name:'Wizard', level:3, ability:'int', prepared:true }],
    spells:[
      { name:'Fire Bolt',     level:'cantrip', origin:'class', source:'Wizard', ability:'int' },
      { name:'Magic Missile', level:1,         origin:'class', source:'Wizard', ability:'int' }
    ]
  });
  ok('class ability = Intelligence (not overridden by racial path)', sc.ability === 'Intelligence', sc.ability);
  ok('save DC = 14 (8 + pb2 + int+4)', sc.saveDC === 14, sc.saveDC);
  ok('prepared flag preserved', sc.prepared === true, sc.prepared);
}

console.log('\n[3] deriveSpellcasting \u2014 caster + spell-race: class ability stays primary, both lists captured');
{
  const sc = SC.deriveSpellcasting({
    totalLevel:3, abilities:{ str:8, dex:14, con:14, int:18, wis:12, cha:16 },
    classes:[{ name:'Wizard', level:3, ability:'int', prepared:true }],
    spells:[
      { name:'Fire Bolt',    level:'cantrip', origin:'class', source:'Wizard',  ability:'int' },
      { name:'Poison Spray', level:'cantrip', origin:'race',  source:'Yuan-Ti', ability:'cha' },
      { name:'Suggestion',   level:2,         origin:'race',  source:'Yuan-Ti', ability:'cha' }
    ]
  });
  ok('primary ability is the class (Intelligence)', sc.ability === 'Intelligence', sc.ability);
  const flat = (sc.groups || []).flatMap(g => g.spells);
  ok('class + racial spells both present', flat.length === 3, flat.map(s => s.name));
  const racial = flat.filter(s => s.origin === 'race');
  ok('racial spells keep their own ability (cha)', racial.length === 2 && racial.every(s => s.ability === 'cha'), racial.map(s => s.ability));
}

console.log('\n[4] deriveStructural \u2014 full integration: non-caster Rogue + racial spells yields a spell block');
{
  const ROGUE = {
    name:'Rogue', source:'PHB', hd:8, savingThrows:['dex','int'],
    subclassTitle:'Roguish Archetype', subclassChoiceLevel:3, spellcasting:null, slotsByLevel:{},
    featuresByLevel:{
      1:[{ name:'Sneak Attack', level:1, source:'PHB', entries:['Extra damage.'] }, { name:'Expertise', level:1, source:'PHB', entries:['Double proficiency.'] }],
      2:[{ name:'Cunning Action', level:2, source:'PHB', entries:['Dash/Disengage/Hide as a bonus action.'] }],
      3:[{ name:'Roguish Archetype', level:3, source:'PHB', gainSubclass:true, entries:['Choose an archetype.'] }]
    },
    subclasses:[{ name:'Soulknife', shortName:'Soulknife', source:'TCE', spellcasting:null, slotsByLevel:{},
      featuresByLevel:{ 3:[{ name:'Psionic Power', level:3, source:'TCE', entries:['Psionic Energy dice.'] }] } }]
  };
  const r = Derive.deriveStructural({
    name:'Rogue', alignment:null, portrait:null, abilities:ROGUE_ABIL,
    classes:[{ model:ROGUE, level:3, subclassShortName:'Soulknife' }],
    race:{ name:'Yuan-Ti' }, subraceName:null, background:{ name:'Hermit' },
    spells:RACIAL, spellbook:[], choices:[], feats:[], hp:undefined
  }, { engine:Engine, spellcasting:SC });
  const st = r.structural || {};
  ok('structural.spellcasting exists (anyCaster caught the race)', !!st.spellcasting, Object.keys(st));
  ok('spellcasting.saveDC = 13', st.spellcasting && st.spellcasting.saveDC === 13, st.spellcasting && st.spellcasting.saveDC);
  ok('spellcasting.ability = Charisma', st.spellcasting && st.spellcasting.ability === 'Charisma', st.spellcasting && st.spellcasting.ability);
  ok('combat.spellSaveDC threaded to 13', st.combat && st.combat.spellSaveDC === 13, st.combat && st.combat.spellSaveDC);
  const flat = st.spellcasting ? (st.spellcasting.groups || []).flatMap(g => g.spells) : [];
  ok('three racial spells on the structural', flat.length === 3, flat.map(s => s.name));
}

console.log('\n' + (fail === 0 ? '\u2713 ALL PASS' : '\u2717 ' + fail + ' FAILED') + '  (' + pass + ' passed)');
process.exit(fail === 0 ? 0 : 1);
