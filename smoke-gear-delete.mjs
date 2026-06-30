// smoke-gear-delete.mjs
// The pure inventory mutations behind item delete + the Container toggle: single delete,
// bag delete (contents spill, never destroyed), bulk delete (selected children go, unselected
// spill), and un-containering (spill + clear the flag, item stays).
import { deleteItemFrom, deleteItemsFrom, spillContainer, topItemsOf, childrenRef } from '/mnt/user-data/outputs/sheet-actions.js';
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : (fail++, console.log('  FAIL:', n, d !== undefined ? JSON.stringify(d) : '')); };
const fresh = () => [
  { id: null, name: 'Longsword', containerId: undefined, isContainer: false },
  { id: 'bag1', name: 'Quiver', containerId: undefined, isContainer: true },
  { id: null, name: 'Arrows', containerId: 'bag1', isContainer: false },
  { id: null, name: 'Javelin', containerId: 'bag1', isContainer: false },
  { id: null, name: 'Potion', containerId: undefined, isContainer: false },
];
const byName = (inv, n) => inv.filter(x => x.name === n)[0];

console.log('--- single delete (plain item) ---');
{
  let inv = fresh(); const r = deleteItemFrom(inv, byName(inv, 'Longsword'));
  ok('ok flag set', r.ok === true);
  ok('Longsword gone', !byName(r.inv, 'Longsword'));
  ok('nothing spilled', r.spilled === 0);
  ok('count drops by one', r.inv.length === 4, r.inv.length);
}

console.log('--- delete a container → contents spill, not destroyed ---');
{
  let inv = fresh(); const r = deleteItemFrom(inv, byName(inv, 'Quiver'));
  ok('Quiver gone', !byName(r.inv, 'Quiver'));
  ok('Arrows survive', !!byName(r.inv, 'Arrows'));
  ok('Javelin survive', !!byName(r.inv, 'Javelin'));
  ok('spilled count = 2', r.spilled === 2, r.spilled);
  ok('Arrows now top-level', !byName(r.inv, 'Arrows').containerId);
  ok('contents appear in topItems', topItemsOf(r.inv).filter(x => x.name === 'Arrows' || x.name === 'Javelin').length === 2);
}

console.log('--- bulk delete: selected children go, unselected spill ---');
{
  let inv = fresh();
  // delete the Quiver + Arrows (a selected child); Javelin (unselected) should spill
  const r = deleteItemsFrom(inv, [byName(inv, 'Quiver'), byName(inv, 'Arrows')]);
  ok('Quiver gone', !byName(r.inv, 'Quiver'));
  ok('selected child Arrows gone', !byName(r.inv, 'Arrows'));
  ok('unselected child Javelin survives', !!byName(r.inv, 'Javelin'));
  ok('Javelin spilled to top', !byName(r.inv, 'Javelin').containerId);
  ok('only Javelin spilled (1)', r.spilled === 1, r.spilled);
  ok('two removed', r.inv.length === 3, r.inv.length);
}
{
  let inv = fresh();   // delete the whole bag AND both its children → nothing spills
  const r = deleteItemsFrom(inv, [byName(inv, 'Quiver'), byName(inv, 'Arrows'), byName(inv, 'Javelin')]);
  ok('all three removed', r.inv.length === 2 && !byName(r.inv, 'Quiver') && !byName(r.inv, 'Arrows'));
  ok('nothing spilled when contents also selected', r.spilled === 0, r.spilled);
}

console.log('--- un-container: spill contents, keep the item, clear the flag ---');
{
  let inv = fresh(); const bag = byName(inv, 'Quiver'); const r = spillContainer(inv, bag);
  ok('item stays in inventory', !!byName(r.inv, 'Quiver'));
  ok('no longer a container', byName(r.inv, 'Quiver').isContainer === false);
  ok('contents spilled (2)', r.spilled === 2, r.spilled);
  ok('Arrows pulled out of bag', !byName(r.inv, 'Arrows').containerId);
  ok('childrenRef now empty for the ex-bag', childrenRef(r.inv, byName(r.inv, 'Quiver')).length === 0);
}

console.log('--- guards ---');
ok('delete null → no-op', deleteItemFrom(fresh(), null).ok === false);
ok('bulk empty → no-op', deleteItemsFrom(fresh(), []).ok === false);

console.log('\nsmoke-gear-delete: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
