// smoke-gear-3-controller.mjs
// Drive wireInspiration's Inc-3 add-item controller end to end against a stubbed
// items2 fetch: toggle the panel, debounced search → results, expand a result,
// add (with same-name stacking), add a PACK (auto-explode into a bag + auto-open),
// and the enrich pass that fills weight/type on the freshly-exploded children.
// All writes land on the inventory column via persistInventory.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window, d = w.document;
globalThis.window = w; globalThis.document = d;
globalThis.MouseEvent = w.MouseEvent; globalThis.Event = w.Event; globalThis.URL = w.URL || URL;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── the GearManager (renders the panel + results the controller drives) ──
await import('../../gear-manager.js');   // registers window.GearManager

// ── stubbed items2: serves a small catalog by name-substring ──
const CATALOG = [
  { name: 'Longsword', rarity: 'None', typeLabel: 'Melee Weapon', weaponCat: 'Martial weapon, melee weapon', detail: 'Martial melee \u00b7 1d8 slashing \u00b7 3 lb', dmg1: '1d8', dmgType: 'S', weight: 3, price: '15 gp', properties: [], entries: [] },
  { name: "Explorer's Pack", rarity: 'None', typeLabel: 'Adventuring Gear', detail: 'Pack \u00b7 4 items', weight: 0, properties: [], entries: ['Includes a backpack and more.'],
    packContents: [{ item: 'backpack|phb', quantity: 1 }, { item: 'bedroll|phb', quantity: 1 }, { special: 'Rations (5 days)', quantity: 5 }, { item: 'torch|phb', quantity: 5 }] },
  { name: 'Backpack', rarity: 'None', typeLabel: 'Adventuring Gear', detail: 'Gear \u00b7 5 lb', weight: 5, properties: [], entries: [] },
  { name: 'Bedroll', rarity: 'None', typeLabel: 'Adventuring Gear', detail: 'Gear \u00b7 7 lb', weight: 7, properties: [], entries: [] },
  { name: 'Torch', rarity: 'None', typeLabel: 'Adventuring Gear', detail: 'Gear \u00b7 1 lb', weight: 1, properties: [], entries: [] },
  { name: 'Rations (5 Days)', rarity: 'None', typeLabel: 'Adventuring Gear', detail: 'Gear \u00b7 10 lb', weight: 10, properties: [], entries: [] }
];
let fetchCount = 0;
globalThis.fetch = async (url) => {
  fetchCount++;
  const u = new w.URL(url, 'http://x');
  const q = (u.searchParams.get('q') || '').toLowerCase();
  const items = CATALOG.filter(it => it.name.toLowerCase().includes(q)).map(it => JSON.parse(JSON.stringify(it)));
  return { ok: true, json: async () => ({ items, total: items.length, query: q }) };
};

// ── DOM + the controller deps ──
d.body.innerHTML =
  '<div id="root">' +
    '<button id="insp-toggle"></button><span id="insp-stat"></span>' +
    '<div data-sec="inventory" class="can-edit"><div data-equip></div></div>' +
  '</div>';
const root = d.getElementById('root');
const box = root.querySelector('[data-equip]');
box.__gmState = { view: 'list', open: Object.create(null), editing: null, picker: false, pickerCat: null, draft: null, adding: false, search: null };

const saves = [];
// renderSheet drives the REAL GearManager.render, so the panel + [data-addresults] exist
w.__sheet = {
  toRenderShape: cd => cd,
  renderSheet: (rt, shape) => { const b = rt.querySelector('[data-equip]'); w.GearManager.render(b, { inventory: shape.inventory, currency: shape.currency, ES: null, strScore: 10 }); }
};
const characterData = {
  canEdit: async () => true,
  loadCharacter: async () => ({ vitals: {}, structural: {}, currency: { gp: 10 }, inventory: [{ id: 'dagger', name: 'Dagger', qty: 1, weight: 1, _enriched: true }] }),
  save: async (key, patch) => { saves.push(JSON.parse(JSON.stringify(patch))); return patch; }
};

const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const st = () => box.__gmState;
const lastInv = () => { for (let i = saves.length - 1; i >= 0; i--) if (saves[i].inventory) return saves[i].inventory; return null; };
const byName = (inv, n) => (inv || []).find(it => it.name === n);

const mod = await import('../../sheet-actions.js');
const handle = mod.wireInspiration({ root, characterData, key: 'k', depsReady: Promise.resolve() });
await handle.ready;
// sheet-mount renders the gear box on mount (before the handlers fire); stand in for that
w.GearManager.render(box, { inventory: [{ id: 'dagger', name: 'Dagger', qty: 1, weight: 1 }], currency: { gp: 10 }, ES: null, strScore: 10 });

console.log('--- toggle opens the panel + focuses search ---');
click(box.querySelector('[data-addtoggle]'));
ok(st().adding === true, 'adding flag set on the box state');
ok(st().search && st().search.q === '', 'search state initialised');
ok(box.querySelector('[data-addsearch]'), 'the search input rendered');
ok(box.querySelector('[data-addresults]'), 'the results container rendered');

console.log('--- debounced search populates results from items2 ---');
const search = (text) => { const el = box.querySelector('[data-addsearch]'); el.value = text; el.dispatchEvent(new w.Event('input', { bubbles: true })); return el; };
search('longsword');
ok(st().search.q === 'longsword', 'query written to state on input');
ok(saves.length === 0, 'typing does not persist anything');
await sleep(120);
ok(st().search.loading === true || st().search.results, 'shows a loading state during the debounce window');
await sleep(400);
ok(Array.isArray(st().search.results) && st().search.results.length === 1, 'one result after the fetch resolves');
ok(st().search.results[0].name === 'Longsword', 'the result is the searched item');
ok(box.querySelector('[data-addresult="0"]'), 'the result row painted into the container');

console.log('--- expand a result ---');
click(box.querySelector('[data-addresult="0"]'));
ok(st().search.open === 0, 'result expand toggled open in state');
ok(box.querySelector('[data-additem="0"]'), 'the Add control is reachable');

console.log('--- add → persists the inventory column ---');
saves.length = 0;
click(box.querySelector('.gm-add-confirm[data-additem="0"]') || box.querySelector('[data-additem="0"]'));
await sleep(50);
ok(lastInv(), 'a save with the inventory column fired on add');
ok(byName(lastInv(), 'Longsword'), 'Longsword is in the saved inventory');
ok(byName(lastInv(), 'Longsword').qty === 1, 'added with qty 1');
ok(byName(lastInv(), 'Longsword')._enriched === true, 'a search-added item is marked enriched (no redundant re-fetch)');
ok(st().search.results[0].__added === true, 'the result is marked added (\u2713)');

console.log('--- adding the same item again stacks qty (no duplicate row) ---');
saves.length = 0;
click(box.querySelector('[data-additem="0"]'));
await sleep(50);
ok((lastInv().filter(it => it.name === 'Longsword')).length === 1, 'still a single Longsword row');
ok(byName(lastInv(), 'Longsword').qty === 2, 'qty incremented to 2');

console.log('--- search a PACK, add it → auto-explode into a bag ---');
search("explorer");
await sleep(400);
ok(st().search.results[0].name === "Explorer's Pack", 'pack found');
saves.length = 0; fetchCount = 0;
click(box.querySelector('[data-additem="0"]'));
await sleep(60);
const afterPack = lastInv();
const pack = byName(afterPack, "Explorer's Pack");
ok(pack && pack.isContainer === true, 'the pack lands as a container/bag');
ok(pack && pack.id, 'the bag has a generated id');
ok(pack && pack.weight === 0, "the pack's own weight is zeroed (weight lives in contents)");
const kids = afterPack.filter(it => it.containerId === pack.id);
ok(kids.length === 4, 'all four pack contents exploded into child items');
ok(byName(afterPack, 'Backpack') && byName(afterPack, 'Backpack').containerId === pack.id, 'Backpack is a child of the bag');
ok(byName(afterPack, 'Rations (5 Days)') && byName(afterPack, 'Rations (5 Days)').qty === 5, 'a special pack entry kept its quantity (×5)');
ok(st().open['id:' + pack.id] === true, 'the new bag is auto-opened so the explosion is visible');

console.log('--- enrich fills weight/type on the exploded children ---');
ok(afterPack.filter(it => it._enriched === false).length === 4, 'children start unenriched (weight unknown)');
await sleep(450);   // enrich runs on a 250ms timer, then fetch + persist
const enriched = lastInv();
const bp = byName(enriched, 'Backpack');
ok(bp && bp._enriched === true, 'Backpack child marked enriched after the pass');
ok(bp && bp.weight === 5, 'Backpack child GAINED its real weight (5 lb) — null no longer shadows it');
ok(byName(enriched, 'Bedroll') && byName(enriched, 'Bedroll').weight === 7, 'Bedroll child enriched to 7 lb');
ok(byName(enriched, 'Torch') && byName(enriched, 'Torch').weight === 1, 'Torch child enriched to 1 lb');
ok(byName(enriched, 'Backpack').containerId === pack.id, 'enrich preserved the child\u2019s containerId (stayed in the bag)');
ok(fetchCount === 4, 'enrich issued exactly one fetch per exploded child');

console.log('--- closing the panel clears search ---');
click(box.querySelector('[data-addtoggle]'));
ok(st().adding === false, 'panel closed');
ok(!box.querySelector('[data-addsearch]'), 'search input gone when closed');

console.log(`\nsmoke-gear-3-controller: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
