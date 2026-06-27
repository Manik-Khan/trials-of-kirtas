// smoke-gear-2b-render.mjs
// GearManager renders the item edit form from box.__gmState.draft when a row is
// being edited: name/qty/weight/rarity/attune/flavor fields, the icon swatch +
// "Change icon" toggle, and the category-tabbed icon picker when st.picker is on.
// Also: the read detail carries an "Edit item" trigger (data-editopen).
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const GM_SRC = readFileSync(new URL('./gear-manager.js', import.meta.url), 'utf8');
const II_SRC = readFileSync(new URL('./item-icons.js', import.meta.url), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };

function render(state) {
  const dom = new JSDOM('<!doctype html><body><div id="host" class="tok-sheet"><div data-sec="inventory" class="can-edit"><div id="box"></div></div></body>', { runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window, d = w.document;
  d.body.appendChild(Object.assign(d.createElement('script'), { textContent: II_SRC }));
  d.body.appendChild(Object.assign(d.createElement('script'), { textContent: GM_SRC }));
  const box = d.getElementById('box');
  const ES = { SLOTS: [{ key: 'mainHand', label: 'Main Hand' }], canEquip: () => true };
  const inv = [
    { id: 'sword', name: 'Longsword', cat: 'sword', icon: 'broadsword', weight: 3, qty: 1, rarity: 'None' },
    { id: 'potion', name: 'Potion of Healing', weight: 0.5, qty: 2, entries: ['Regain HP.'] }
  ];
  box.__gmState = Object.assign({ view: 'list', open: Object.create(null), editing: null, picker: false, pickerCat: null, draft: null }, state || {});
  w.GearManager.render(box, { inventory: inv, currency: {}, ES, strScore: 15 });
  return { box };
}

console.log('--- edit form fields ---');
{
  const draft = { id: 'sword', name: 'Flametongue', cat: 'sword', icon: 'broadsword', weight: 4, qty: 1, rarity: 'Rare', reqAttune: true, flavor: 'It hums.' };
  const { box } = render({ editing: 'id:sword', draft, open: (() => { const o = Object.create(null); o['id:sword'] = true; return o; })() });
  const edit = box.querySelector('.gm-edit');
  ok(edit, 'edit form rendered');
  const name = box.querySelector('input[data-ef="name"]');
  ok(name && name.getAttribute('value') === 'Flametongue', 'name field shows the draft value');
  ok(box.querySelector('input[data-ef="qty"]'), 'qty field present');
  ok(box.querySelector('input[data-ef="weight"]'), 'weight field present');
  const sel = box.querySelector('select[data-ef="rarity"]');
  ok(sel, 'rarity select present');
  ok(sel && sel.value === "Rare", "rarity Rare is selected");
  ok(box.querySelector('.ge-toggle.on[data-eftoggle="reqAttune"]'), 'attune toggle reflects reqAttune=true');
  const ta = box.querySelector('textarea[data-ef="flavor"]');
  ok(ta && /It hums\./.test(ta.textContent), 'flavor textarea shows the draft note');
  ok(box.querySelector('.ge-changeicon'), '"Change icon" button present');
  ok(box.querySelector('.ge-swatch svg'), 'icon swatch renders an svg');
  ok(!box.querySelector('.ge-picker'), 'picker hidden when st.picker is false');
  ok(box.querySelector('.ge-foot [data-esave]') && box.querySelector('.ge-foot [data-ecancel]'), 'Save + Cancel buttons present');
}

console.log('--- icon picker open ---');
{
  const draft = { id: 'sword', name: 'Sword', cat: 'sword', icon: 'broadsword' };
  const o = Object.create(null); o['id:sword'] = true;
  const { box } = render({ editing: 'id:sword', picker: true, draft, open: o });
  ok(box.querySelector('.ge-picker'), 'picker shown when st.picker is true');
  ok(box.querySelectorAll('.ge-pk-tab').length >= 5, 'category tabs rendered');
  ok(box.querySelectorAll('.ge-pk-cell[data-pkpick]').length > 0, 'icon cells rendered with data-pkpick');
  ok(box.querySelector('.ge-pk-cell.sel'), 'the current icon cell is marked selected');
}

console.log('--- detail edit trigger ---');
{
  const o = Object.create(null); o['id:potion'] = true;
  const { box } = render({ open: o });
  ok(box.querySelector('.gm-detail [data-editopen="id:potion"]'), 'read detail carries an Edit-item trigger');
}

console.log(`\nsmoke-gear-2b-render: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
