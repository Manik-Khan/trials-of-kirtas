// smoke-sheet-attacks.mjs
// ---------------------------------------------------------------------------
// The live Actions surface on the v11 sheet, end-to-end through real DOM events:
//   • DERIVE   — deriveActionMods computes hit/damage from a chosen ability +
//                proficiency, and falls back to flat hitMod/dmgMod with none set.
//   • RENDER   — actions paint grouped (Attacks / Bonus damage / Utility) with the
//                derived to-hit / damage meta; data-act on each row.
//   • ROLL     — tapping an attack rolls through DiceEngine (RNG stubbed for a
//                known outcome), paints a result card, and posts to the feed via
//                window.__battle.onLogRoll with the engine's exact strings.
//   • TOGGLES  — Adv/Dis/Bless flip, apply to the roll, and consume afterward.
//   • DMG-ONLY — bonus-damage actions roll damage with no to-hit line.
//   • UTILITY  — utility rows are inert (note shown inline; click does nothing).
//
// dice-engine.js + resource-derive.js are evaluated into the window first, as the
// page loads them. Rolling is stateless, so assertions are on the feed + the
// result DOM, not on any saved vitals.
// ---------------------------------------------------------------------------
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const tick = () => new Promise(r => setTimeout(r, 0));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await tick(); };
const clone = (o) => JSON.parse(JSON.stringify(o));
let pass = 0, fail = 0;
const ok = (c, l) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + l); } };
const eq = (a, b, l) => ok(a === b, l + (a === b ? '' : '  (got ' + JSON.stringify(a) + ', exp ' + JSON.stringify(b) + ')'));

const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
window.eval(readFileSync(new URL('./resource-derive.js', import.meta.url), 'utf8'));
window.eval(readFileSync(new URL('./dice-engine.js', import.meta.url), 'utf8'));
ok(window.DiceEngine && typeof window.DiceEngine.rollAction === 'function', 'DiceEngine present on window');

// RNG stub — the engine is eval'd into the jsdom window, so it uses
// window.Math.random (a different realm than node's global Math). Stub both.
let queue = [];
const realGlobal = Math.random, realWin = window.Math.random;
const stub = () => { if (!queue.length) throw new Error('random underflow'); return queue.shift(); };
Math.random = stub; window.Math.random = stub;
const rq = (want, sides) => ((want - 1) + 0.5) / sides;
const setDice = (arr) => { queue = arr.slice(); };

let feedLog = [];
window.__battle = { onLogRoll: (o) => feedLog.push(o) };

const { mountSheet } = await import('./sheet-mount.js');
const S = window.__sheet;
ok(typeof S.deriveActionMods === 'function' && typeof S.renderActions === 'function', '__sheet exposes action helpers');

const cosmere = JSON.parse(readFileSync(new URL('./data/characters/cosmere.json', import.meta.url), 'utf8'));
const fire = (el, type, opts) => el.dispatchEvent(new dom.window.MouseEvent(type, Object.assign({ bubbles: true, cancelable: true }, opts || {})));

function mount(row) {
  const ROW = clone(row); ROW.key = ROW.key || 'cosmere';
  if (!ROW.vitals) ROW.vitals = { hp: 10, conditions: [], pipState: {} };
  const cd = { loadCharacter: () => Promise.resolve(clone(ROW)), canEdit: () => Promise.resolve(true), save: () => Promise.resolve({}) };
  const container = document.createElement('div'); document.body.appendChild(container);
  mountSheet(container, ROW.key, { characterData: cd });
  return container;
}
const actEl = (c, id) => { const els = c.querySelectorAll('.act[data-act]'); for (const e of els) if (e.getAttribute('data-act') === id) return e; return null; };

// ── DERIVE ──
{
  const s = cosmere.structural; // cha +3, prof +2
  const a = { ability: 'cha', proficient: true, dmgAbility: true, dmgDice: '1d8', atkBonus: 0, dmgBonus: 0 };
  let m = S.deriveActionMods(a, s);
  eq(m.hitMod, 5, 'derive: CHA+prof → +5 hit'); eq(m.dmgMod, 3, 'derive: CHA → +3 dmg'); eq(m.abil, 'CHA', 'derive: ability label');
  m = S.deriveActionMods(Object.assign({}, a, { ability: 'str' }), s);
  eq(m.hitMod, 3, 'derive: STR+prof → +3'); eq(m.dmgMod, 1, 'derive: STR → +1');
  m = S.deriveActionMods({ hitMod: 7, dmgMod: 2 }, s);
  eq(m.hitMod, 7, 'derive: flat fallback hit'); eq(m.dmgMod, 2, 'derive: flat fallback dmg');
}

// ── RENDER ──
const C = mount(cosmere); await settle();
{
  const groups = [...C.querySelectorAll('.agrp .agrp-h')].map(e => e.textContent);
  ok(groups.includes('Attacks'), 'render: Attacks group present');
  ok(groups.includes('Bonus damage') || groups.includes('Utility'), 'render: secondary groups present');
  const ls = actEl(C, 'longsword') || [...C.querySelectorAll('.act')].find(e => /Longsword/.test(e.textContent));
  ok(ls && /to hit/i.test(ls.textContent) && /1d8/.test(ls.textContent), 'render: attack row shows to-hit + damage');
  const sh = [...C.querySelectorAll('.act.utility')].find(e => /Shield/.test(e.textContent));
  ok(sh && !sh.getAttribute('tabindex'), 'render: utility row is non-interactive (no tabindex)');
}

// ── ROLL an attack (longsword: kept 14, dmg 6 → 1d8) ──
{
  feedLog = [];
  setDice([rq(14, 20), rq(3, 20), rq(6, 8)]);
  const ls = actEl(C, 'longsword'); ok(ls, 'longsword row found'); fire(ls, 'click'); await settle();
  eq(feedLog.length, 1, 'roll: one feed post');
  eq(feedLog[0].name, 'Longsword', 'roll: feed actor/name');
  ok(/b-rh-total">19</.test(feedLog[0].main), 'roll: feed main carries engine total (19)');
  ok(/<strong>9<\/strong>/.test(feedLog[0].dmg), 'roll: feed dmg carries 9');
  const card = C.querySelector('.actionresult .rcard.latest');
  ok(card, 'roll: result card rendered');
  ok(card && /19/.test(card.textContent) && /9/.test(card.textContent), 'roll: card shows hit total + damage');
}

// ── ADVANTAGE toggle applies + consumes ──
{
  feedLog = [];
  const adv = C.querySelector('[data-rmod="advantage"]');
  fire(adv, 'click'); await settle();
  ok(adv.classList.contains('on'), 'adv: toggle on');
  setDice([rq(9, 20), rq(17, 20), rq(4, 8)]);      // adv keeps 17 (drop 9)
  fire(actEl(C, 'longsword'), 'click'); await settle();
  const card = C.querySelector('.actionresult .rcard.latest');
  ok(card && card.querySelector('.rcd-die.drop'), 'adv: result shows a dropped die');
  ok(/b-rh-total">22</.test(feedLog[0].main), 'adv: kept the higher die (17+5=22)');
  ok(!adv.classList.contains('on'), 'adv: toggle consumed after roll');
}

// ── BONUS DAMAGE (no to-hit) ──
{
  feedLog = [];
  const hex = actEl(C, 'hex') || [...C.querySelectorAll('.act.damage')][0];
  ok(hex, 'damage-only row found');
  setDice([rq(4, 6)]);
  fire(hex, 'click'); await settle();
  const card = C.querySelector('.actionresult .rcard.latest');
  ok(card && /Damage/i.test(card.textContent) && !/To hit/i.test(card.textContent), 'dmg-only: damage line, no to-hit');
  ok(feedLog.length === 1 && /b-rh-total/.test(feedLog[0].main), 'dmg-only: posted to feed');
}

// ── UTILITY is inert ──
{
  feedLog = [];
  const before = C.querySelectorAll('.actionresult .rcard').length;
  const sh = [...C.querySelectorAll('.act.utility')].find(e => /Shield/.test(e.textContent));
  fire(sh, 'click'); await settle();
  eq(feedLog.length, 0, 'utility: no feed post on click');
  eq(C.querySelectorAll('.actionresult .rcard').length, before, 'utility: no new result card');
}

Math.random = realGlobal; window.Math.random = realWin;
console.log((fail === 0 ? '\u2713' : '\u2717') + ' sheet-attacks: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
