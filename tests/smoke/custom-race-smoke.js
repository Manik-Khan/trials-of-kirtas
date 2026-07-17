/* custom-race-smoke.js — validates the Phase-1 custom (homebrew) race builder.
 *
 * Part A (logic): extracts the REAL SpeciesUI module from shards.html and checks the
 *   model shape, the +0 path (no floating UI), the fixed-bonus path, forgeFacts, and
 *   ability application.
 * Part B (fold):  runs the REAL SoulShardsDerive on a custom model (stub class deps) to
 *   prove speed / senses / traits fold into `structural`.
 *
 * Run from the repo root:  node tests/smoke/custom-race-smoke.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

// ── pull the big inline <script> out of shards.html ──
const html = fs.readFileSync(path.join(ROOT, 'shards.html'), 'utf8');
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const src = inline.reduce((a, b) => (b.length > a.length ? b : a), '');

// ── extract the SpeciesUI IIFE, exposing internals for the test ──
const start = src.indexOf('var SpeciesUI = (function');
const endTok = '\n})();';
const end = src.indexOf(endTok, start);
if (start < 0 || end < 0) throw new Error('SpeciesUI module not found in shards.html');
let iife = src.slice(start, end + endTok.length).replace(
  /return \{ renderSpeciesOut:[\s\S]*?\};/,
  'return { renderSpeciesOut, combinedBonuses, forgeFacts, freshCustomSpecies, freshCustomRaceModel, syncCustomBonuses, rowsToObj, dataGrantsASI, isFloatingData, printedActive, floatingActive };'
);

// closure deps the page normally supplies
const ABILS = ['str','dex','con','int','wis','cha'];
const ABN = {str:'STR',dex:'DEX',con:'CON',int:'INT',wis:'WIS',cha:'CHA'};
let draft = {};
const escHtml = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const q = () => null;
const saveDraft = () => {};
const document = { getElementById: () => null, createElement: () => ({}), head: { appendChild(){} } };

let SpeciesUI;
eval('SpeciesUI = ' + iife.replace(/^var SpeciesUI = /, ''));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  \u2713 ' + n); } else { fail++; console.log('  \u2717 ' + n); } };
const eq = (n, a, b) => ok(n + (JSON.stringify(a) === JSON.stringify(b) ? '' : '  [got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b) + ']'), JSON.stringify(a) === JSON.stringify(b));
const reset = sp => { draft.species = sp; draft.subrace = null; draft.asi = {}; draft.size = null; draft.originMode = 'std'; draft.useFloating = false; draft.openTrait = null; };

console.log('A. model shape');
const sp = SpeciesUI.freshCustomSpecies();
ok('freshCustomSpecies -> {n, s:Homebrew, custom, model}', !!(sp && sp.n && sp.s === 'Homebrew' && sp.custom === true && sp.model));
const m = sp.model;
const REQ = ['name','source','size','speed','darkvision','abilityBonuses','abilityChoices','languages','skillProficiencies','toolProficiencies','weaponProficiencies','armorProficiencies','traits','subraces'];
ok('model is normalizeRace-shaped (all ' + REQ.length + ' keys)', REQ.every(k => k in m));
ok('model.speed = {walk:number, label:string}', !!(m.speed && typeof m.speed.walk === 'number' && typeof m.speed.label === 'string'));
ok('languages.fixed seeds Common', (m.languages.fixed || []).indexOf('Common') !== -1);
ok('model.custom === true', m.custom === true);

console.log('B. rowsToObj');
eq('[dex2,cha1] -> {dex:2,cha:1}', SpeciesUI.rowsToObj([{ability:'dex',amount:2},{ability:'cha',amount:1}]), {dex:2,cha:1});
eq('merges dupes, drops 0', SpeciesUI.rowsToObj([{ability:'str',amount:1},{ability:'str',amount:2},{ability:'dex',amount:0}]), {str:3});

console.log('C. +0 path (custom never shows the floating UI)');
reset(sp); m.asiMode = 'none'; SpeciesUI.syncCustomBonuses(m);
ok('dataGrantsASI(custom, empty) === true', SpeciesUI.dataGrantsASI(m) === true);
ok('isFloatingData(custom) === false', SpeciesUI.isFloatingData(m) === false);
ok('printedActive(custom) === true', SpeciesUI.printedActive(m) === true);
ok('floatingActive(custom) === false', SpeciesUI.floatingActive(m) === false);
eq('combinedBonuses none-mode === {}', SpeciesUI.combinedBonuses(m), {});

console.log('D. fixed path');
m.asiMode = 'fixed'; m._bonusRows = [{ability:'dex',amount:2},{ability:'cha',amount:1}]; SpeciesUI.syncCustomBonuses(m);
eq('abilityBonuses synced from rows', m.abilityBonuses, {dex:2,cha:1});
eq('combinedBonuses fixed === {dex:2,cha:1}', SpeciesUI.combinedBonuses(m), {dex:2,cha:1});
m.asiMode = 'none'; SpeciesUI.syncCustomBonuses(m);
eq('back to none clears bonuses', m.abilityBonuses, {});

console.log('E. forgeFacts (Mouseling)');
m.name = 'Mouseling'; m.size = 'Small'; m.speed = {walk:20,label:'20 ft.'}; m.darkvision = null;
m.traits = [{name:'Observant Prey', entries:['You have advantage on all skill checks made using your sense of hearing.'], source:'Mouseling'}];
const ff = SpeciesUI.forgeFacts(m);
ok('speed 20', ff.speed === 20);
ok('size Small', ff.size === 'Small');
ok('darkvision null', ff.darkvision === null);
eq('traits [Observant Prey]', ff.traits, ['Observant Prey']);
eq('bonuses {}', ff.bonuses, {});
ok('openCount 0', ff.openCount === 0);

console.log('F. ability application (effectiveAbilities-equivalent)');
const eff = (base, model) => { const e = {}; ABILS.forEach(k => e[k] = base[k] != null ? base[k] : 10); const b = SpeciesUI.combinedBonuses(model); Object.keys(b).forEach(k => e[k] = (e[k]||0) + b[k]); ABILS.forEach(k => { if (e[k] > 20) e[k] = 20; }); return e; };
const liadan = {str:6,dex:12,con:13,int:12,wis:14,cha:15};
m.asiMode = 'none'; SpeciesUI.syncCustomBonuses(m);
eq('+0 race preserves Liadan finals', eff(liadan, m), liadan);
m.asiMode = 'fixed'; m._bonusRows = [{ability:'cha',amount:2},{ability:'dex',amount:1}]; SpeciesUI.syncCustomBonuses(m);
eq('fixed race adds (cha15->17, dex12->13)', eff({str:8,dex:12,con:14,int:10,wis:10,cha:15}, m), {str:8,dex:13,con:14,int:10,wis:10,cha:17});

console.log('G. derive fold (real SoulShardsDerive, stub class deps)');
const { deriveStructural } = require(path.join(ROOT, 'soul-shards-derive.js'));
const engine = { build: () => ({ className:'Bard', level:4, features:[{name:'Bardic Inspiration', origin:'class:Bard', entries:['...']}], savingThrows:['dex','cha'], hd:8, hp:{max:27}, spellcasting:null }) };
const SC = { deriveSpellcasting: () => null, deriveClasses: () => [{name:'Bard',level:4}] };
const customModel = extra => Object.assign({ name:'Mouseling', source:'Homebrew', custom:true, lineage:false, size:'Small', sizeOptions:null, speed:{walk:20,label:'20 ft.'}, darkvision:null, abilityBonuses:{}, abilityChoices:[], languages:{fixed:['Common'],anyStandard:0,any:0}, skillProficiencies:{fixed:[],anyCount:0,choose:[]}, toolProficiencies:{fixed:[],anyCount:0,choose:[]}, weaponProficiencies:{fixed:[],anyCount:0,choose:[]}, armorProficiencies:{fixed:[],anyCount:0,choose:[]}, feats:null, additionalSpells:null, creatureTypes:null, traits:[{name:'Observant Prey', entries:['You have advantage on all skill checks made using your sense of hearing.'], source:'Mouseling'}], subraces:[] }, extra || {});
const out = deriveStructural({ abilities:liadan, classes:[{model:{},level:4}], race:customModel(), hp:27 }, { engine, spellcasting: SC });
const st = out.structural;
ok('structural returned', !!st);
ok('combat.speed folded (20)', st.combat && st.combat.speed === 20);
ok('no darkvision -> no senses', !(st.combat && st.combat.senses));
const feat = (st.features || []).find(f => f.name === 'Observant Prey');
ok('Observant Prey in features', !!feat);
ok('  source race:Mouseling', feat && feat.source === 'race:Mouseling');
ok('  desc from entries', feat && /sense of hearing/.test(feat.desc || ''));
ok('class feature coexists', (st.features || []).some(f => f.name === 'Bardic Inspiration'));
ok('race traits NOT flagged incomplete', !out._incomplete.some(x => /race traits/.test(x)));
ok('+0 leaves cha at 15', st.abilities && st.abilities.cha && st.abilities.cha.score === 15);
const out2 = deriveStructural({ abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10}, classes:[{model:{},level:4}], race:customModel({darkvision:60}), hp:27 }, { engine, spellcasting: SC });
ok('darkvision 60 -> combat.senses.darkvision', out2.structural.combat.senses && out2.structural.combat.senses.darkvision === 60);

console.log('\n' + pass + '/' + (pass + fail) + ' passed');
process.exit(fail ? 1 : 0);
