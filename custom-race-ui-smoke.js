/* custom-race-ui-smoke.js — renders the Phase-1 custom (homebrew) race builder in jsdom
 * and drives every interaction, asserting that the model mutates correctly.
 *
 * Run from the repo root:  node custom-race-ui-smoke.js     (requires jsdom on NODE_PATH)
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = __dirname;

const html = fs.readFileSync(path.join(ROOT, 'shards.html'), 'utf8');
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const src = inline.reduce((a, b) => (b.length > a.length ? b : a), '');

const start = src.indexOf('var SpeciesUI = (function');
const endTok = '\n})();';
const end = src.indexOf(endTok, start);
const iife = src.slice(start, end + endTok.length);

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="species-out"></div></body></html>');
const document = dom.window.document;
const ABILS = ['str','dex','con','int','wis','cha'];
const ABN = {str:'STR',dex:'DEX',con:'CON',int:'INT',wis:'WIS',cha:'CHA'};
let draft = {};
const escHtml = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const q = sel => document.querySelector(sel);
const saveDraft = () => {};

let SpeciesUI;
eval('SpeciesUI = ' + iife.replace(/^var SpeciesUI = /, ''));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  \u2713 ' + n); } else { fail++; console.log('  \u2717 ' + n); } };
const fire = (el, type) => el.dispatchEvent(new dom.window.Event(type, { bubbles: true }));

draft.species = SpeciesUI.freshCustomSpecies();
draft.subrace = null; draft.asi = {}; draft.size = null; draft.originMode = 'std'; draft.useFloating = false; draft.openTrait = null;
SpeciesUI.renderSpeciesOut();
const m = draft.species.model;

ok('builder rendered (.cr-box)', !!q('.cr-box'));
ok('CSS injected (#cr-css)', !!document.getElementById('cr-css'));
ok('starts in no-increase mode', !!q('.cr-none'));

const nameEl = q('#cr-name'); nameEl.value = 'Mouseling'; fire(nameEl, 'input');
ok('name updates model + draft.species.n', m.name === 'Mouseling' && draft.species.n === 'Mouseling');

q('[data-cr-mode="fixed"]').click();
ok('asiMode -> fixed', m.asiMode === 'fixed');
ok('fixed rows rendered', !!q('.cr-asirow'));
ok('default rows seeded (2)', (m._bonusRows || []).length === 2);

let amt = document.querySelector('[data-cr-bi="0"][data-cr-bf="amount"]'); amt.value = '2'; fire(amt, 'change');
let abil = document.querySelector('[data-cr-bi="0"][data-cr-bf="ability"]'); abil.value = 'cha'; fire(abil, 'change');
ok('row0 -> +2 cha in abilityBonuses', m.abilityBonuses.cha === 2);

q('[data-cr-mode="none"]').click();
ok('asiMode -> none clears bonuses', JSON.stringify(m.abilityBonuses) === '{}');

let sz = q('#cr-size'); sz.value = 'Small'; fire(sz, 'change');
let spd = q('#cr-speed'); spd.value = '20'; fire(spd, 'change');
let dk = q('#cr-dark'); dk.value = '0'; fire(dk, 'change');
ok('size Small / speed 20 / darkvision null', m.size === 'Small' && m.speed.walk === 20 && m.darkvision === null);
let dk2 = q('#cr-dark'); dk2.value = '60'; fire(dk2, 'change');
ok('darkvision 60 stored', m.darkvision === 60);

let li = q('#cr-lang-in'); li.value = 'Sylvan'; q('#cr-lang-add').click();
ok('language Sylvan added', m.languages.fixed.indexOf('Sylvan') !== -1);
document.querySelector('[data-cr-lang="Common"]').click();
ok('language Common removed', m.languages.fixed.indexOf('Common') === -1);

document.querySelector('[data-cr-skill="Perception"]').click();
ok('skill Perception added', m.skillProficiencies.fixed.indexOf('Perception') !== -1);
document.querySelector('[data-cr-skill="Perception"]').click();
ok('skill Perception toggled off', m.skillProficiencies.fixed.indexOf('Perception') === -1);

let ti = q('#cr-tool-in'); ti.value = "Thieves' Tools"; q('#cr-tool-add').click();
ok('tool added', m.toolProficiencies.fixed.indexOf("Thieves' Tools") !== -1);

q('#cr-trait-add').click();
ok('trait form opens', !q('#cr-tform').hidden);
q('#cr-tname').value = 'Observant Prey';
q('#cr-ttext').value = 'You have advantage on all skill checks made using your sense of hearing.';
q('#cr-tsave').click();
ok('trait added to model', m.traits.length === 1 && m.traits[0].name === 'Observant Prey');
ok('trait entries captured', m.traits[0].entries[0].indexOf('sense of hearing') !== -1);
ok('trait card rendered', !!q('.cr-trait'));
document.querySelector('[data-cr-tdel="0"]').click();
ok('trait removed', m.traits.length === 0);

const REQ = ['name','source','size','speed','darkvision','abilityBonuses','abilityChoices','languages','skillProficiencies','toolProficiencies','weaponProficiencies','armorProficiencies','traits','subraces'];
ok('model still well-formed after edits', REQ.every(k => k in m) && m.custom === true);

console.log('\n' + pass + '/' + (pass + fail) + ' passed');
process.exit(fail ? 1 : 0);
