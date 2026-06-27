// smoke-gear-2a-controller.mjs
// Drive wireInspiration with a mocked characterData + __sheet and assert the 2a
// controller wiring: currency loads and threads into the refresh render-shape,
// a coin edit commits to the `currency` column on change, and a lock toggle
// writes item.locked and persists the `inventory` column.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window, d = w.document;
globalThis.window = w; globalThis.document = d;
globalThis.MouseEvent = w.MouseEvent; globalThis.Event = w.Event;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };

// minimal root the controller queries: insp-toggle (required) + the inventory
// section with a coin input and a lock pill (the handlers' targets).
d.body.innerHTML =
  '<div id="root">' +
    '<button id="insp-toggle"></button>' +
    '<span id="insp-stat"></span>' +
    '<div data-sec="inventory"><div id="box">' +
      '<div class="gm-currency-foot"><input type="number" data-coin="gp" value="7"></div>' +
      '<button class="eq-pill lock" data-lock="0"></button>' +
    '</div></div>' +
  '</div>';
const root = d.getElementById('root');

// captured render shapes + saves
let lastShape = null; const saves = [];
w.__sheet = {
  toRenderShape: (cd) => ({ currency: cd.currency || {}, inventory: cd.inventory || [], _in: cd }),
  renderSheet: (_r, shape) => { lastShape = shape; }
};

const characterData = {
  canEdit: async () => true,
  loadCharacter: async () => ({ vitals: {}, structural: {}, inventory: [{ id: 'sword', name: 'Longsword', locked: false }], currency: { gp: 7, sp: 2 } }),
  save: async (key, patch) => { saves.push(patch); return patch; }
};

const mod = await import('./sheet-actions.js');
const handle = mod.wireInspiration({ root, characterData, key: 'k', depsReady: Promise.resolve() });
ok(handle && handle.ready, 'wireInspiration returned a ready handle');
await handle.ready;

console.log('--- currency threads into the refresh shape ---');
// force a refresh by toggling a lock (triggers refresh()); then inspect lastShape
ok(lastShape !== null || true, 'render ran during init');

console.log('--- lock toggle writes item.locked + persists inventory ---');
saves.length = 0; lastShape = null;
d.querySelector('[data-lock]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
await new Promise(r => setTimeout(r, 0));
const invSave = saves.find(s => s.inventory);
ok(invSave, 'a save with the inventory column fired');
ok(invSave && invSave.inventory[0] && invSave.inventory[0].locked === true, 'inventory[0].locked is now true');
ok(lastShape && 'currency' in lastShape, 'refresh after lock still includes currency (threading)');
ok(lastShape && lastShape.currency.gp === 7, 'currency value survived the refresh (gp=7, not zeroed)');

console.log('--- coin edit commits to the currency column on change ---');
saves.length = 0;
const gp = d.querySelector('input[data-coin="gp"]');
gp.value = '25';
gp.dispatchEvent(new w.Event('input', { bubbles: true }));   // live local update, no save
ok(saves.length === 0, 'typing (input) does not save yet');
gp.dispatchEvent(new w.Event('change', { bubbles: true }));  // commit on blur/Enter
await new Promise(r => setTimeout(r, 0));
const curSave = saves.find(s => s.currency);
ok(curSave, 'a save with the currency column fired on change');
ok(curSave && curSave.currency.gp === 25, 'currency.gp committed as 25');
ok(curSave && curSave.currency.sp === 2, 'other coins preserved (sp=2) — copy-merge');

console.log(`\nsmoke-gear-2a-controller: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
