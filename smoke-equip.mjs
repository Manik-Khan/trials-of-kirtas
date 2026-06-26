// smoke-equip.mjs
// ---------------------------------------------------------------------------
// The equipment paper-doll on the v11 sheet, end-to-end through real DOM events:
//   • RENDER   — the doll places worn items in their named slots; the one manifest
//                lists every item worn-first, worn rows tagged with the slot label,
//                a "Carried" divider before the rest. Attune pills only on items
//                that require attunement; non-equippable gear (rations) gets no
//                Equip control. AC-bearing slots (Armour / Off Hand) are marked.
//   • EQUIP    — tapping Equip on a carried item writes item.slot and persists; the
//                doll cell fills, the manifest row flips to worn + tagged.
//   • SWAP     — equipping into an occupied single slot bumps the occupant to carried.
//   • UNEQUIP  — tapping Unequip (doll or manifest) clears the slot + persists; AC
//                falls back to the un-slotted "best in bag" so it doesn't crater.
//   • ATTUNE   — toggling attunement fills pips; the 3-slot cap blocks a 4th (the
//                pill renders .capped and the click is inert).
//   • PERSIST  — every change calls CharacterData.save({inventory}) with the new
//                slot / attuned state; the mock captures the exact payload.
//
// armor-ac.js + equip-slots.js are eval'd into the window first (the page loads
// them); the controller (sheet-actions.js) is wired by mountSheet. jsdom ignores
// CSS, so display:none controls are still clickable — exactly what we want to
// exercise the handlers regardless of the .can-edit visibility gate.
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
window.eval(readFileSync(new URL('./armor-ac.js', import.meta.url), 'utf8'));
window.eval(readFileSync(new URL('./equip-slots.js', import.meta.url), 'utf8'));
ok(window.EquipSlots && typeof window.EquipSlots.classifyItem === 'function', 'EquipSlots present on window');
ok(window.ArmorAC && typeof window.ArmorAC.deriveAC === 'function', 'ArmorAC present on window');

// quiet feed sink so the action surface doesn't throw while mounting
window.__tok = { sb: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }), insert: () => Promise.resolve({ error: null }) }) } };

const { mountSheet } = await import('./sheet-mount.js');
const S = window.__sheet;
ok(S && typeof S.renderEquipment === 'function', '__sheet exposes renderEquipment');

const cosmere = JSON.parse(readFileSync(new URL('./data/characters/cosmere.json', import.meta.url), 'utf8'));
const fire = (el, type) => el.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true, cancelable: true }));

// Explicit slots on the armour/shield/sword so the first-load backfill no-ops and
// we control the exact starting board; the magic items + rations start carried.
const INV = [
  { id: 'plate',   name: 'Plate',               type: 'HA', ac: 18, slot: 'ARMOUR'   },
  { id: 'shield',  name: 'Shield',              type: 'S',  ac: 2,  slot: 'OFFHAND'  },
  { id: 'sword',   name: 'Longsword',           type: 'M',          slot: 'MAINHAND' },
  { id: 'cloak',   name: 'Cloak of Protection', type: 'W',  reqAttune: 'Requires Attunement' },
  { id: 'ring',    name: 'Ring of Protection',  type: 'RG', reqAttune: 'Requires Attunement' },
  { id: 'amulet',  name: 'Amulet of Health',    type: 'W',  reqAttune: 'Requires Attunement' },
  { id: 'wand',    name: 'Wand of Web',         type: 'WD', reqAttune: 'Requires Attunement' },
  { id: 'rations', name: 'Rations',             type: 'G' },
];
// inventory-array indices (data-eq / data-at carry these, NOT the sorted position)
const IDX = { plate: 0, shield: 1, sword: 2, cloak: 3, ring: 4, amulet: 5, wand: 6, rations: 7 };

let saved = null;
function mount() {
  const ROW = clone(cosmere); ROW.key = 'cosmere'; ROW.inventory = clone(INV);
  if (!ROW.vitals) ROW.vitals = { hp: 10, conditions: [], pipState: {} };
  saved = null;
  const cd = {
    loadCharacter: () => Promise.resolve(clone(ROW)),
    canEdit: () => Promise.resolve(true),
    save: (key, patch) => { if (patch && patch.inventory) saved = clone(patch.inventory); return Promise.resolve(patch); },
  };
  const c = document.createElement('div'); document.body.appendChild(c);
  mountSheet(c, ROW.key, { characterData: cd });
  return c;
}
const cell = (c, k) => c.querySelector('.eq-slot[data-slot="' + k + '"]');
const cellItem = (c, k) => { const s = cell(c, k); const t = s && s.querySelector('.sl-item'); return t ? t.textContent.replace(/\u2726/g, '').trim() : null; };
const isFilled = (c, k) => { const s = cell(c, k); return !!(s && s.classList.contains('filled')); };
const rowByText = (c, re) => [...c.querySelectorAll('.gitem')].find(e => re.test(e.textContent)) || null;
const pipsOn = (c) => c.querySelectorAll('[data-equip-attune] .pip.on').length;

// ── RENDER ──
const C = mount(); await settle();
{
  eq(C.querySelectorAll('.eq-slot.filled').length, 3, 'render: three slots filled (armour/shield/sword)');
  eq(C.querySelectorAll('.eq-slot.empty').length, 5, 'render: five slots empty');
  eq(cellItem(C, 'ARMOUR'), 'Plate', 'render: Armour slot holds Plate');
  eq(cellItem(C, 'OFFHAND'), 'Shield', 'render: Off Hand slot holds Shield');
  eq(cellItem(C, 'MAINHAND'), 'Longsword', 'render: Main Hand holds Longsword');
  ok(cell(C, 'ARMOUR').classList.contains('ac') && cell(C, 'OFFHAND').classList.contains('ac'), 'render: AC-bearing slots flagged');
  ok(!cell(C, 'HEAD').classList.contains('ac'), 'render: non-AC slot not flagged');

  // manifest: worn-first, tagged; a Carried divider; then the rest
  const rows = [...C.querySelectorAll('[data-equip] .gitem')];
  ok(rows.length >= 8, 'render: manifest lists every item');
  eq(C.querySelectorAll('[data-equip] .gitem.worn').length, 3, 'render: three worn rows in manifest');
  ok(C.querySelector('[data-equip] .inv-div'), 'render: Carried divider present');
  const plateRow = rowByText(C, /Plate/);
  ok(plateRow && /Armour/i.test(plateRow.querySelector('.inv-tag') ? plateRow.querySelector('.inv-tag').textContent : ''), 'render: worn Plate tagged "Armour"');

  // controls: carried magic items get Attune; rations (gear) gets no Equip; wand attunes but cannot be worn
  ok(rowByText(C, /Cloak of Protection/).querySelector('[data-at]'), 'render: Cloak has an Attune control');
  ok(!rowByText(C, /Rations/).querySelector('[data-eq]'), 'render: Rations (gear) has no Equip control');
  ok(rowByText(C, /Wand of Web/).querySelector('[data-at]'), 'render: Wand has an Attune control');
  ok(!rowByText(C, /Wand of Web/).querySelector('[data-eq]'), 'render: Wand (no slot) has no Equip control');
  eq(pipsOn(C), 0, 'render: zero attunement pips lit');
}

// ── EQUIP a carried item (Cloak → Cloak slot) ──
{
  const btn = C.querySelector('[data-eq="' + IDX.cloak + '"]');
  ok(btn, 'equip: Cloak Equip control found');
  fire(btn, 'click'); await settle();
  ok(isFilled(C, 'CLOAK'), 'equip: Cloak slot now filled');
  eq(cellItem(C, 'CLOAK'), 'Cloak of Protection', 'equip: Cloak seated in its slot');
  ok(saved && saved[IDX.cloak].slot === 'CLOAK', 'equip: persisted cloak.slot = CLOAK');
  ok(rowByText(C, /Cloak of Protection/).classList.contains('worn'), 'equip: manifest row flipped to worn');
}

// ── SWAP into an occupied single slot (Ring → RING1, then a 2nd ring bumps?) ──
// Equip the Ring; it takes the first open ring slot (RING1).
{
  const btn = C.querySelector('[data-eq="' + IDX.ring + '"]');
  ok(btn, 'swap: Ring Equip control found');
  fire(btn, 'click'); await settle();
  ok(isFilled(C, 'RING1'), 'swap: Ring seated in first ring slot');
  ok(saved && saved[IDX.ring].slot === 'RING1', 'swap: persisted ring.slot = RING1');
}

// ── UNEQUIP the Plate (Armour) — AC should fall back, not crater ──
{
  const acBefore = C.querySelector('[data-f="ac"]') ? C.querySelector('[data-f="ac"]').textContent : null;
  const btn = C.querySelector('[data-equip] .gitem.worn [data-un="ARMOUR"]') || C.querySelector('[data-un="ARMOUR"]');
  ok(btn, 'unequip: Armour Unequip control found');
  fire(btn, 'click'); await settle();
  ok(!isFilled(C, 'ARMOUR'), 'unequip: Armour slot now empty');
  ok(saved && saved[IDX.plate].slot == null, 'unequip: persisted plate.slot cleared');
  // plate returns to the manifest as carried (un-tagged, equippable again)
  ok(!rowByText(C, /Plate/).classList.contains('worn'), 'unequip: Plate row back to carried');
  ok(rowByText(C, /Plate/).querySelector('[data-eq]'), 'unequip: Plate offers Equip again');
}

// ── ATTUNE up to the cap, then block the 4th ──
{
  fire(C.querySelector('[data-at="' + IDX.cloak + '"]'), 'click'); await settle();
  eq(pipsOn(C), 1, 'attune: one pip after first attune');
  fire(C.querySelector('[data-at="' + IDX.ring + '"]'), 'click'); await settle();
  fire(C.querySelector('[data-at="' + IDX.amulet + '"]'), 'click'); await settle();
  eq(pipsOn(C), 3, 'attune: three pips at the cap');
  ok(saved && saved[IDX.cloak].attuned && saved[IDX.ring].attuned && saved[IDX.amulet].attuned, 'attune: persisted three attunements');

  // the 4th (wand) must be capped + inert
  const wandBtn = C.querySelector('[data-at="' + IDX.wand + '"]');
  ok(wandBtn && wandBtn.classList.contains('capped'), 'cap: 4th attune control renders .capped');
  saved = null;
  fire(wandBtn, 'click'); await settle();
  eq(pipsOn(C), 3, 'cap: still three pips after tapping the capped control');
  ok(saved == null, 'cap: capped tap wrote nothing');

  // release one, and the cap re-opens
  fire(C.querySelector('[data-at="' + IDX.cloak + '"]'), 'click'); await settle();
  eq(pipsOn(C), 2, 'release: dropping one attunement frees a slot');
  ok(!C.querySelector('[data-at="' + IDX.wand + '"]').classList.contains('capped'), 'release: 4th control no longer capped');
}

// ── DEGRADE: with no EquipSlots, renderEquipment falls back to a plain list ──
{
  const stash = window.EquipSlots; delete window.EquipSlots;
  const host = document.createElement('div');
  host.innerHTML = '<div data-sec="inventory"><span data-equip-attune></span><div class="eq-grid" data-equip-slots></div><div data-equip></div></div><span data-attune></span>';
  S.renderEquipment(host, clone(INV), {});
  eq(host.querySelector('[data-equip-slots]').innerHTML, '', 'degrade: doll grid empty without EquipSlots');
  ok(host.querySelectorAll('[data-equip] .gitem').length >= 8, 'degrade: manifest still lists items');
  ok(!host.querySelector('[data-equip] .eq-pill'), 'degrade: no equip controls without EquipSlots');
  window.EquipSlots = stash;
}

console.log((fail ? 'FAIL' : 'PASS') + ' \u2014 smoke-equip: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
