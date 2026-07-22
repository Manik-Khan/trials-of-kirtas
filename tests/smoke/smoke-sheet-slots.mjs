// smoke-sheet-slots.mjs
// ---------------------------------------------------------------------------
// Proves the live Spellcasting surface on the v11 sheet, end-to-end, through
// real DOM events on a mounted sheet with a recording save:
//   • SHAPE      — buildSpellcasting emits pools with keys + levels and spells
//                  carrying base level + concentration, per character.
//   • SLOT SPEND — slot pips render with data-slot/data-i; tapping one writes
//                  vitals.pipState[poolKey]; a manual nudge stays QUIET (no feed).
//   • CANTRIP    — tapping a cantrip posts to the feed, spends no slot.
//   • PICKER     — a leveled spell with 2+ paying pools opens the .sa-cast
//                  popover (player picks level + pool); one paying pool casts
//                  directly with no popover.
//   • UPCAST     — Liadan casting a 1st-level spell is offered 1st AND 2nd
//                  (marked upcast); picking 2nd writes pipState.spell_2.
//   • CONC       — a concentration cast sets vitals.concentration + renders the
//                  banner; the banner ✕ clears it; casting a new concentration
//                  spell over an old one confirms ONCE (the commit-time guard),
//                  not twice.
//   • FEED       — casts/concentration changes post to the feed via window.__tok.sb
//                  (postFeed inserts into `feed`); pip nudges do not.
//
// resource-derive.js is evaluated into the window before the sheet module loads,
// exactly as the page does it. Each scenario uses its own mount to avoid coupling.
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
window.SoulShardsData = { loadSpellMeta: (names) => Promise.resolve([{ name: names[0], level: 1, school: 'A', entries: ['Test spell.'] }]) };

// feed sink + confirm stub (reassigned per scenario where needed)
let feedLog = [];
const mockSB = {
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
    insert: (row) => { feedLog.push(row); return Promise.resolve({ error: null }); },
  }),
};
window.__tok = { sb: mockSB };
window.confirm = () => true;

const { mountSheet } = await import('../../sheet-mount.js');
const S = window.__sheet;
ok(S && typeof S.buildSpellcasting === 'function', '__sheet.buildSpellcasting exposed');
ok(S && typeof S.renderConcentration === 'function', '__sheet.renderConcentration exposed');

const real = (k) => JSON.parse(readFileSync(new URL('../../data/characters/' + k + '.json', import.meta.url), 'utf8'));
const cosmereRow = real('cosmere'), liadanRow = real('liadan');

const fire = (el, type, opts) => el.dispatchEvent(new dom.window.MouseEvent(type, Object.assign({ bubbles: true, cancelable: true }, opts || {})));
const lastVitals = (saved) => { for (let i = saved.length - 1; i >= 0; i--) if (saved[i].vitals) return saved[i].vitals; return null; };

async function mount(row) {
  const ROW = clone(row); ROW.key = ROW.key || 'x';
  if (!ROW.vitals) ROW.vitals = { hp: 10, conditions: [], pipState: {} };
  const saved = [];
  const cd = { loadCharacter: () => Promise.resolve(clone(ROW)), canEdit: () => Promise.resolve(true),
               save: (k, patch) => { saved.push(clone(patch)); return Promise.resolve(clone(patch)); } };
  const container = document.createElement('div'); document.body.appendChild(container);
  const handle = mountSheet(container, ROW.key, { characterData: cd }); try { await (handle && handle.ready); } catch (_) {} await settle(8);
  return { container, saved };
}
function cleanup(container) { if (container) container.remove(); document.querySelectorAll('.sa-pop').forEach(p => p.remove()); }
const spell = (c, name) => { const els = c.querySelectorAll('.spell[data-spell]'); for (const e of els) if (e.getAttribute('data-spell') === name) return e; return null; };
async function beginCast(c, name) {
  fire(spell(c, name), 'click'); await settle();
  const buttons = c.querySelectorAll('[data-spell-go]');
  const cast = [...buttons].find(b => b.getAttribute('data-spell-go') === name);
  fire(cast, 'click'); await settle();
}

// ── SHAPE ──
{
  const sc = S.buildSpellcasting(cosmereRow.structural, { pipState: {} });
  ok(sc.pools.map(p => p.key).join(',') === 'pactSlots,sorc_1,sorcery', 'cosmere pool keys = pactSlots,sorc_1,sorcery');
  ok(sc.pools[0].level === 1 && sc.pools[1].level === 1 && sc.pools[2].level === 0, 'cosmere pool levels [1,1,0]');
  const g1 = sc.groups.filter(g => g.level === 1)[0];
  ok(g1 && g1.spells.some(s => s.name === 'Hex' && s.conc), 'cosmere 1st-level group carries Hex with conc flag');
  const lc = S.buildSpellcasting(liadanRow.structural, { pipState: {} });
  ok(lc.pools.map(p => p.key + ':' + p.level).join(',') === 'spell_1:1,spell_2:2', 'liadan pools spell_1:1, spell_2:2');
}

// ── SLOT SPEND is quiet; writes pipState ──
{
  feedLog = [];
  const { container, saved } = await mount(cosmereRow); await settle();
  const sorc = container.querySelectorAll('[data-list="pools"] .slot[data-slot="sorc_1"]');
  ok(sorc.length === 2, 'sorc_1 renders 2 slot pips with data-slot');
  ok(sorc[1].getAttribute('data-i') === '1', 'pip carries its index (data-i)');
  fire(sorc[1], 'click'); await settle();                    // cur 2, tap i=1 → cur 1 → spent 1
  const v = lastVitals(saved);
  ok(v && v.pipState && v.pipState.sorc_1 === 1, 'slot tap wrote vitals.pipState.sorc_1 = 1');
  ok(container.querySelectorAll('[data-list="pools"] .slot[data-slot="sorc_1"].on').length === 1, 're-rendered to 1 filled sorcerer pip');
  ok(feedLog.length === 0, 'manual slot nudge posts NOTHING to the feed (quiet)');
  cleanup(container);
}

// ── CANTRIP cast: feed, no slot ──
{
  feedLog = [];
  const { container, saved } = await mount(cosmereRow); await settle();
  await beginCast(container, 'Minor Illusion');
  ok(feedLog.length === 1 && /Minor Illusion/.test(feedLog[0].body), 'utility cantrip posted to feed (no action-roll bridge)');
  const v = lastVitals(saved);
  ok(!v || !v.pipState || Object.keys(v.pipState).length === 0, 'cantrip spent no slot');
  ok(!v || !v.concentration, 'cantrip set no concentration');
  cleanup(container);
}

// ── PICKER (2 paying pools) + concentration set + strip + drop ──
{
  feedLog = [];
  const { container, saved } = await mount(cosmereRow); await settle();
  await beginCast(container, 'Hex');                            // 1st-level, conc; pact + sorc both pay
  const pop = document.querySelector('.sa-cast');
  ok(pop, 'two paying pools → .sa-cast picker popover appears');
  const btns = pop ? pop.querySelectorAll('.scp-btn[data-pk]') : [];
  ok(btns.length === 2, 'picker offers both pools');
  ok([...btns].some(b => b.getAttribute('data-pk') === 'pactSlots') && [...btns].some(b => b.getAttribute('data-pk') === 'sorc_1'), 'picker lists pactSlots + sorc_1');
  const pactBtn = [...btns].find(b => b.getAttribute('data-pk') === 'pactSlots');
  fire(pactBtn, 'click'); await settle();
  const v = lastVitals(saved);
  ok(v && v.pipState && v.pipState.pactSlots === 1, 'picking Pact spent pipState.pactSlots');
  ok(v && v.concentration && v.concentration.name === 'Hex', 'concentration set to Hex');
  ok(!document.querySelector('.sa-cast'), 'picker closes after a pick');
  const concVal = container.querySelector('[data-conc-val]');
  ok(concVal && !concVal.classList.contains('muted') && /Hex/.test(concVal.textContent) && !!concVal.querySelector('[data-conc-drop]'), 'concentration strip renders Hex with a drop control');
  ok(feedLog.some(f => /Hex/.test(f.body) && /concentration/.test(f.body)), 'cast posted to feed with concentration note');
  // drop via the strip ✕
  feedLog = [];
  fire(concVal.querySelector('[data-conc-drop]'), 'click'); await settle();
  const v2 = lastVitals(saved);
  ok(v2 && v2.concentration === null, 'drop ✕ cleared concentration');
  const concVal2 = container.querySelector('[data-conc-val]');
  ok(concVal2 && concVal2.classList.contains('muted') && /none/i.test(concVal2.textContent) && !concVal2.querySelector('[data-conc-drop]'), 'concentration strip cleared after drop');
  ok(feedLog.some(f => /Hex/.test(f.body) && /dropped/.test(f.body)), 'drop posted to feed');
  cleanup(container);
}

// ── SINGLE paying pool casts directly (no popover): Liadan / Aid (2nd only) ──
{
  feedLog = [];
  const { container, saved } = await mount(liadanRow); await settle();
  await beginCast(container, 'Aid');                            // base 2 → only spell_2 pays
  ok(!document.querySelector('.sa-cast'), 'one paying pool → no picker');
  const v = lastVitals(saved);
  ok(v && v.pipState && v.pipState.spell_2 === 1, 'Aid spent spell_2 directly');
  cleanup(container);
}

// ── UPCAST: Liadan 1st-level spell offered 1st + 2nd; pick 2nd ──
{
  feedLog = [];
  const { container, saved } = await mount(liadanRow); await settle();
  await beginCast(container, 'Cure Wounds');                       // base 1 → spell_1 + spell_2(upcast)
  const pop = document.querySelector('.sa-cast');
  ok(pop, 'Cure Wounds opens picker (two slot levels available)');
  const btns = pop ? [...pop.querySelectorAll('.scp-btn[data-pk]')] : [];
  ok(btns.length === 2, 'picker shows 1st + 2nd');
  ok(btns.some(b => b.getAttribute('data-pk') === 'spell_2' && /upcast/i.test(b.textContent)), '2nd-level option is flagged upcast');
  fire(btns.find(b => b.getAttribute('data-pk') === 'spell_2'), 'click'); await settle();
  const v = lastVitals(saved);
  ok(v && v.pipState && v.pipState.spell_2 === 1 && !v.pipState.spell_1, 'upcast spent spell_2, not spell_1');
  ok(feedLog.some(f => /Cure Wounds/.test(f.body) && /upcast/i.test(f.body)), 'feed records the upcast');
  cleanup(container);
}

// ── REPLACE-GUARD fires exactly ONCE (the double-confirm regression) ──
{
  feedLog = [];
  let confirmCount = 0;
  window.confirm = () => { confirmCount++; return true; };
  const { container, saved } = await mount(liadanRow); await settle();
  // cast Bless (conc) at 1st level
  await beginCast(container, 'Bless');
  fire([...document.querySelectorAll('.sa-cast .scp-btn[data-pk]')].find(b => b.getAttribute('data-pk') === 'spell_1'), 'click'); await settle();
  ok(lastVitals(saved).concentration.name === 'Bless', 'Bless concentration established');
  ok(confirmCount === 0, 'no confirm when nothing was being concentrated on');
  // cast Detect Magic (conc) over Bless → one confirm at commit
  await beginCast(container, 'Detect Magic');
  ok(confirmCount === 0, 'opening the picker does NOT prompt the guard');
  fire([...document.querySelectorAll('.sa-cast .scp-btn[data-pk]')].find(b => b.getAttribute('data-pk') === 'spell_1'), 'click'); await settle();
  ok(confirmCount === 1, 'replace-guard prompted exactly once (commit-time)');
  ok(lastVitals(saved).concentration.name === 'Detect Magic', 'concentration swapped to Detect Magic');
  window.confirm = () => true;
  cleanup(container);
}

console.log((fail === 0 ? '\u2713' : '\u2717') + ' sheet-slots: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
