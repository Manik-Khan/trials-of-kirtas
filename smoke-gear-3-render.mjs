// smoke-gear-3-render.mjs
// GearManager's Inc-3 add-item RENDER surface: searchResultsHtml's states
// (hint / searching / error / empty / rows), the result row + expandable detail
// + Add button + pack note, and render()'s toolbar "+ Add Item" button + the
// search panel (input + results container) when st.adding is on.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const GM_SRC = readFileSync(new URL('./gear-manager.js', import.meta.url), 'utf8');

const dom = new JSDOM('<!doctype html><body><div id="host" class="tok-sheet"><div data-sec="inventory" class="can-edit"><div id="box"></div></div></body>', { runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window, d = w.document;
const s = d.createElement('script'); s.textContent = GM_SRC; d.body.appendChild(s);
const GM = w.GearManager;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };
const has = (html, sub, m) => ok(html.indexOf(sub) >= 0, m);
const hasnt = (html, sub, m) => ok(html.indexOf(sub) < 0, m);

const RESULTS = [
  { name: 'Longsword', rarity: 'None', typeLabel: 'Melee Weapon', weaponCat: 'Martial weapon, melee weapon', detail: 'Martial melee \u00b7 1d8 slashing \u00b7 3 lb', dmg1: '1d8', dmgType: 'S', dmg2: '1d10', weight: 3, price: '15 gp', properties: [{ name: 'Versatile (1d10)', desc: 'one or two hands' }], entries: [], sourceFull: "PHB'14 p149" },
  { name: 'Flame Tongue', rarity: 'Rare', reqAttune: 'Requires Attunement', weaponCat: 'Martial weapon, melee weapon', detail: 'Martial melee \u00b7 Rare \u00b7 attune', dmg1: '1d8', dmgType: 'S', weight: 3, entries: ['Flames erupt from the blade.'] },
  { name: "Explorer's Pack", rarity: 'None', typeLabel: 'Adventuring Gear', detail: 'Pack \u00b7 8 items', entries: ['Includes a backpack and more.'], packContents: [{ item: 'backpack|phb', quantity: 1 }, { special: 'Hempen rope', quantity: 1 }] }
];

console.log('--- searchResultsHtml: states ---');
ok(typeof GM.searchResultsHtml === 'function', 'searchResultsHtml is exposed on the API');
has(GM.searchResultsHtml({ search: { q: 'a' } }), 'at least 2 characters', 'q<2 → the 2-char hint');
has(GM.searchResultsHtml({ search: { q: 'long', loading: true } }), 'Searching', 'loading → Searching\u2026');
{ const h = GM.searchResultsHtml({ search: { q: 'long', error: 'Search failed' } }); has(h, 'Search failed', 'error text shows'); has(h, 'gm-add-state err', 'error carries the err class'); }
has(GM.searchResultsHtml({ search: { q: 'zzz', results: [] } }), 'No items found', 'empty results → No items found');

console.log('--- searchResultsHtml: result rows ---');
{
  const h = GM.searchResultsHtml({ search: { q: 'sword', results: RESULTS, open: null } });
  ok((h.match(/class="gm-ares /g) || h.match(/class="gm-ares"/g) || []).length >= 0, 'rows render');
  ok((h.match(/data-addresult="/g) || []).length === 3, 'three result rows (data-addresult 0/1/2)');
  ok((h.match(/data-additem="/g) || []).length === 3, 'each row carries a quick + (data-additem)');
  has(h, 'Longsword', 'first result name present');
  has(h, '>Rare<', 'Rare rarity tag text present');
  has(h, '#4a6aaa', 'Rare rarity tag is rarity-colored');
  hasnt(h, '>None<', 'a None-rarity item shows NO rarity tag');
  has(h, 'gm-ares-meta">Martial melee', 'short detail line shows in the row meta');
  hasnt(h, 'gm-ares-detail', 'with open:null, no result detail is expanded');
}

console.log('--- searchResultsHtml: expanded detail + Add button + pack note ---');
{
  const h = GM.searchResultsHtml({ search: { q: 'sword', results: RESULTS, open: 1 } });  // Flame Tongue expanded
  has(h, 'gm-ares-detail', 'expanded result shows its detail');
  has(h, 'Add to inventory', 'expanded detail has the Add button');
  has(h, 'data-additem="1"', 'the Add button targets the open result index');
  has(h, 'Flames erupt', 'detail body renders the entries (reused detailBody)');
  hasnt(h, 'Unpacks into a bag', 'a non-pack expanded item shows NO pack note');
}
{
  const h = GM.searchResultsHtml({ search: { q: 'pack', results: RESULTS, open: 2 } });  // Explorer's Pack expanded
  has(h, 'Unpacks into a bag with its 2 contents', 'a pack shows the auto-explode note with its content count');
}
{
  const h = GM.searchResultsHtml({ search: { q: 'sword', results: RESULTS, open: 0 } });
  // mark added on the first result
  const r2 = JSON.parse(JSON.stringify(RESULTS)); r2[0].__added = true;
  const ha = GM.searchResultsHtml({ search: { q: 'sword', results: r2, open: 0 } });
  has(ha, 'Added \u2713', 'an added result shows the Added \u2713 confirmation');
  has(ha, 'gm-ares open added', 'the added (and open) row carries the added class');
}

console.log('--- render(): toolbar button + search panel ---');
function render(stPatch) {
  const box = d.getElementById('box');
  box.__gmState = Object.assign({ view: 'list', open: Object.create(null) }, stPatch);
  GM.render(box, { inventory: [{ id: 'a', name: 'Torch', weight: 1 }], currency: { gp: 5 }, ES: null, strScore: 10 });
  return box;
}
{
  const box = render({ adding: false });
  ok(box.querySelector('[data-addtoggle]'), 'the + Add Item toolbar button is present');
  ok(box.querySelector('[data-addtoggle]').textContent.indexOf('Add Item') >= 0, 'button reads "Add Item" when closed');
  ok(!box.querySelector('[data-addsearch]'), 'no search panel while adding is off');
  ok(box.querySelector('[data-view="grid"]'), 'List/Grid toggle still present alongside Add');
}
{
  const box = render({ adding: true, search: { q: 'rope', results: RESULTS, open: null } });
  ok(box.querySelector('.gm-add'), 'the add panel renders when adding is on');
  const inp = box.querySelector('[data-addsearch]');
  ok(inp, 'search input present');
  ok(inp.getAttribute('value') === 'rope', 'search input carries the live query value');
  ok(box.querySelector('[data-addresults]'), 'results container present');
  ok(box.querySelector('[data-addresults]').querySelectorAll('[data-addresult]').length === 3, 'results render inside the container');
  ok(box.querySelector('[data-addtoggle]').textContent.indexOf('Done') >= 0, 'button reads "Done" when open');
}

console.log(`\nsmoke-gear-3-render: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
