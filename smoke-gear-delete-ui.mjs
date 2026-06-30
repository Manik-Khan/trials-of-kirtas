// smoke-gear-delete-ui.mjs
// The new gear-editor surface through GearManager: the Container toggle, the Delete button and
// its inline confirm (with the spill warning for a non-empty bag), the un-container confirm,
// and the edit cog rendered on container blocks in both list and grid.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
const GM_SRC = readFileSync(new URL('./gear-manager.js', import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m, d) => { c ? pass++ : (fail++, console.log('  FAIL:', m, d !== undefined ? JSON.stringify(d).slice(0, 120) : '')); };
const has = (h, s, m) => ok(h.indexOf(s) >= 0, m, h.slice(0, 0));

const dom = new JSDOM('<!doctype html><body><div id="host" class="tok-sheet"><div data-sec="inventory" class="can-edit"><div id="box"></div></div></body>', { runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window, d = w.document;
const s = d.createElement('script'); s.textContent = GM_SRC; d.body.appendChild(s);
const GM = w.GearManager;

const inv = [
  { id: null, name: 'Longsword', weight: 3, weaponCat: 'Martial Melee' },
  { id: 'bag1', name: 'Efficient Quiver', isContainer: true, weight: 2 },
  { id: null, name: 'Arrows', qty: 20, containerId: 'bag1' },
  { id: null, name: 'Javelin', qty: 4, containerId: 'bag1' },
];
const sword = inv[0], bag = inv[1];

console.log('--- editor: Container toggle ---');
{
  const h = GM.editFormHtml(sword, {}, inv);
  has(h, 'data-eftoggle="isContainer"', 'Container toggle present');
  has(h, 'Holds other items', 'Container toggle label');
  ok(/data-eftoggle="isContainer"[^>]*/.test(h) && h.indexOf('ge-toggle on" data-eftoggle="isContainer"') < 0, 'plain item: Container NOT on');
}
{
  const h = GM.editFormHtml(bag, {}, inv);
  has(h, 'ge-toggle on" data-eftoggle="isContainer"', 'container item: Container toggle is on');
}

console.log('--- editor: Delete button + normal footer ---');
{
  const h = GM.editFormHtml(sword, {}, inv);
  has(h, 'data-edel="1"', 'Delete button present');
  has(h, 'data-esave="1"', 'Save still present');
  has(h, 'data-ecancel="1"', 'Cancel still present');
  ok(h.indexOf('data-conf-yes') < 0, 'no confirm strip when not armed');
}

console.log('--- editor: delete confirm strip ---');
{
  const h = GM.editFormHtml(sword, { confirm: 'delete' }, inv);
  has(h, 'data-conf-yes="1"', 'confirm Yes button');
  has(h, 'data-conf-no="1"', 'confirm No button');
  has(h, 'can\u2019t be undone', 'plain-item confirm copy');
  ok(h.indexOf('data-edel="1"') < 0, 'normal Delete hidden during confirm');
}
{
  const h = GM.editFormHtml(bag, { confirm: 'delete' }, inv);
  has(h, 'move to your inventory', 'bag confirm warns about spill');
  has(h, '2 items', 'bag confirm counts the contents');
}

console.log('--- editor: un-container confirm ---');
{
  const h = GM.editFormHtml(bag, { confirm: 'uncontain' }, inv);
  has(h, 'No longer a container', 'uncontain confirm copy');
  has(h, '2 items', 'uncontain counts contents');
  has(h, 'data-conf-yes="1"', 'uncontain Yes button');
}

console.log('--- bag cog rendered in list + grid ---');
{
  const box = d.getElementById('box');
  box.__gmState = { view: 'list', open: Object.create(null) };
  const ES = { SLOTS: [{ key: 'mainHand', label: 'Main' }], canEquip: () => false };
  GM.render(box, { inventory: inv, currency: { gp: 1 }, ES, strScore: 14 });
  const cogs = box.querySelectorAll('.gm-cog[data-editopen]');
  ok(cogs.length >= 1, 'list: a cog with data-editopen on the bag', cogs.length);
  ok(box.querySelector('.gm-cog[data-editopen="id:bag1"]') != null, 'list: cog targets the bag key');
}
{
  const box = d.getElementById('box');
  box.__gmState = { view: 'grid', open: Object.create(null) };
  const ES = { SLOTS: [{ key: 'mainHand', label: 'Main' }], canEquip: () => false };
  GM.render(box, { inventory: inv, currency: { gp: 1 }, ES, strScore: 14 });
  ok(box.querySelector('.gm-tile .gm-cog[data-editopen="id:bag1"]') != null, 'grid: cog on the bag tile');
  ok(box.querySelectorAll('.gm-cog[data-editopen]').length === 1, 'grid: only the bag gets a cog (not plain items)');
}

console.log('\nsmoke-gear-delete-ui: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
