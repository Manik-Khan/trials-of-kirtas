// smoke-gear-2b-controller.mjs
// Drive wireInspiration's edit-form handlers. The draft lives on box.__gmState;
// field writes land on the draft (live inventory untouched, no save), Save copies
// the draft back + persists the inventory column, Cancel discards. Also: icon
// pick and the attune toggle write to the draft.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window, d = w.document;
globalThis.window = w; globalThis.document = d;
globalThis.MouseEvent = w.MouseEvent; globalThis.Event = w.Event;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };

d.body.innerHTML =
  '<div id="root">' +
    '<button id="insp-toggle"></button><span id="insp-stat"></span>' +
    '<div data-sec="inventory" class="can-edit"><div data-equip>' +
      '<button data-editopen="id:sword">edit</button>' +
      '<input data-ef="name" value="Longsword">' +
      '<input type="number" data-ef="qty" value="1">' +
      '<select data-ef="rarity"><option>None</option><option>Rare</option></select>' +
      '<button data-pkpick="katana">k</button>' +
      '<button data-eftoggle="reqAttune">a</button>' +
      '<button data-ecancel="1">cancel</button>' +
      '<button data-esave="1">save</button>' +
    '</div></div>' +
  '</div>';
const root = d.getElementById('root');
const box = root.querySelector('[data-equip]');
box.__gmState = { view: 'list', open: Object.create(null), editing: null, picker: false, pickerCat: null, draft: null };

const saves = [];
w.__sheet = { toRenderShape: (cd) => cd, renderSheet: () => {} };   // no-op render; box.__gmState persists
const characterData = {
  canEdit: async () => true,
  loadCharacter: async () => ({ vitals: {}, structural: {}, currency: {}, inventory: [
    { id: 'sword', name: 'Longsword', icon: 'broadsword', qty: 1, weight: 3, rarity: 'None', reqAttune: false, flavor: '' }
  ] }),
  save: async (key, patch) => { saves.push(patch); return patch; }
};

const click = sel => root.querySelector(sel).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const st = () => box.__gmState;

const mod = await import('../../sheet-actions.js');
const handle = mod.wireInspiration({ root, characterData, key: 'k', depsReady: Promise.resolve() });
await handle.ready;

console.log('--- openEdit creates a draft, live item untouched ---');
click('[data-editopen]');
ok(st().editing === 'id:sword', 'editing key is set on the box state');
ok(st().draft && st().draft.name === 'Longsword', 'draft is a copy of the item');

console.log('--- field input writes to the draft only (no save) ---');
saves.length = 0;
const name = root.querySelector('input[data-ef="name"]');
name.value = 'Flametongue';
name.dispatchEvent(new w.Event('input', { bubbles: true }));
ok(st().draft.name === 'Flametongue', 'draft.name updated from the input');
ok(saves.length === 0, 'typing does not persist');

console.log('--- icon pick + attune toggle write to the draft ---');
click('[data-pkpick]');
ok(st().draft.icon === 'katana', 'draft.icon set by the picker');
click('[data-eftoggle]');
ok(st().draft.reqAttune === true, 'draft.reqAttune toggled on');

console.log('--- Save commits the draft to the inventory column ---');
saves.length = 0;
click('[data-esave]');
await new Promise(r => setTimeout(r, 0));
const invSave = saves.find(s => s.inventory);
ok(invSave, 'a save with the inventory column fired');
const savedSword = invSave && invSave.inventory.find(i => i.id === 'sword');
ok(savedSword && savedSword.name === 'Flametongue', 'saved name is the edited value');
ok(savedSword && savedSword.icon === 'katana', 'saved icon is the picked value');
ok(savedSword && savedSword.reqAttune === true, 'saved reqAttune is the toggled value');
ok(st().editing === null && st().draft === null, 'edit state cleared after Save');

console.log('--- Cancel discards the draft (no write, no save) ---');
click('[data-editopen]');
const name2 = root.querySelector('input[data-ef="name"]');
name2.value = 'Should Not Stick';
name2.dispatchEvent(new w.Event('input', { bubbles: true }));
ok(st().draft.name === 'Should Not Stick', 'draft took the new text');
saves.length = 0;
click('[data-ecancel]');
ok(st().editing === null && st().draft === null, 'edit state cleared after Cancel');
ok(saves.length === 0, 'Cancel does not persist');

console.log(`\nsmoke-gear-2b-controller: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
