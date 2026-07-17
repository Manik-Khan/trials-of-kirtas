// smoke-gear-5-controller.mjs
// Drive wireInspiration's currency-footer controller: coin steppers (±1, clamp
// at 0, Shift ×10, debounced persistCurrency), the worth readout repainting on
// both stepped and typed edits, and the loot splitter (toggle + lazy party
// names, loot recompute, ways control, use-my-coins, take-my-share → persist).
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window, d = w.document;
globalThis.window = w; globalThis.document = d;
globalThis.MouseEvent = w.MouseEvent; globalThis.Event = w.Event;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

await import('../../gear-manager.js');   // registers window.GearManager

d.body.innerHTML =
  '<div id="root">' +
    '<button id="insp-toggle"></button><span id="insp-stat"></span>' +
    '<div data-sec="inventory" class="can-edit"><div data-equip></div></div>' +
  '</div>';
const root = d.getElementById('root');
const box = root.querySelector('[data-equip]');
box.__gmState = { view: 'list', open: Object.create(null), editing: null, picker: false, pickerCat: null, draft: null, adding: false, search: null, split: null };

const saves = [];
w.__sheet = {
  toRenderShape: cd => cd,
  renderSheet: (rt, shape) => { const b = rt.querySelector('[data-equip]'); w.GearManager.render(b, { inventory: shape.inventory, currency: shape.currency, ES: null, strScore: 10 }); }
};
const characterData = {
  canEdit: async () => true,
  loadCharacter: async () => ({ vitals: {}, structural: {}, currency: { pp: 0, gp: 5, ep: 0, sp: 0, cp: 0 }, inventory: [{ id: 'x', name: 'Torch', qty: 1, weight: 1, _enriched: true }] }),
  loadParty: async () => [{ name: 'Cosmere' }, { name: 'Caim' }, { name: 'Líadan' }, { name: 'Vesperian' }],
  save: async (key, patch) => { saves.push(JSON.parse(JSON.stringify(patch))); return patch; }
};
const st = () => box.__gmState;
const lastCur = () => { for (let i = saves.length - 1; i >= 0; i--) if (saves[i].currency) return saves[i].currency; return null; };
const cv = c => parseInt(box.querySelector('input[data-coin="' + c + '"]').value, 10);
const worth = () => box.querySelector('[data-worth]').textContent;
const pdown = (el, opts) => el.dispatchEvent(new w.MouseEvent('pointerdown', Object.assign({ bubbles: true }, opts || {})));
const pup = () => d.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true }));
const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const cs = (coin, dir) => box.querySelector('.gm-cs[data-cstep="' + dir + '"][data-coin="' + coin + '"]');
const setLoot = (c, v) => { const el = box.querySelector('input[data-loot="' + c + '"]'); el.value = String(v); el.dispatchEvent(new w.Event('input', { bubbles: true })); };

const mod = await import('../../sheet-actions.js');
const handle = mod.wireInspiration({ root, characterData, key: 'k', depsReady: Promise.resolve() });
await handle.ready;
w.GearManager.render(box, { inventory: [{ id: 'x', name: 'Torch', qty: 1, weight: 1 }], currency: { pp: 0, gp: 5, ep: 0, sp: 0, cp: 0 }, ES: null, strScore: 10 });

console.log('--- steppers: +/− , clamp at 0, worth repaints ---');
pdown(cs('gp', '1')); pup();
ok(cv('gp') === 6, '+ stepper bumps gp 5→6');
ok(worth() === '6', 'worth tracks the step (6 gp → 6)');
pdown(cs('cp', '-1')); pup();
ok(cv('cp') === 0, '− stepper clamps cp at 0 (no negatives)');

console.log('--- Shift+click steps ×10 ---');
pdown(cs('sp', '1'), { shiftKey: true }); pup();
ok(cv('sp') === 10, 'Shift step adds 10 sp at once');

console.log('--- a stepped change persists, debounced ---');
saves.length = 0;
pdown(cs('pp', '1')); pup();
ok(saves.length === 0, 'no save fires immediately (debounced)');
await sleep(560);
ok(lastCur() && lastCur().pp === 1, 'the debounced commit persisted the currency column');
ok(lastCur().gp === 6 && lastCur().sp === 10, 'the persisted column carries the full coin state');

console.log('--- typing a coin value updates currency + worth ---');
{
  const gp = box.querySelector('input[data-coin="gp"]'); gp.value = '100'; gp.dispatchEvent(new w.Event('input', { bubbles: true }));
  // pile now pp1 gp100 ep0 sp10 cp0 = 1000+10000+100 = 11100 cp → 111 gp
  ok(worth() === '111', 'worth repaints when a coin is typed, not only stepped');
}

console.log('--- split: toggle opens the panel + lazy-loads party names ---');
click(box.querySelector('[data-splittoggle]'));
ok(st().split.open === true, 'split flagged open');
ok(box.querySelector('[data-splitpanel]').classList.contains('open'), 'panel shown');
await sleep(20);   // loadParty resolves, breakdown repaints with names
ok(box.querySelector('[data-splitout]').innerHTML.indexOf('Cosmere') >= 0, 'live party names painted into the breakdown');

console.log('--- loot inputs recompute the breakdown (focus-safe) ---');
setLoot('pp', 0); setLoot('gp', 12); setLoot('ep', 0); setLoot('sp', 8); setLoot('cp', 4);   // each type ÷4 is clean
ok(st().split.loot.gp === 12, 'loot state updated from the inputs');
ok(box.querySelector('[data-splitout]').innerHTML.indexOf('splits evenly') >= 0, 'each coin type divides 4 ways evenly');

console.log('--- ways control changes the split + surfaces a remainder ---');
click(box.querySelector('[data-waysup]'));
ok(st().split.ways === 5, 'ways incremented 4→5');
ok(box.querySelector('[data-waysn]').textContent === '5', 'ways display updated');
ok(box.querySelector('[data-splitout]').innerHTML.indexOf('leftover') >= 0, '5-way split now leaves a remainder');

console.log('--- convert (money-changer) toggle: default keeps coins as-is ---');
click(box.querySelector('[data-waysdn]'));   // back to 4
setLoot('pp', 0); setLoot('gp', 0); setLoot('ep', 0); setLoot('sp', 0); setLoot('cp', 1000);
ok(st().split.convert === false, 'convert is off by default');
ok(box.querySelector('[data-splitout]').innerHTML.indexOf('250<span class="cl-u">cp') >= 0, 'default leaves the share in copper (250 cp) — nothing minted');
{
  const conv = box.querySelector('[data-convert]'); conv.checked = true; conv.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok(st().split.convert === true, 'toggling the checkbox flips convert on');
  const out = box.querySelector('[data-splitout]').innerHTML;
  ok(out.indexOf('gp') >= 0 && out.indexOf('ep') >= 0, 'convert consolidates the share (250 cp → 2 gp 1 ep)');
  conv.checked = false; conv.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok(st().split.convert === false, 'toggling back restores split-as-is');
}

console.log('--- use my coins copies the live pile into the splitter ---');
click(box.querySelector('[data-usemine]'));   // ways already back to 4 from the convert test
ok(st().split.loot.gp === cv('gp'), 'use-my-coins pulled the current gp into the loot');
ok(st().split.loot.pp === cv('pp'), 'use-my-coins pulled the current pp into the loot');

console.log('--- take my share adds the cut to the footer + persists ---');
setLoot('pp', 0); setLoot('ep', 0); setLoot('sp', 0); setLoot('cp', 0); setLoot('gp', 20);   // 20 gp / 4 = 5 gp each, clean
const gpBefore = cv('gp');
saves.length = 0;
click(box.querySelector('[data-takemine]'));
ok(cv('gp') === gpBefore + 5, 'take-my-share added the 5 gp cut to the footer coins');
ok(lastCur() && lastCur().gp === gpBefore + 5, 'take-my-share persisted the currency column');

console.log(`\nsmoke-gear-5-controller: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
