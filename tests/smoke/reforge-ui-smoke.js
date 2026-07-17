/* reforge-ui-smoke.js — drives the SHIPPED reforge UI glue (extracted from shards.html)
 * in jsdom: mountForgeControls wiring, populateLoadMenu rows + tags, loadIntoBuilder for a
 * saved build and a reverse-mapped one, the edit strip + detach, and the New→Clear reset. */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const src = fs.readFileSync('/mnt/user-data/outputs/shards.html', 'utf8');

function fn(name){
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('missing fn: ' + name);
  let depth = 0, i = src.indexOf('{', at);
  for (; i < src.length; i++){ const c = src[i]; if (c === '{') depth++; else if (c === '}'){ depth--; if (!depth){ i++; break; } } }
  return src.slice(at, i);
}
const helpers = (() => { const a = src.indexOf('function classDef(n){'), b = src.indexOf('var mcAddOpen = false;', a); return src.slice(a, src.indexOf('\n', b)); })();
const body = [helpers, fn('classDefCaster'), fn('classIsCaster'), fn('casterClasses'),
  fn('ensureSpellBucket'), fn('migrateSpells'),
  fn('freshDraft'), fn('normalizeDraft'), fn('buildSnapshot'), fn('loadBuildIntoDraft'),
  fn('resetDraft'), fn('reverseMapStructural'), fn('loadIntoBuilder'), fn('renderEditStrip'),
  fn('populateLoadMenu'), fn('mountForgeControls'), fn('injectBldCss')].join('\n');
const SUBCLASS_CASTERS = { 'Eldritch Knight':{progression:'1/3'}, 'Arcane Trickster':{progression:'1/3'} };

const dom = new JSDOM('<!DOCTYPE html><body>' +
  '<input id="charName"><div class="bld-actions">' +
  '<button id="bld-new"></button><button id="bld-load"></button>' +
  '<div class="bld-menu" id="bld-menu" hidden><div id="bld-menu-list"></div></div>' +
  '<div class="bld-confirm" id="bld-confirm" hidden><button id="bld-cancel"></button><button id="bld-clear"></button></div>' +
  '</div><div class="bld-strip" id="bld-strip" hidden></div>' +
  '<div class="panel-scroll"></div></body>');
const { window } = dom;
global.window = window; global.document = window.document;

const q = (s) => document.querySelector(s);
const escHtml = (x) => String(x).replace(/[&<>]/g, c => c==='&'?'&amp;':c==='<'?'&lt;':'&gt;');
const ensureSlots = () => {};
let saveCount = 0; const saveDraft = () => { saveCount++; };
const DATA = { classes: [
  { n:'Warlock', caster:'pact', subs:[{n:'The Hexblade'}], subAt:1, subTitle:'Otherworldly Patron' },
  { n:'Sorcerer', caster:'full', subs:[{n:'Shadow Magic'}], subAt:1, subTitle:'Sorcerous Origin' },
  { n:'Bard', caster:'full', subs:[{n:'College of Lore'}], subAt:3, subTitle:'Bard College' },
  { n:'Cleric', caster:'full', subs:[{n:'Life Domain'}], subAt:1, subTitle:'Divine Domain' }
], races:[{n:'Astral Elf',s:'AAG'}], backgrounds:[{n:'Sage',s:'PHB'}] };

const cosmereBuild = { name:'Cosmere Runestar', species:{n:'Astral Elf',s:'AAG'},
  abilities:{str:8,dex:14,con:14,int:10,wis:11,cha:17},
  classes:[{n:'Warlock',level:2,subclass:{n:'The Hexblade'},starting:true},{n:'Sorcerer',level:1,subclass:{n:'Shadow Magic'},starting:false}],
  bg:{n:'Sage',s:'PHB'}, spells:{cantrips:['Eldritch Blast'],known:[],prepared:[],spellbook:[]} };
const rows = [
  { key:'cosmere', name:'Cosmere Runestar', structural:{ classLabel:'Warlock 2 / Sorcerer 1', _build: cosmereBuild } },
  { key:'liadan',  name:'Líadan Luchóg',    structural:{ classLabel:'Bard 2 / Cleric 1',
      classes:[{name:'Bard',level:2,subclass:'College of Lore'},{name:'Cleric',level:1,subclass:'Life Domain'}], race:'Astral Elf', background:'Sage' } }
];
const CharacterData = {
  loadParty: () => Promise.resolve(rows),
  loadCharacter: (key) => Promise.resolve(rows.filter(r => r.key === key)[0] || null)
};

const draft = {};
let api;
const renderAll = () => { if (api) api.renderEditStrip(); };
api = new Function('draft','DATA','SUBCLASS_CASTERS','CharacterData','q','escHtml','saveDraft','renderAll','ensureSlots',
  body + '\nreturn { mountForgeControls, renderEditStrip, loadIntoBuilder, resetDraft };')(
  draft, DATA, SUBCLASS_CASTERS, CharacterData, q, escHtml, saveDraft, renderAll, ensureSlots);

const click = (el) => el.dispatchEvent(new window.Event('click', { bubbles:true }));
const tick = () => new Promise(r => setTimeout(r, 0));
let pass = 0, fail = 0;
const ok = (l, c, d) => { if (c) pass++; else { fail++; console.log('FAIL ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  api.mountForgeControls();

  // open the Load menu → populated from loadParty
  click(q('#bld-load'));
  ok('menu opens', q('#bld-menu').hidden === false, null);
  await tick();
  const mrows = Array.prototype.slice.call(document.querySelectorAll('.bld-mrow'));
  ok('menu lists 2 characters', mrows.length === 2, mrows.length);
  ok('Cosmere tagged saved build', /saved/.test(mrows[0].querySelector('.bld-tag').className), mrows[0].querySelector('.bld-tag').className);
  ok('Líadan tagged from sheet', /sheet/.test(mrows[1].querySelector('.bld-tag').className), mrows[1].querySelector('.bld-tag').className);

  // load Cosmere (saved build) → lossless restore + target + strip
  click(mrows[0]); await tick();
  ok('loaded name', draft.name === 'Cosmere Runestar', draft.name);
  ok('loaded classes (from _build)', JSON.stringify(draft.classes) === JSON.stringify(cosmereBuild.classes), draft.classes);
  ok('loaded abilities', JSON.stringify(draft.abilities) === JSON.stringify(cosmereBuild.abilities), draft.abilities);
  ok('edit target set', draft._editKey === 'cosmere' && draft._editSource === 'saved', { k:draft._editKey, s:draft._editSource });
  ok('strip visible', q('#bld-strip').hidden === false, null);
  ok('strip names character', /Cosmere Runestar/.test(q('#bld-strip').textContent), q('#bld-strip').textContent);
  ok('saved load shows no confirm chips', !q('#bld-strip').querySelector('.bld-chip'), null);
  ok('mirror draft.cls -> Warlock', !!draft.cls && draft.cls.n === 'Warlock', draft.cls && draft.cls.n);

  // re-open + load Líadan (no _build) → reverse-map + confirm chips
  click(q('#bld-load')); await tick();
  const mrows2 = Array.prototype.slice.call(document.querySelectorAll('.bld-mrow'));
  click(mrows2[1]); await tick();
  ok('reverse-map classes (Bard starting, Cleric)', JSON.stringify(draft.classes) === JSON.stringify([
    {n:'Bard',level:2,subclass:{n:'College of Lore'},starting:true},
    {n:'Cleric',level:1,subclass:{n:'Life Domain'},starting:false}
  ]), draft.classes);
  ok('reverse-map species', JSON.stringify(draft.species) === JSON.stringify({n:'Astral Elf',s:'AAG'}), draft.species);
  ok('reverse-map background', JSON.stringify(draft.bg) === JSON.stringify({n:'Sage',s:'PHB'}), draft.bg);
  ok('edit source = sheet', draft._editSource === 'sheet', draft._editSource);
  ok('strip shows confirm chips', q('#bld-strip').querySelectorAll('.bld-chip').length === 2, q('#bld-strip').querySelectorAll('.bld-chip').length);

  // detach → target cleared, strip hidden
  click(q('#bld-detach')); await tick();
  ok('detach clears target', draft._editKey === undefined, draft._editKey);
  ok('detach hides strip', q('#bld-strip').hidden === true, null);

  // New → confirm → Clear → blank
  click(q('#bld-new'));
  ok('New shows confirm', q('#bld-confirm').hidden === false, null);
  click(q('#bld-clear')); await tick();
  ok('reset empties classes', Array.isArray(draft.classes) && draft.classes.length === 0, draft.classes);
  ok('reset clears name', draft.name == null, draft.name);
  ok('reset confirm closed', q('#bld-confirm').hidden === true, null);

  console.log('\nreforge UI smoke: ' + pass + ' passed, ' + fail + ' failed  (saveDraft ' + saveCount + 'x)');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('SMOKE ERROR:', e && e.stack || e); process.exit(2); });
