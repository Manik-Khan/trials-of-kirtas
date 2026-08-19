/* smoke-level-up-focus.mjs — guarded focused Level Up + per-source casting profiles. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Engine = require('../../soul-shards-engine.js');
const Spellcasting = require('../../soul-shards-spellcasting.js');
const Data = require('../../soul-shards-data.js');

let pass = 0, fail = 0;
const ok = (label, condition) => { if (condition) pass++; else { fail++; console.error('FAIL:', label); } };
function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('Missing function ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('Unclosed function ' + name);
}

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
ok('staging doorway cache-stamps inline spell descriptions', /staging=lu6/.test(staging));
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
ok('Bardic Versatility has an explicit optional cantrip control', /data-cantrip-replace-toggle/.test(html) && /data-cantrip-replace-from/.test(html) && /data-cantrip-replace-to/.test(html));
ok('Bardic Versatility is separate from the newly gained cantrip', /This is separate from the new cantrip gained at Bard level 4/.test(html));
ok('an enabled partial Bardic Versatility choice gates completion', /Bardic Versatility cantrip replacement/.test(html) && /replacement\.enabled && \(!replacement\.from \|\| !replacement\.to\)/.test(html));
ok('Bardic Versatility completion does not depend on the visible caster tab', /var hasVersatility = focusedLevelUp\(\) && lu && lu\.className === 'Bard'/.test(html));
ok('the cantrip replacement is applied as an exact remove and add', /arr\.splice\(fromAt, 1\)/.test(html) && /arr\.push\(next\.to\)/.test(html));
const replacementDraft = { _levelUp:{} };
const replacementPicks = ['Prestidigitation', 'Vicious Mockery', 'Mage Hand'];
const replacementOriginal = ['Prestidigitation', 'Vicious Mockery'];
let replacementSaves = 0, replacementRenders = 0;
const setCantripReplacement = new Function(
  'draft', 'pickedFor', 'originalLevelPicks', 'cantripReplacementState', 'capFor', 'saveDraft', 'render',
  extractFunction(html, 'setCantripReplacement') + '; return setCantripReplacement;'
)(
  replacementDraft,
  () => replacementPicks,
  () => replacementOriginal,
  () => ({ enabled:!!replacementDraft._levelUp.cantripReplacement?.enabled, from:replacementDraft._levelUp.cantripReplacement?.from || '', to:replacementDraft._levelUp.cantripReplacement?.to || '' }),
  () => 3,
  () => { replacementSaves++; },
  () => { replacementRenders++; },
);
setCantripReplacement({ enabled:true, from:'Prestidigitation', to:'Minor Illusion' });
ok('real replacement function swaps exactly one cantrip', !replacementPicks.includes('Prestidigitation') && replacementPicks.includes('Minor Illusion') && replacementPicks.length === 3);
setCantripReplacement({ enabled:false, from:'', to:'' });
ok('real replacement function restores the original when cancelled', replacementPicks.includes('Prestidigitation') && !replacementPicks.includes('Minor Illusion') && replacementPicks.length === 3);
ok('real replacement function persists and rerenders each change', replacementSaves === 2 && replacementRenders === 2);
ok('spell and advancement decisions gate completion', /SpellsUI\.incomplete/.test(html) && /FeatsUI\.incomplete/.test(html));
ok('Next validates the current focused step before advancing', /if \(!validateStepExit\(draft\.stepId\)\) return/.test(html));
ok('focused rail navigation cannot skip past the next unresolved step', /if \(target > current \+ 1\) id = act\[current \+ 1\]\.id/.test(html));
ok('unfinished choices produce an accessible departure notice', /step-gate-notice/.test(html) && /setAttribute\('role', 'alert'\)/.test(html));
ok('spell omissions highlight their status and level tabs', /mark\('\.statusline'\)/.test(html) && /mark\('\.lvltab\.cantrip'\)/.test(html) && /mark\('\.lvltab:not\(\.cantrip\)'\)/.test(html));
ok('feat omissions highlight the feat ability and granted-spell areas', /mark\('\.ft-half'\)/.test(html) && /mark\('\.ft-spells'\)/.test(html));
ok('spell details narrate target save and source DC', /vs ' \+ esc\(profile\.cls\) \+ ' DC/.test(html));
ok('feat spells block completion until their nested choice is resolved', /Choose the 1st-level Divination or Enchantment spell granted by Fey Touched/.test(html) && /FeatsUI\.incomplete/.test(html));
ok('feat spell completion derives from the feat schema before detail hydration finishes', /var spellSpec = featSpellSpec\(f\)/.test(html) && /!e\.featSpells \|\| !e\.featSpells\[i\]/.test(html));
ok('feat spell rendering owns its school labels inside FeatsUI', /var FEAT_SCHOOL = \{ A:'Abjuration'/.test(html) && /FEAT_SCHOOL\[sp\.school\]/.test(html));
ok('Fey Touched reuses the established spell-selection window', /class="sp-stage ft-spell-stage"/.test(html) && /class="sp-tbl"/.test(html) && /SpellsUI\.detailTableRow\(SpellsUI\.detailCard\(sp, 'o-feat'/.test(html));
const featDraft = { spells:{ byClass:{ Bard:{ cantrips:[], known:['Charm Person'], prepared:[], spellbook:[] }, Cleric:{ cantrips:[], known:[], prepared:['Bless'], spellbook:[] } } } };
const featSlot = { kind:'feat', name:'Fey Touched', abils:{ cha:1 }, featSpells:{} };
const featSpellData = { L4:{
  fixed:[{ name:'Misty Step', level:2, school:'C', entries:['Teleport.'] }],
  choices:[{ options:[
    { name:'Gift of Alacrity', level:1, school:'D', entries:['Add 1d8 to initiative.'], _featClassLists:[] },
    { name:'Charm Person', level:1, school:'E', savingThrow:['wisdom'], entries:['A humanoid makes a saving throw.'], _featClassLists:['Bard'] },
    { name:'Command', level:1, school:'E', savingThrow:['wisdom'], entries:['Speak a command.'], _featClassLists:['Cleric'] },
  ] }],
} };
const featRenderer = new Function(
  'draft', '_featSpellData', 'slot', 'totalLevel', 'effectiveAbilities', '_race', 'esc', 'FEAT_SCHOOL', '_featSpellOpen', 'SpellsUI', '_featSpellQuery',
  [extractFunction(html, 'featKnownBy'), extractFunction(html, 'featSpellAvailability'), extractFunction(html, 'featSpellRow'), extractFunction(html, 'featSpellSub')].join('\n') +
    '; return { featSpellAvailability:featSpellAvailability, featSpellSub:featSpellSub };'
)(
  featDraft,
  featSpellData,
  () => featSlot,
  () => 5,
  () => ({ cha:18 }),
  null,
  x => String(x),
  { C:'Conjuration', D:'Divination', E:'Enchantment' },
  { k:'L4', gi:0, name:'Gift of Alacrity' },
  {
    detailCard:(sp, origin, casting) => `<div class="detail ${origin}">${sp.name} · ${casting.cls} DC ${casting.saveDC}</div>`,
    detailTableRow:markup => `<tr class="sp-detail-row"><td colspan="5">${markup}</td></tr>`,
  },
  {},
);
const featSpellMarkup = featRenderer.featSpellSub('L4', { name:'Fey Touched' });
ok('real feat spell renderer shows Gift of Alacrity in the complete choice window', /Gift of Alacrity/.test(featSpellMarkup) && /Divination/.test(featSpellMarkup));
ok('real feat spell renderer shows the chosen-ability DC', /WIS save · CHA DC 15/.test(featSpellMarkup) && /Fey Touched DC 15/.test(featSpellMarkup));
ok('real feat spell renderer distinguishes known, overlapping, and feat-only spells', /already known · Bard/.test(featSpellMarkup) && /also on Cleric list/.test(featSpellMarkup) && /Fey Touched only/.test(featSpellMarkup));
ok('known class spells remain selectable as a separate Fey Touched source', /data-fspell="Charm Person"/.test(featSpellMarkup) && /separate source/.test(featSpellMarkup));
ok('the open Fey Touched description sits directly beneath its spell row', /Gift of Alacrity[\s\S]*<\/tr><tr class="sp-detail-row"><td colspan="5"><div class="detail o-feat">Gift of Alacrity · Fey Touched DC 15/.test(featSpellMarkup));
const detailTableRow = new Function(extractFunction(html, 'detailTableRow') + '; return detailTableRow;')();
ok('shared spell descriptions render as full-width table rows', detailTableRow('<div class="detail">Spell information</div>') === '<tr class="sp-detail-row"><td colspan="5"><div class="detail">Spell information</div></td></tr>');
const regularSpellRow = new Function(
  '_detail', '_openDetail', 'esc', 'levelSpellToggleAllowed', 'cantripReplacementState', '_ent', 'tipFor', 'SCHOOL', 'flagsFor', 'detailTableRow', 'detailCard',
  extractFunction(html, 'spellRow') + '; return spellRow;'
)(
  { 'Charm Person':{ name:'Charm Person', level:1, school:'E', savingThrow:['wisdom'] } },
  { name:'Charm Person', attr:'known' },
  x => String(x),
  () => true,
  () => null,
  { cls:'Bard', saveDC:15 },
  () => '',
  { E:'Enchantment' },
  () => '',
  detailTableRow,
  sp => `<div class="detail">${sp.name} information</div>`,
);
const regularSpellMarkup = regularSpellRow({ name:'Charm Person', level:1, school:'E', savingThrow:['wisdom'] }, { on:false, capped:false, have:false, haveTag:'', oclass:'o-class', attr:'known' });
ok('the regular spell picker also keeps an open description with its row', /Charm Person[\s\S]*<\/tr><tr class="sp-detail-row"><td colspan="5"><div class="detail">Charm Person information/.test(regularSpellMarkup));
const halfFeatSub = new Function('slot', 'ABBR', extractFunction(html, 'halfFeatSub') + '; return halfFeatSub;')(
  () => ({ kind:'feat', name:'Fey Touched', abils:{ cha:1 }, featSpells:{} }),
  { str:'STR', dex:'DEX', con:'CON', int:'INT', wis:'WIS', cha:'CHA' },
);
const halfFeatMarkup = halfFeatSub('L4', { ability:{ choose:{ from:['int','wis','cha'], amount:1 } } });
ok('real half-feat renderer redraws the selected ability button', /class="ft-ab on" data-k="L4" data-half="cha"/.test(halfFeatMarkup));
const levelGapText = new Function(extractFunction(html, 'levelGapText') + '; return levelGapText;')();
ok('new Bard cantrip omission is narrated exactly', levelGapText('new Bard cantrip (1 missing)') === 'Choose one new Bard cantrip.');
ok('new Bard spell omission is narrated exactly', levelGapText('new Bard spell known (1 missing)') === 'Choose one new Bard spell.');
ok('Fey Touched ability omission is narrated exactly', /Intelligence, Wisdom, or Charisma/.test(levelGapText('Fey Touched ability')));
ok('Fey Touched spell omission is narrated exactly', /1st-level Divination or Enchantment spell/.test(levelGapText('Fey Touched spell')));
ok('changed modules have fresh cache stamps', /soul-shards-data\.js\?v=lu2/.test(html) && /soul-shards-engine\.js\?v=lu1/.test(html) && /soul-shards-spellcasting\.js\?v=lu1/.test(html) && /soul-shards-derive\.js\?v=lu1/.test(html));

console.log(`\nsmoke-level-up-focus: ${pass}/${pass + fail} passed`);
if (fail) process.exit(1);
