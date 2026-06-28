/* mc-ui-smoke.js — drives the SHIPPED multiclass Class-step code (extracted from
 * shards.html) through render + interaction in jsdom, asserting draft.classes mutates
 * correctly. Validates the UI render+binding that node --check can't catch. */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const src = fs.readFileSync('/mnt/user-data/outputs/shards.html', 'utf8');

// ── extract the real chunks ──
function sliceToLineEnd(s, startMarker, endMarker){
  const a = s.indexOf(startMarker); if (a < 0) throw new Error('start missing: ' + startMarker);
  const b = s.indexOf(endMarker, a); if (b < 0) throw new Error('end missing: ' + endMarker);
  return s.slice(a, s.indexOf('\n', b));
}
function extractMethod(s, objMarker, methodName){
  const objAt = s.indexOf(objMarker); if (objAt < 0) throw new Error('obj missing: ' + objMarker);
  const mAt = s.indexOf(methodName + ': function(', objAt); if (mAt < 0) throw new Error('method missing: ' + methodName);
  const fnAt = s.indexOf('function(', mAt);
  let depth = 0, i = s.indexOf('{', fnAt);
  for (; i < s.length; i++){ const ch = s[i]; if (ch === '{') depth++; else if (ch === '}'){ depth--; if (!depth){ i++; break; } } }
  return s.slice(fnAt, i);
}
const helpers = sliceToLineEnd(src, 'function classDef(n){', 'var mcAddOpen = false;');
const bodiesClassSrc = extractMethod(src, 'var BODIES = {', 'class');
const mountClassSrc  = extractMethod(src, 'var MOUNT = {', 'class');
console.log('extracted: helpers ' + helpers.length + ' chars, BODIES.class ' + bodiesClassSrc.length + ', MOUNT.class ' + mountClassSrc.length);

// ── jsdom + stubs ──
const dom = new JSDOM('<!DOCTYPE html><body><div id="body"></div></body>');
const { window } = dom;
global.window = window; global.document = window.document;

const q = (sel) => document.querySelector(sel);
const escHtml = (x) => String(x).replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
const excludeClass = (n) => /sidekick/i.test(n);
const renderEngineOut = () => {};
const injectMcCss = () => {};
let saveCount = 0; const saveDraft = () => { saveCount++; };

const DATA = { classes: [
  { n:'Warlock',  subs:[{n:'The Hexblade'},{n:'The Fiend'}],            subAt:1, subTitle:'Otherworldly Patron' },
  { n:'Sorcerer', subs:[{n:'Shadow Magic'},{n:'Draconic Bloodline'}],   subAt:1, subTitle:'Sorcerous Origin' },
  { n:'Fighter',  subs:[{n:'Champion'},{n:'Battle Master'}],            subAt:3, subTitle:'Martial Archetype' }
]};
const draft = { classes:[
  { n:'Warlock',  level:2, subclass:{n:'The Hexblade'}, starting:true  },
  { n:'Sorcerer', level:1, subclass:{n:'Shadow Magic'}, starting:false }
], cls:null, subclass:null, level:1 };

let api;
const renderAll = () => { document.getElementById('body').innerHTML = api.BODIESclass(); api.MOUNTclass(); };
const factory = new Function(
  'draft','DATA','q','escHtml','excludeClass','renderEngineOut','injectMcCss','saveDraft','renderAll',
  helpers + '\nreturn { BODIESclass: ' + bodiesClassSrc + ', MOUNTclass: ' + mountClassSrc +
  ', get mcAddOpen(){return mcAddOpen}, set mcAddOpen(v){mcAddOpen=v} };'
);
api = factory(draft, DATA, q, escHtml, excludeClass, renderEngineOut, injectMcCss, saveDraft, renderAll);

// ── helpers for the test ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));
const click = (el) => el.dispatchEvent(new window.Event('click', { bubbles:true }));
const change = (el) => el.dispatchEvent(new window.Event('change', { bubbles:true }));
const find = (n) => draft.classes.filter(c => c.n === n)[0];
let pass = 0, fail = 0;
const ok = (label, cond, detail) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); } };

// ── initial render (2-class build) ──
renderAll();
ok('renders 2 rows', $$('.mc-row').length === 2, $$('.mc-row').length);
ok('starting badge present', /Starting/.test(($('.mc-badge') || {}).textContent || ''), ($('.mc-badge') || {}).textContent);
ok('badge is on Warlock row', /Warlock/.test(($('.mc-row.is-start .mc-cn') || {}).textContent || ''), ($('.mc-row.is-start .mc-cn') || {}).textContent);
ok('character level total = 3', ($('.mc-total b') || {}).textContent === '3', ($('.mc-total b') || {}).textContent);
ok('Add button present (picker closed)', !!$('#mc-add'), null);
ok('subclass selects rendered (both L1 patrons unlocked)', $$('.mc-sub').length === 2, $$('.mc-sub').length);
ok('Warlock subclass selected = Hexblade', ($$('.mc-sub')[0].value) === 'The Hexblade', $$('.mc-sub')[0].value);

// ── raise Warlock level via "+" stepper ──
click($('.mc-step[data-i="0"][data-d="1"]'));
ok('Warlock level -> 3 after +', find('Warlock').level === 3, find('Warlock').level);
ok('total recomputed -> 4', ($('.mc-total b') || {}).textContent === '4', ($('.mc-total b') || {}).textContent);

// ── type Sorcerer level directly ──
const sLvl = $('.mc-lvl-n[data-i="1"]'); sLvl.value = '5'; change(sLvl);
ok('Sorcerer level -> 5 via input', find('Sorcerer').level === 5, find('Sorcerer').level);

// ── set Sorcerer as starting ──
click($('.mc-first[data-i="1"]'));
ok('Sorcerer now starting', find('Sorcerer').starting === true, null);
ok('Warlock no longer starting', find('Warlock').starting === false, null);
ok('mirror: draft.cls -> Sorcerer', !!draft.cls && draft.cls.n === 'Sorcerer', draft.cls && draft.cls.n);
ok('mirror: draft.level -> 5 (starting class level)', draft.level === 5, draft.level);
ok('Sorcerer row now first (is-start)', /Sorcerer/.test(($('.mc-row.is-start .mc-cn') || {}).textContent || ''), ($('.mc-row.is-start .mc-cn') || {}).textContent);

// ── remove Warlock (now the non-starting row at index 1) ──
click($('.mc-rm[data-i="1"]'));
ok('one class left after remove', draft.classes.length === 1, draft.classes.length);
ok('remaining class is Sorcerer', draft.classes[0].n === 'Sorcerer', draft.classes[0].n);
ok('solo: no badge, no remove', $$('.mc-row').length === 1 && !$('.mc-badge') && !$('.mc-rm'), { rows:$$('.mc-row').length, badge:!!$('.mc-badge'), rm:!!$('.mc-rm') });

// ── open Add picker ──
click($('#mc-add'));
ok('picker opens', !!$('.mc-picker'), null);
const pnames = $$('.mc-pn').map(e => e.textContent);
ok('picker excludes taken (Sorcerer) ', pnames.indexOf('Sorcerer') === -1, pnames);
ok('picker offers Warlock + Fighter', pnames.indexOf('Warlock') !== -1 && pnames.indexOf('Fighter') !== -1, pnames);

// ── add Fighter ──
click($('.mc-padd[data-n="Fighter"]'));
ok('two classes after add', draft.classes.length === 2, draft.classes.length);
ok('added Fighter is NOT starting', find('Fighter') && find('Fighter').starting === false, find('Fighter'));
ok('Sorcerer still starting', find('Sorcerer').starting === true, null);
ok('Fighter L1 (<subAt 3): subclass locked, shows hint', (() => { const r = $$('.mc-row').find(x => /Fighter/.test(x.textContent)); return r && !r.querySelector('.mc-sub') && !!r.querySelector('.mc-subhint'); })(), null);
ok('picker closed after add', !$('.mc-picker') && !!$('#mc-add'), null);

// ── empty build path ──
draft.classes = []; api.mcAddOpen = false; renderAll();
ok('empty: no rows', $$('.mc-row').length === 0, null);
ok('empty: picker auto-shows "Choose a starting class"', /Choose a starting class/.test(($('.mc-pick-h') || {}).textContent || ''), ($('.mc-pick-h') || {}).textContent);
click($('.mc-padd[data-n="Warlock"]'));
ok('empty: first add becomes starting', draft.classes.length === 1 && draft.classes[0].n === 'Warlock' && draft.classes[0].starting === true, draft.classes);

console.log('\nclass-step UI smoke: ' + pass + ' passed, ' + fail + ' failed  (saveDraft called ' + saveCount + 'x)');
process.exit(fail ? 1 : 0);
