/* smoke-level-up-focus.mjs — guarded focused Level Up + per-source casting profiles. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Engine = require('../../soul-shards-engine.js');
const Spellcasting = require('../../soul-shards-spellcasting.js');
const Data = require('../../soul-shards-data.js');

let pass = 0, fail = 0;
const ok = (label, condition) => { if (condition) pass++; else { fail++; console.error('FAIL:', label); } };

const model = {
  name:'Bard', source:'PHB', hd:8, savingThrows:['dex','cha'], subclassTitle:'Bard College',
  subclasses:[], featuresByLevel:{ 1:[], 2:[], 3:[], 4:[], 5:[{ name:'Font of Inspiration', level:5, originType:'class', origin:'class:Bard', entries:['Refreshes on a short rest.'] }] },
  subclassUnlockLevel:3, optFeatureProg:[], casterProgression:'full', spellAbility:'cha', prepared:false,
  cantripsProgression:[2,2,2,3,3], spellsKnownProgression:[4,5,6,7,8], slotsProgression:[[2],[3],[4,2],[4,3],[4,3,2]],
};
const hp = { method:'average', byClass:{ Bard:{ 5:{ method:'roll', roll:7 } } } };
const built = Engine.build({ classModel:model, level:5, abilities:{ con:14, cha:18 }, hp, hpKey:'Bard' });
ok('new Bard level uses its per-level roll', built.hp.byLevel[4].base === 7 && built.hp.byLevel[4].kind === 'roll');
ok('earlier Bard levels remain average', built.hp.byLevel[1].base === 5 && built.hp.byLevel[1].kind === 'average');

const sc = Spellcasting.deriveSpellcasting({
  totalLevel:5, abilities:{ cha:18, wis:14 },
  classes:[
    { name:'Bard', level:4, progression:'full', ability:'cha', prepared:false },
    { name:'Cleric', level:1, progression:'full', ability:'wis', prepared:true },
  ],
  spells:[
    { name:'Suggestion', level:2, origin:'class', source:'Bard', ability:'cha', savingThrow:['wisdom'] },
    { name:'Command', level:1, origin:'class', source:'Cleric', ability:'wis' },
  ],
});
ok('one casting profile is emitted per caster', sc.profiles.length === 2);
ok('Bard profile uses CHA and character proficiency', sc.profiles.find(p => p.id === 'class:Bard').saveDC === 15);
ok('Cleric profile uses WIS independently', sc.profiles.find(p => p.id === 'class:Cleric').saveDC === 13);
const flat = sc.groups.flatMap(g => g.spells);
ok('Bard spell binds to Bard profile', flat.find(s => s.name === 'Suggestion').castingProfileId === 'class:Bard');
ok('saving-throw metadata survives into the structural spell row', flat.find(s => s.name === 'Suggestion').savingThrow[0] === 'wisdom');
ok('Cleric spell binds to Cleric profile', flat.find(s => s.name === 'Command').castingProfileId === 'class:Cleric');
const shapedFeat = Data.featsForChar([{ name:'Fey Touched', source:'TCE', additionalSpells:[{ ability:'inherit', innate:{ _:{ daily:{ '1e':['misty step',{ choose:'level=1|school=E;D' }] } } } }], entries:['Choose a spell.'] }], { abilities:{}, level:5, caster:true })[0];
ok('feat picker carries the real additional-spell schema', shapedFeat.additionalSpells[0].innate._.daily['1e'][1].choose === 'level=1|school=E;D');

const html = readFileSync(new URL('../../shards.html', import.meta.url), 'utf8');
const staging = readFileSync(new URL('../../staging/level-up-liadan.html', import.meta.url), 'utf8');
ok('same-site staging doorway exists for Liadan', /Líadan · Level Up Staging/.test(staging));
ok('staging doorway opens the guarded focused flow', /shards\.html\?mode=level-up(?:&amp;|&)character=liadan(?:&amp;|&)class=Bard(?:&amp;|&)levelFlow=1/.test(staging));
ok('staging doorway is not indexed', /name="robots" content="noindex,nofollow"/.test(staging));
ok('staging doorway does not replace the regular Level Up route', /regular Level Up route remains unchanged/.test(staging));
ok('focused Level Up is guarded by levelFlow=1', /LEVEL_UP_FOCUS = SHARDS_PARAMS\.get\('levelFlow'\) === '1'/.test(html));
ok('regular Reforger remains the unflagged path', /function focusedLevelUp\(\)\{ return !!\(LEVEL_UP_FOCUS && draft\._levelUp\); \}/.test(html));
ok('focused rail excludes creation-only steps', /\['class','choices','feats','spells','review'\]/.test(html));
ok('focused class screen does not render editable class controls', /if \(focusedLevelUp\(\)\) return levelUpClassBody\(\)/.test(html));
ok('focused shell hides builder switching and locks the name', /body\.lu-focus \.bld-actions\{display:none\}/.test(html) && /nf\.disabled = focusedLevelUp\(\)/.test(html));
ok('new HP choice is stored under class and class level', /byClass\[lu\.className\] = levels/.test(html) && /levels\[lu\.toClassLevel\]/.test(html));
ok('focused HP requires an explicit average-or-roll choice', /if \(focusedLevelUp\(\)\) return \{ method:null \}/.test(html) && /Choose average hit points or roll/.test(html));
ok('pre-level spell picks are snapshotted before the class advances', /originalSpells: JSON\.parse\(JSON\.stringify\(draft\.spells/.test(html));
ok('focused spell picker locks non-advancing classes', /_active !== lu\.className\) return false/.test(html));
ok('Bard replacements are explicitly budgeted', /optionally replace one/.test(html) && /Bardic Versatility may replace one cantrip/.test(html));
ok('spell and advancement decisions gate completion', /SpellsUI\.incomplete/.test(html) && /FeatsUI\.incomplete/.test(html));
ok('spell details narrate target save and source DC', /vs ' \+ esc\(_ent\.cls\) \+ ' DC/.test(html));
ok('feat spells block completion until their nested choice is resolved', /Finish the spell choice granted by/.test(html) && /FeatsUI\.incomplete/.test(html));
ok('changed modules have fresh cache stamps', /soul-shards-data\.js\?v=lu1/.test(html) && /soul-shards-engine\.js\?v=lu1/.test(html) && /soul-shards-spellcasting\.js\?v=lu1/.test(html) && /soul-shards-derive\.js\?v=lu1/.test(html));

console.log(`\nsmoke-level-up-focus: ${pass}/${pass + fail} passed`);
if (fail) process.exit(1);
