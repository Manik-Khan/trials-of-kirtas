// smoke-gear-2c-render.mjs — the drag affordances render: a data-grip handle on
// every list row and grid tile, and a "file here" hint on bag rows.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
const GM_SRC = readFileSync(new URL('./gear-manager.js', import.meta.url), 'utf8');
const II_SRC = readFileSync(new URL('./item-icons.js', import.meta.url), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };

function render(view) {
  const dom = new JSDOM('<!doctype html><body><div class="tok-sheet"><div data-sec="inventory" class="can-edit"><div id="box"></div></div></body>', { runScripts: 'dangerously', pretendToBeVisual: true });
  const d = dom.window.document;
  d.body.appendChild(Object.assign(d.createElement('script'), { textContent: II_SRC }));
  d.body.appendChild(Object.assign(d.createElement('script'), { textContent: GM_SRC }));
  const box = d.getElementById('box');
  const inv = [
    { id: 'sword', name: 'Sword' },
    { id: 'bag1', name: 'Backpack', isContainer: true },
    { id: 'ration', name: 'Rations', containerId: 'bag1' }
  ];
  box.__gmState = { view, open: Object.create(null), editing: null, picker: false, pickerCat: null, draft: null };
  dom.window.GearManager.render(box, { inventory: inv, currency: {}, ES: null, strScore: 15 });
  return box;
}

console.log('--- list view ---');
{
  const box = render('list');
  ok(box.querySelector('.gm-row[data-row="id:sword"] .gm-grip[data-grip="id:sword"]'), 'list row has a keyed drag grip');
  ok(box.querySelector('.gm-row[data-row="id:bag1"] .bagdrop-hint'), 'bag row carries a "file here" hint');
  ok(!box.querySelector('.gm-row[data-row="id:sword"] .bagdrop-hint'), 'non-bag row has no file hint');
}

console.log('--- grid view ---');
{
  const box = render('grid');
  ok(box.querySelector('.gm-tile[data-tile="id:sword"] .gm-tgrip[data-grip="id:sword"]'), 'grid tile has a keyed drag grip');
  ok(box.querySelectorAll('.gm-tile .gm-tgrip').length >= 2, 'every tile has a grip');
}

console.log(`\nsmoke-gear-2c-render: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
