// smoke-gear-2a-render.mjs
// GearManager's 2a render surface: editable coin inputs, currency relocated to a
// bottom footer (out of the top meta), a lock pill in row controls, and lock
// indicators (class + glyph) on both list rows and grid tiles.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const GM_SRC = readFileSync(new URL('./gear-manager.js', import.meta.url), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };

function render(view) {
  const dom = new JSDOM('<!doctype html><body><div id="host" class="tok-sheet"><div data-sec="inventory"><div id="box"></div></div></body>', { runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window, d = w.document;
  const s = d.createElement('script'); s.textContent = GM_SRC; d.body.appendChild(s);
  const box = d.getElementById('box');
  const ES = { SLOTS: [{ key: 'mainHand', label: 'Main Hand' }], canEquip: it => it && (it.cat === 'weapon' || it.slot === 'mainHand') };
  const inv = [
    { id: 'sword', name: 'Longsword', slot: 'mainHand', cat: 'weapon', weight: 3 },
    { id: 'scroll', name: 'Old Scroll', weight: 0, locked: true },
    { id: 'bag', name: 'Backpack', isContainer: true, weight: 5, locked: true }
  ];
  box.__gmState = { view: view || 'list', open: Object.create(null) };
  w.GearManager.render(box, { inventory: inv, currency: { gp: 7, sp: 3 }, ES, strScore: 15 });
  return { d, box, sec: box.closest('[data-sec="inventory"]') };
}

console.log('--- editable currency + footer ---');
{
  const { box } = render('list');
  const foot = box.querySelector('.gm-currency-foot');
  ok(foot, 'currency footer exists');
  ok(foot && foot.querySelector('.gm-currency'), 'currency lives inside the footer');
  ok(!box.querySelector('.gm-meta .gm-currency'), 'currency is NOT in the top meta row anymore');
  ok(box.querySelector('.gm-meta .gm-carry'), 'carry bar stays in the top meta (divider)');
  const gp = box.querySelector('input[data-coin="gp"]');
  ok(gp, 'editable gp coin input is present');
  ok(gp && gp.getAttribute('value') === '7', 'gp input carries the live value (7)');
  ok(box.querySelector('.gm-coin.gp .v') && box.querySelector('.gm-coin.gp .v').textContent === '7', 'read-only .v also shows 7 (shown in view mode)');
}

console.log('--- lock pill + indicators (list) ---');
{
  const { box } = render('list');
  ok(box.querySelector('[data-lock]'), 'a lock pill (data-lock) is emitted in controls');
  ok(box.querySelectorAll('.eq-pill.lock').length >= 3, 'every row gets a lock pill');
  const lockedRow = box.querySelector('.gm-row.locked');
  ok(lockedRow, 'a locked item row carries the .locked class');
  ok(lockedRow && lockedRow.querySelector('.gm-lockg'), 'locked row shows the lock glyph');
  const onPill = box.querySelector('.eq-pill.lock.on');
  ok(onPill, 'a locked row\'s pill is in the .on state');
}

console.log('--- lock indicators (grid) ---');
{
  const { box } = render('grid');
  const lockedTile = box.querySelector('.gm-tile.locked');
  ok(lockedTile, 'a locked item tile carries the .locked class');
  ok(lockedTile && lockedTile.querySelector('.gm-tlock'), 'locked tile shows the lock glyph');
}

console.log(`\nsmoke-gear-2a-render: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
