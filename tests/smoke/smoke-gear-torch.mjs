// smoke-gear-torch.mjs
// Stage 2 of gear delete — the torch + multi-select, rendered and handled by GearManager:
// the torch toggles the "burn it down" menu; "Delete multiple" enters select mode (checkboxes +
// red action bar); a loose row toggles selection; a bag BODY expands (contents become selectable)
// while the bag's checkbox selects it; the action bar arms a confirm strip; and GM must IGNORE
// data-bulkdel so it bubbles to sheet-actions (which owns the actual mutation).
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
const GM_SRC = readFileSync(new URL('../../gear-manager.js', import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m, d) => { c ? pass++ : (fail++, console.log('  FAIL:', m, d !== undefined ? JSON.stringify(d).slice(0, 140) : '')); };

const dom = new JSDOM('<!doctype html><body><div id="host" class="tok-sheet"><div data-sec="inventory" class="can-edit"><div id="box"></div></div></body>', { runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window, d = w.document;
const s = d.createElement('script'); s.textContent = GM_SRC; d.body.appendChild(s);
const GM = w.GearManager;
const click = (el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const st = () => box.__gmState;

const inv = [
  { id: null, name: 'Longsword', weight: 3, weaponCat: 'Martial Melee' },
  { id: null, name: 'Rations', qty: 5, weight: 2 },
  { id: 'bag1', name: 'Backpack', isContainer: true, weight: 5 },
  { id: null, name: 'Torch', qty: 10, containerId: 'bag1' },
  { id: null, name: 'Rope', containerId: 'bag1' },
];
const ES = { SLOTS: [{ key: 'mainHand', label: 'Main' }], canEquip: () => false };
const box = d.getElementById('box');
const ctx = { inventory: inv, currency: { gp: 5 }, ES, strScore: 15 };
GM.render(box, ctx); GM.bind(box);

console.log('--- torch present, nothing armed ---');
ok(!!box.querySelector('.gm-torch[data-torch]'), 'torch button rendered in toolbar');
ok(!box.querySelector('.gm-tmenu'), 'menu closed initially');
ok(!box.querySelector('.gm-selbar'), 'no action bar initially');
ok(!box.querySelector('.gm-pick'), 'no checkboxes initially');

console.log('--- torch click opens the burn menu ---');
click(box.querySelector('.gm-torch[data-torch]'));
ok(st().menuOpen === true, 'menuOpen set');
ok(st().torchLit === true, 'torch lit');
ok(!!box.querySelector('.gm-torch.lit'), 'torch has .lit class');
ok(!!box.querySelector('.gm-tmenu [data-selstart]'), '"Delete multiple" item present');
ok(!!box.querySelector('.gm-tmenu-i.soon'), 'Sort/collapse "later" placeholder present');

console.log('--- entering select mode ---');
click(box.querySelector('[data-selstart]'));
ok(st().selecting === true, 'selecting on');
ok(st().menuOpen === false, 'menu closed on enter');
ok(!box.querySelector('.gm-tmenu'), 'menu gone from DOM');
ok(!!box.querySelector('.gm-selbar'), 'action bar shown');
ok(box.querySelectorAll('.gm-pick').length >= 3, 'checkboxes rendered on top-level rows');
ok(/0 selected/.test(box.querySelector('.gm-selcount').textContent), 'count reads 0 selected');
ok(box.querySelector('[data-bulkarm]') && box.querySelector('[data-bulkarm]').hasAttribute('disabled'), 'Delete arm disabled at 0');
ok(box.classList.contains('selecting'), 'box carries .selecting class');

console.log('--- selecting a loose item ---');
click(box.querySelector('[data-row="ix:1"]'));            // Rations row body
ok(st().picked['ix:1'] === true, 'rations picked');
ok(/1 selected/.test(box.querySelector('.gm-selcount').textContent), 'count reads 1 selected');
ok(!box.querySelector('[data-bulkarm]').hasAttribute('disabled'), 'Delete arm enabled at 1');
ok(box.querySelector('[data-row="ix:1"]').classList.contains('picked'), 'rations row marked .picked');

console.log('--- bag BODY expands; bag CHECKBOX selects ---');
const before = box.querySelectorAll('.gm-pick').length;
click(box.querySelector('[data-row="id:bag1"] .gm-ic'));  // bag body (icon) → expand
ok(st().open['id:bag1'] === true, 'bag expanded on a body click');
ok(!st().picked['id:bag1'], 'bag NOT selected by a body click');
ok(box.querySelectorAll('.gm-pick').length > before, 'expanded contents add their own checkboxes');
click(box.querySelector('[data-row="id:bag1"] .gm-pick'));  // bag checkbox → select
ok(st().picked['id:bag1'] === true, 'bag selected via its checkbox');
ok(st().open['id:bag1'] === true, 'bag stays expanded when its checkbox is ticked');

console.log('--- arm → confirm strip → GM ignores data-bulkdel ---');
click(box.querySelector('[data-bulkarm]'));
ok(st().bulkConfirm === true, 'bulkConfirm armed');
ok(!!box.querySelector('.gm-selbar.confirm'), 'confirm bar shown');
ok(/Burn/.test(box.querySelector('.gm-selcount').textContent), 'confirm copy reads "Burn N…"');
const bulkBtn = box.querySelector('[data-bulkdel]');
ok(bulkBtn != null, 'data-bulkdel button present in confirm strip');
const sel0 = st().selecting, conf0 = st().bulkConfirm;
click(bulkBtn);                                           // GM must let this bubble untouched
ok(st().selecting === sel0 && st().bulkConfirm === conf0, 'GM ignores data-bulkdel (sheet-actions owns the mutation)');

console.log('--- cancels back out cleanly ---');
click(box.querySelector('[data-bulkcancel]'));
ok(st().bulkConfirm === false, 'confirm backed out');
ok(st().selecting === true, 'still in select mode after confirm-cancel');
click(box.querySelector('[data-selcancel]'));
ok(st().selecting === false, 'select mode exited');
ok(Object.keys(st().picked).filter(k => st().picked[k]).length === 0, 'picked cleared on exit');
ok(st().torchLit === false, 'torch unlit after exit');
ok(!box.querySelector('.gm-selbar'), 'action bar gone after exit');
ok(!box.querySelector('.gm-pick'), 'checkboxes gone after exit');

console.log('\nsmoke-gear-torch: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
