// smoke-gear-drag-mutations.mjs
// The drag rebuild logic is pure and dup-safe. jsdom can't lay out the page, so
// we drive the MUTATIONS directly (fileInto / moveToTop / rebuildItems) — which
// is exactly where the "3 rations / 2 ropes" duplication came from — and assert
// every item id stays unique and the total count never drifts.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const html = readFileSync(new URL('./mock-gear-writes.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window, d = w.document;

// DATA / byId / childrenOf are `const` (not window props); expose thin readers + a driver.
const expose = d.createElement('script');
expose.textContent =
  "window.__snap=function(){return DATA.items.map(function(i){return {id:i.id,c:i.containerId||null};});};" +
  "window.__kids=function(b){return childrenOf(b).map(function(i){return i.id;});};" +
  "window.__in=function(a,b){return fileInto(a,b);};" +
  "window.__top=function(a,b){return moveToTop(a,b);};";
d.body.appendChild(expose);

const snap = () => w.__snap();
const kids = b => w.__kids(b);
const countOf = id => snap().filter(x => x.id === id).length;
const contOf = id => (snap().find(x => x.id === id) || {}).c;
const total = () => snap().length;
const unique = () => { const ids = snap().map(x => x.id); return ids.length === new Set(ids).size; };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };

const START = total();
ok(START > 0, 'inventory loaded (' + START + ' items)');
ok(contOf('rations') === 'backpack' && contOf('rope') === 'backpack', 'rations + rope start in the backpack');
ok(JSON.stringify(kids('backpack')) === JSON.stringify(['rations', 'rope']), 'backpack children = [rations, rope]');

console.log('--- pull rations OUT (the duplication repro) ---');
w.__top('rations', null);
ok(countOf('rations') === 1, 'rations appears exactly once (no duplicate)');
ok(contOf('rations') === null, 'rations is now top-level (containerId cleared)');
ok(!kids('backpack').includes('rations'), 'backpack no longer lists rations');
ok(total() === START, 'item count unchanged');
ok(unique(), 'all ids unique');

console.log('--- pull rope OUT too ---');
w.__top('rope', null);
ok(countOf('rope') === 1, 'rope appears exactly once');
ok(kids('backpack').length === 0, 'backpack is now empty');
ok(total() === START && unique(), 'count held, ids still unique');

console.log('--- file potionheal INTO the backpack ---');
w.__in('potionheal', 'backpack');
ok(countOf('potionheal') === 1, 'potionheal appears exactly once');
ok(contOf('potionheal') === 'backpack', 'potionheal containerId = backpack');
ok(kids('backpack').includes('potionheal'), 'backpack now contains potionheal');
ok(total() === START && unique(), 'count held, ids unique');

console.log('--- guard: filing into a non-bag is a no-op ---');
const before = JSON.stringify(snap());
ok(w.__in('torch', 'potion') === false, 'fileInto returns false for a non-container target');
ok(JSON.stringify(snap()) === before, 'inventory unchanged after rejected file-in');

console.log('--- reorder a top item ---');
const firstTopBefore = snap().filter(x => !x.c)[0].id;
w.__top('torch', firstTopBefore);
ok(countOf('torch') === 1, 'torch still unique after reorder');
ok(snap().filter(x => !x.c)[0].id === 'torch', 'torch moved to the front of the top order');
ok(total() === START && unique(), 'final: count held, every id unique');

console.log(`\nsmoke-gear-drag-mutations: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
