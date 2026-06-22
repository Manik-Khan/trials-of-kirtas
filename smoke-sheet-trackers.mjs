// smoke-sheet-trackers.mjs
// ---------------------------------------------------------------------------
// Proves the curated Resources tracker panel end-to-end:
//   • PRE-SEED — with no trackerOrder, the panel shows exactly the derived pools,
//     per-character, from the REAL data shape (classLabel, not classes[]).
//   • NO LEAK — the regression that started this: every character used to show
//     Cosmere's hardcoded rows (Hexblade's Curse / Strength of the Grave). Mount
//     each PC and prove those strings are gone and no pool crosses characters.
//   • trackerOrder — once present, it is the authoritative visible set + order.
//   • WRITE PATHS — spend (pip tap → vitals.pipState), add / edit (→ customResources
//     + trackerOrder), remove-with-confirm and keyboard reorder (→ trackerOrder),
//     all driven through real DOM events on a live mountSheet with a recording save.
//
// resource-derive.js is evaluated into the window before the sheet module loads,
// exactly as the page does it.
// ---------------------------------------------------------------------------
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const tick = () => new Promise(r => setTimeout(r, 0));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await tick(); };
const clone = (o) => JSON.parse(JSON.stringify(o));
let pass = 0, fail = 0;
const ok = (c, l) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + l); } };

const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
window.eval(readFileSync(new URL('./resource-derive.js', import.meta.url), 'utf8'));
ok(!!window.ResourceDerive, 'resource-derive loaded into window');

const { mountSheet } = await import('./sheet-mount.js');
const S = window.__sheet;
ok(S && typeof S.renderTrackers === 'function', '__sheet.renderTrackers exposed');
ok(S && typeof S.trackerSpecs === 'function', '__sheet.trackerSpecs exposed');

const real = (k) => JSON.parse(readFileSync(new URL('./data/characters/' + k + '.json', import.meta.url), 'utf8'));
const ids = (st) => S.trackerSpecs(st).map(s => s.id);

// ── PRE-SEED: derive order, per character, from the live classLabel shape ──
const cosmere = real('cosmere').structural, caim = real('caim').structural,
      liadan = real('liadan').structural, vesperian = real('vesperian').structural;
ok(JSON.stringify(ids(cosmere)) === JSON.stringify(['starlightStep']), 'Cosmere pre-seed → [starlightStep]');
ok(JSON.stringify(ids(caim)) === JSON.stringify(['ki']), 'Caim pre-seed → [ki]');
ok(JSON.stringify(ids(liadan)) === JSON.stringify(['bardicInspiration']), 'Liadan pre-seed → [bardicInspiration]');
ok(ids(vesperian).length === 0, 'Vesperian (Eldritch Knight) pre-seed → none');

// ── trackerOrder authoritative once present ──
const twoCustom = { classLabel: 'Monk', level: 6, abilities: { cha: { mod: 0 } },
  customResources: [{ id: 'cr_a', label: 'Alpha', origin: 'feat', max: { type: 'fixed', value: 2 }, recharge: 'short' },
                    { id: 'cr_b', label: 'Beta', origin: 'item', max: { type: 'fixed', value: 3 }, recharge: 'long' }] };
ok(JSON.stringify(ids(twoCustom)) === JSON.stringify(['ki', 'cr_a', 'cr_b']), 'pre-seed merges derived + custom in derive order');
ok(JSON.stringify(ids(Object.assign({}, twoCustom, { trackerOrder: ['cr_b', 'ki'] }))) === JSON.stringify(['cr_b', 'ki']),
  'trackerOrder filters + orders (cr_a omitted, order honoured)');
ok(JSON.stringify(ids(Object.assign({}, twoCustom, { trackerOrder: ['cr_a', 'ghost', 'ki', 'cr_b'] }))) === JSON.stringify(['cr_a', 'ki', 'cr_b']),
  'stale id in trackerOrder self-heals out');

// ── live mount helper (editable, recording save) ──
function mount(structural, vitals) {
  const ROW = { key: 'x', structural: clone(structural), vitals: clone(vitals || { hp: 10, conditions: [], pipState: {} }), notes: '' };
  const saved = [];
  const cd = { loadCharacter: () => Promise.resolve(clone(ROW)), canEdit: () => Promise.resolve(true),
               save: (k, patch) => { saved.push(clone(patch)); return Promise.resolve(clone(patch)); } };
  const container = document.createElement('div'); document.body.appendChild(container);
  mountSheet(container, 'x', { characterData: cd });
  return { container, saved };
}
const fire = (el, type, opts) => el.dispatchEvent(new dom.window.MouseEvent(type, Object.assign({ bubbles: true, cancelable: true }, opts || {})));
const keyOn = (el, key) => el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const lastStruct = (saved) => { for (let i = saved.length - 1; i >= 0; i--) if (saved[i].structural) return saved[i].structural; return null; };
const lastVitals = (saved) => { for (let i = saved.length - 1; i >= 0; i--) if (saved[i].vitals) return saved[i].vitals; return null; };

// ── NO LEAK: the original regression ──
{
  const { container } = mount(cosmere); await settle();
  const txt = container.querySelector('[data-list="trackers"]').textContent;
  ok(/Starlight Step/.test(txt), 'Cosmere panel shows Starlight Step');
  ok(!/Hexblade.s Curse/.test(txt) && !/Strength of the Grave/.test(txt), 'Cosmere panel: hardcoded leak rows are GONE');
  container.remove();
}
{
  const { container } = mount(caim); await settle();
  const txt = container.querySelector('[data-list="trackers"]').textContent;
  ok(/Ki Points/.test(txt), 'Caim panel shows Ki Points');
  ok(!/Starlight Step/.test(txt) && !/Hexblade/.test(txt), 'Caim panel: no pool leaked from another character');
  container.remove();
}

// ── SPEND: tap the boundary pip → vitals.pipState ──
{
  const { container, saved } = mount(caim); await settle();   // Ki max 3, pips
  const pips = container.querySelectorAll('.trk[data-tid="ki"] .trk-p i');
  ok(pips.length === 3 && container.querySelectorAll('.trk[data-tid="ki"] .trk-p i.on').length === 3, 'Ki renders 3 full pips');
  fire(pips[2], 'click'); await settle();                      // spend one → current 2
  const v = lastVitals(saved);
  ok(v && v.pipState && v.pipState.ki === 1, 'pip tap saved vitals.pipState.ki = 1 (one spent)');
  ok(container.querySelectorAll('.trk[data-tid="ki"] .trk-p i.on').length === 2, 'panel re-rendered to 2 filled pips');
  container.remove();
}

// ── ADD: flyout → customResources + trackerOrder ──
{
  const { container, saved } = mount(caim); await settle();
  fire(container.querySelector('[data-trk-add]'), 'click'); await settle();
  ok(!container.querySelector('[data-trk-form]').hidden, 'add-row opens the flyout');
  container.querySelector('[data-trk-name]').value = 'Channel Divinity';
  fire(container.querySelector('[data-trk-save]'), 'click'); await settle();
  const st = lastStruct(saved);
  ok(st && (st.customResources || []).length === 1 && st.customResources[0].label === 'Channel Divinity', 'add wrote one customResource');
  ok(st.customResources[0].origin === 'custom' && st.customResources[0].max.type === 'fixed' && st.customResources[0].max.value === 1, 'custom carries origin + fixed max token');
  ok(st.trackerOrder && st.trackerOrder[0] === 'ki' && st.trackerOrder.length === 2 && st.trackerOrder[1] === st.customResources[0].id, 'trackerOrder = [ki, newCustom]');
  container.remove();
}

// ── REMOVE with confirm: a derived pool → trackerOrder only ──
{
  const { container, saved } = mount(caim); await settle();
  const row = container.querySelector('.trk[data-tid="ki"]');
  fire(row.querySelector('[data-tdel]'), 'click');
  ok(row.classList.contains('confirming'), 'remove ✕ arms the two-step confirm (no write yet)');
  ok(saved.length === 0, 'no save fired on arming confirm');
  fire(row.querySelector('[data-tconfirm]'), 'click'); await settle();
  const st = lastStruct(saved);
  ok(st && Array.isArray(st.trackerOrder) && st.trackerOrder.indexOf('ki') === -1, 'confirm removed ki from trackerOrder');
  ok(!st.customResources || st.customResources.length === 0, 'derived removal did not touch customResources');
  container.remove();
}

// ── KEYBOARD REORDER: ArrowDown on a grip → trackerOrder ──
{
  const { container, saved } = mount(twoCustom); await settle();   // [ki, cr_a, cr_b]
  const grip = container.querySelector('.trk[data-tid="ki"] [data-tgrip]');
  keyOn(grip, 'ArrowDown'); await settle();
  const st = lastStruct(saved);
  ok(st && JSON.stringify(st.trackerOrder) === JSON.stringify(['cr_a', 'ki', 'cr_b']), 'ArrowDown moved ki below cr_a');
  container.remove();
}

// ── EDIT custom: ✎ → flyout prefilled → customResources updated ──
{
  const { container, saved } = mount(twoCustom); await settle();
  const editBtn = container.querySelector('.trk[data-tid="cr_a"] [data-tedit]');
  ok(!!editBtn, 'custom tracker exposes an edit affordance');
  ok(!container.querySelector('.trk[data-tid="ki"] [data-tedit]'), 'derived tracker does NOT expose edit');
  fire(editBtn, 'click'); await settle();
  ok(container.querySelector('[data-trk-name]').value === 'Alpha', 'edit prefilled the name');
  ok(container.querySelector('[data-trk-save]').textContent === 'Save changes', 'button switched to Save changes');
  container.querySelector('[data-trk-name]').value = 'Alpha Prime';
  fire(container.querySelector('[data-trk-save]'), 'click'); await settle();
  const st = lastStruct(saved);
  const a = (st.customResources || []).find(c => c.id === 'cr_a');
  ok(a && a.label === 'Alpha Prime', 'edit updated the customResource label');
  ok((st.customResources || []).length === 2, 'edit did not duplicate the resource');
  container.remove();
}

console.log((fail ? '\u2717' : '\u2713') + ' sheet-trackers: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
