// smoke-sheet-custom-features.mjs
// ---------------------------------------------------------------------------
// Proves the sheet-side custom (passive) feature add / remove, end-to-end, on a
// live mountSheet with a recording save — the same harness the tracker smoke uses.
//   • RENDER   — derived features stay read-only (no ✕); custom ones (from
//                structural.customFeatures) render with a remove control.
//   • ADD      — flyout → structural.customFeatures (id/name/desc), panel updates.
//   • SEPARATE — add/remove never touch structural.features (the derive's field),
//                so a hand-added feature survives re-forging.
//   • REMOVE   — ✕ filters the row out of customFeatures.
//   • VIEW-ONLY — non-editor sees no add button and ✕ is inert (no write).
//   • REVERT   — a failed save rolls the optimistic edit back.
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
window.eval(readFileSync(new URL('../../resource-derive.js', import.meta.url), 'utf8'));

const { mountSheet } = await import('../../sheet-mount.js');
const real = (k) => JSON.parse(readFileSync(new URL('../../data/characters/' + k + '.json', import.meta.url), 'utf8'));

// deterministic base: a real (mountable) structural, with a known derived feature set
const DERIVED = [
  { name: 'Pact Magic', desc: 'Short-rest pact slots, all at highest level.', source: 'class:Warlock' },
  { name: 'Starlight Step', desc: 'Teleport 30 ft as a bonus action.', source: 'race:Astral Elf' }
];
const base = (customFeatures) => Object.assign({}, real('cosmere').structural,
  { features: clone(DERIVED) }, customFeatures ? { customFeatures: clone(customFeatures) } : {});

async function mount(structural, opts) {
  opts = opts || {};
  const ROW = { key: 'x', structural: clone(structural), vitals: { hp: 10, conditions: [], pipState: {} }, notes: '' };
  const saved = [];
  const cd = {
    loadCharacter: () => Promise.resolve(clone(ROW)),
    canEdit: () => Promise.resolve(opts.canEdit !== false),
    save: (k, patch) => { saved.push(clone(patch)); return opts.saveThrows ? Promise.reject(new Error('save boom')) : Promise.resolve(clone(patch)); }
  };
  const container = document.createElement('div'); document.body.appendChild(container);
  const handle = mountSheet(container, 'x', { characterData: cd });
  try { await (handle && handle.ready); } catch (_) {}   // the initial data render is depsReady-gated
  await settle(8);                                        // let wireInspiration finish binding (canEdit + form wiring)
  return { container, saved };
}
const fire = (el, type) => el.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true, cancelable: true }));
const lastStruct = (saved) => { for (let i = saved.length - 1; i >= 0; i--) if (saved[i].structural) return saved[i].structural; return null; };
const panel = (c) => c.querySelector('[data-list="features"]');

// ── RENDER: derived read-only + seeded custom with a remove control ──
{
  const { container } = await mount(base([{ id: 'cf_seed', name: 'Oath of the Wanderer', desc: 'Reroll a failed save vs charm/fright once per long rest.' }]));
  await settle();
  const p = panel(container);
  ok(!!p, 'features panel mounted');
  ok(/Pact Magic/.test(p.textContent) && /Starlight Step/.test(p.textContent), 'derived features render');
  ok(p.querySelectorAll('.feat:not(.is-custom)').length === 2, 'two derived rows, none marked custom');
  ok(p.querySelectorAll('.feat:not(.is-custom) .f-del').length === 0, 'derived features have NO remove control (read-only)');
  ok(/Oath of the Wanderer/.test(p.textContent), 'seeded custom feature renders');
  const cf = p.querySelector('.feat.is-custom');
  ok(!!cf && /t-custom/.test(cf.querySelector('.f-tag').className), 'custom row carries the Custom tag');
  ok(!!cf.querySelector('[data-cf-del="cf_seed"]'), 'custom row exposes a remove control');
  ok(!!container.querySelector('[data-cf-add]'), 'editor sees the + Add feature button');
  container.remove();
}

// ── ADD: flyout → customFeatures; derived features untouched ──
{
  const { container, saved } = await mount(base());
  await settle();
  const featsBefore = clone(real('cosmere').structural.features || DERIVED);  // reference for separation check
  fire(container.querySelector('[data-cf-add]'), 'click'); await settle();
  ok(!container.querySelector('[data-cf-form]').hidden, 'add button opens the form');
  container.querySelector('[data-cf-name]').value = 'Oath of the Wanderer';
  container.querySelector('[data-cf-desc]').value = 'Reroll a failed save vs charm/fright once per long rest.';
  fire(container.querySelector('[data-cf-save]'), 'click'); await settle();
  const st = lastStruct(saved);
  ok(st && (st.customFeatures || []).length === 1, 'add wrote exactly one customFeature');
  ok(st.customFeatures[0].name === 'Oath of the Wanderer' && /charm\/fright/.test(st.customFeatures[0].desc), 'name + desc persisted');
  ok(/^cf_/.test(st.customFeatures[0].id), 'custom feature got a cf_ id');
  ok(JSON.stringify(st.features) === JSON.stringify(DERIVED), 'structural.features UNTOUCHED by the add (reforge-safe separation)');
  ok(/Oath of the Wanderer/.test(panel(container).textContent), 'panel re-rendered with the new custom feature');
  ok(container.querySelector('[data-cf-form]').hidden, 'form closed after save');
  container.remove();
}

// ── REMOVE: ✕ filters customFeatures; derived untouched ──
{
  const { container, saved } = await mount(base([
    { id: 'cf_a', name: 'Keeper of Secrets', desc: 'A.' },
    { id: 'cf_b', name: 'Wandering Step', desc: 'B.' }
  ]));
  await settle();
  ok(panel(container).querySelectorAll('.feat.is-custom').length === 2, 'two custom rows render');
  fire(container.querySelector('[data-cf-del="cf_a"]'), 'click'); await settle();
  const st = lastStruct(saved);
  ok(st && (st.customFeatures || []).length === 1 && st.customFeatures[0].id === 'cf_b', 'remove filtered cf_a, kept cf_b');
  ok(JSON.stringify(st.features) === JSON.stringify(DERIVED), 'remove did not touch structural.features');
  ok(!panel(container).querySelector('[data-cf-del="cf_a"]'), 'removed row is gone from the panel');
  ok(!!panel(container).querySelector('[data-cf-del="cf_b"]'), 'the other custom row remains');
  container.remove();
}

// ── VIEW-ONLY: non-editor — no add button, ✕ inert ──
{
  const { container, saved } = await mount(base([{ id: 'cf_x', name: 'Read-only Trait', desc: '.' }]), { canEdit: false });
  await settle();
  const add = container.querySelector('[data-cf-add]');
  ok(add && add.classList.contains('view-only'), 'add button is view-only (hidden) for non-editors');
  ok(/Read-only Trait/.test(panel(container).textContent), 'custom features still render read-only');
  const del = container.querySelector('[data-cf-del="cf_x"]');
  if (del) fire(del, 'click');
  await settle();
  ok(saved.length === 0, 'clicking ✕ as a non-editor writes nothing');
  container.remove();
}

// ── REVERT: a failing save rolls the optimistic add back ──
{
  const { container, saved } = await mount(base(), { saveThrows: true });
  await settle();
  fire(container.querySelector('[data-cf-add]'), 'click'); await settle();
  container.querySelector('[data-cf-name]').value = 'Doomed Feature';
  fire(container.querySelector('[data-cf-save]'), 'click'); await settle();
  ok(saved.length === 1, 'save was attempted');
  ok(!/Doomed Feature/.test(panel(container).textContent), 'optimistic feature reverted after the save threw');
  container.remove();
}

console.log((fail ? '\u2717' : '\u2713') + ' sheet-custom-features: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
