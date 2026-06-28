/* homebrew-picker-ui-smoke.js — renders the species picker in jsdom with a mocked
 * HomebrewRaces library and drives the Phase-2 surface: Book/Homebrew tabs, the
 * library list, pick (deep-copies the model), edit (links _hbId), define-new, and
 * Save-to-library (calls HomebrewRaces.save + relabels the button).
 *
 * Run from the repo root:  node homebrew-picker-ui-smoke.js   (requires jsdom)
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'shards.html'), 'utf8');
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const appSrc = inlineScripts.reduce((a, b) => (b.length > a.length ? b : a), '');
const start = appSrc.indexOf('var SpeciesUI = (function');
const endTok = '\n})();';
const iife = appSrc.slice(start, appSrc.indexOf(endTok, start) + endTok.length);

const TEMPLATE =
  '<div class="sp-tabs" id="sp-tabs"><button class="sp-tab" id="sp-tab-book" data-sptab="book">Book Races</button><button class="sp-tab" id="sp-tab-hb" data-sptab="hb">\u2726 Homebrew</button></div>' +
  '<div id="bz-book-pane"><div id="bz-species"></div></div>' +
  '<div id="bz-hb-pane" hidden><div id="bz-homebrew"></div></div>' +
  '<div id="species-out"></div>';

const dom = new JSDOM('<!doctype html><html><head></head><body>' + TEMPLATE + '</body></html>');
const window = dom.window;
const document = window.document;
const ABILS = ['str','dex','con','int','wis','cha'];
const ABN = {str:'STR',dex:'DEX',con:'CON',int:'INT',wis:'WIS',cha:'CHA'};
const escHtml = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const q = sel => document.querySelector(sel);
const saveDraft = () => {};
let renderAllCount = 0;
const renderAll = () => { renderAllCount++; };
let rbCalled = 0, rbOpts = null;
const renderBrowseInto = (host, opts) => { rbCalled++; rbOpts = opts; if (host) host.innerHTML = '<div class="browse-stub"></div>'; };
const DATA = { races: [{ n: 'Tiefling', s: 'PHB' }] };
let draft = {};

// mock library
const baseModel = { name:'Mouseling', custom:true, size:'Small', speed:{walk:20,label:'20 ft.'}, darkvision:null, abilityBonuses:{}, abilityChoices:[], languages:{fixed:['Common'],anyStandard:0,any:0}, skillProficiencies:{fixed:[],anyCount:0,choose:[]}, toolProficiencies:{fixed:[],anyCount:0,choose:[]}, weaponProficiencies:{fixed:[],anyCount:0,choose:[]}, armorProficiencies:{fixed:[],anyCount:0,choose:[]}, traits:[{name:'Observant Prey', entries:['You have advantage on hearing checks.'], source:'Mouseling'}], subraces:[], asiMode:'none' };
let lib = [{ id:'hb1', name:'Mouseling', model: JSON.parse(JSON.stringify(baseModel)), createdByName:'hagakuredisc' }];
let saveCalls = [], updateCalls = [], removeCalls = [];
const HomebrewRaces = {
  list: () => Promise.resolve(lib.map(r => JSON.parse(JSON.stringify(r)))),
  save: (name, model) => { saveCalls.push({ name, model }); const row = { id:'hb-new', name, model, createdByName:'tester' }; lib.unshift(row); return Promise.resolve(row); },
  update: (id, name, model) => { updateCalls.push({ id, name, model }); return Promise.resolve({ id, name, model, createdByName:'tester' }); },
  remove: (id) => { removeCalls.push(id); lib = lib.filter(r => r.id !== id); return Promise.resolve(true); }
};

let SpeciesUI;
eval('SpeciesUI = ' + iife.replace(/^var SpeciesUI = /, ''));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  \u2713 ' + n); } else { fail++; console.log('  \u2717 ' + n); } };
const flush = () => new Promise(r => window.setTimeout(r, 0));
const resetDom = () => { document.body.innerHTML = TEMPLATE; };
const resetDraft = () => { draft = {}; draft.species = null; draft.subrace = null; draft.asi = {}; draft.size = null; draft.originMode = 'std'; draft.useFloating = false; draft.openTrait = null; };

(async () => {
  console.log('A. mountPicker — default Book tab + async library render');
  resetDom(); resetDraft();
  SpeciesUI.mountPicker();
  ok('renderBrowseInto called (book list)', rbCalled > 0);
  ok('book pane visible by default', q('#bz-book-pane').hidden === false);
  ok('homebrew pane hidden by default', q('#bz-hb-pane').hidden === true);
  ok('book tab marked active', q('#sp-tab-book').classList.contains('on'));
  await flush();
  ok('library row rendered after load', !!q('.hb-row'));
  ok('row shows the saved name', /Mouseling/.test(q('#bz-homebrew').textContent));
  ok('row shows creator', /saved by hagakuredisc/.test(q('#bz-homebrew').textContent));
  ok('define-new button present', !!q('#hb-define'));

  console.log('B. tab switch -> Homebrew');
  q('#sp-tab-hb').click();
  ok('homebrew pane now visible', q('#bz-hb-pane').hidden === false);
  ok('book pane now hidden', q('#bz-book-pane').hidden === true);
  ok('homebrew tab active', q('#sp-tab-hb').classList.contains('on'));

  console.log('C. pick a library race -> deep copy onto draft.species');
  renderAllCount = 0;
  q('[data-hb-pick="hb1"]').click();
  ok('draft.species set + custom', draft.species && draft.species.custom === true);
  ok('name carried', draft.species.n === 'Mouseling');
  ok('model is a COPY (not the library row ref)', draft.species.model !== lib.find(r => r.id === 'hb1').model);
  ok('copied model keeps custom flag', draft.species.model.custom === true);
  ok('copied trait present', (draft.species.model.traits || []).length === 1);
  ok('NO _hbId on plain pick (use, not edit)', !draft.species._hbId);
  ok('renderAll fired', renderAllCount === 1);

  console.log('D. edit a library race -> links _hbId');
  resetDom(); resetDraft(); SpeciesUI.mountPicker(); await flush();
  q('[data-hb-edit="hb1"]').click();
  ok('draft.species linked to library id', draft.species._hbId === 'hb1');
  ok('edit also deep-copies model', draft.species.model !== lib.find(r => r.id === 'hb1').model);

  console.log('E. define a new race');
  resetDom(); resetDraft(); SpeciesUI.mountPicker(); await flush();
  renderAllCount = 0;
  q('#hb-define').click();
  ok('draft.species is a fresh custom race', draft.species && draft.species.custom && draft.species.s === 'Homebrew');
  ok('fresh race has no _hbId', !draft.species._hbId);
  ok('renderAll fired', renderAllCount === 1);

  console.log('F. Save-to-library from the builder');
  resetDom(); resetDraft();
  draft.species = SpeciesUI.freshCustomSpecies();
  SpeciesUI.renderSpeciesOut();            // render the builder into #species-out
  ok('builder rendered with Save button', !!q('#cr-save'));
  ok('button label is "Save…" (new race)', /Save to Homebrew Races/.test(q('#cr-save').textContent));
  const nm = q('#cr-name'); nm.value = 'Sprrelfin'; nm.dispatchEvent(new window.Event('input', { bubbles: true }));
  q('#cr-save').click();
  await flush();
  ok('HomebrewRaces.save called once', saveCalls.length === 1);
  ok('  with the typed name', saveCalls[0].name === 'Sprrelfin');
  ok('  with the model object', saveCalls[0].model && saveCalls[0].model.custom === true);
  ok('draft.species linked to new id', draft.species._hbId === 'hb-new');
  ok('Save status shows confirmation', /Saved/.test(q('#cr-savemsg').textContent));
  ok('button relabeled to "Update…"', /Update in Homebrew Races/.test(q('#cr-save').textContent));

  console.log('G. Save again -> update path (uses _hbId)');
  q('#cr-save').click();
  await flush();
  ok('HomebrewRaces.update called (not a 2nd insert)', updateCalls.length === 1 && saveCalls.length === 1);
  ok('  update targets the linked id', updateCalls[0].id === 'hb-new');

  console.log('\n' + pass + '/' + (pass + fail) + ' passed');
  process.exit(fail ? 1 : 0);
})();
