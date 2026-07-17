// smoke-gear-2c-mutations.mjs
// The real, exported inventory drag mutations (the dup-safety-critical core of 2c).
// Positional pointer drag is click-tested live (jsdom has no layout); here we prove
// reorder / file-into-bag / pull-out-of-bag and that no item can ever duplicate.
import { topItemsOf, childrenRef, rebuildFromTop, fileItemInto, moveItemToTop } from '../../sheet-actions.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };

// fresh inventory each test (mutations write containerId/slot on the items)
const fresh = () => ([
  { id: 'sword', name: 'Sword' },
  { id: 'bag1', name: 'Backpack', isContainer: true },
  { id: 'ration', name: 'Rations', containerId: 'bag1' },
  { id: 'rope', name: 'Rope', containerId: 'bag1' },
  { id: 'potion', name: 'Potion' },
  { id: 'bag2', name: 'Pouch', isContainer: true },
  { id: 'torch', name: 'Torch' }
]);
const ids = inv => inv.map(i => i.id);
const noDup = inv => new Set(inv.map(i => i.id)).size === inv.length;
const byId = (inv, id) => inv.find(i => i.id === id);

console.log('--- file a top item into a bag ---');
{
  let inv = fresh();
  const r = fileItemInto(inv, byId(inv, 'potion'), byId(inv, 'bag1'));
  inv = r.inv;
  ok(r.ok, 'fileItemInto returns ok');
  ok(inv.length === 7 && noDup(inv), 'no item lost or duplicated');
  ok(byId(inv, 'potion').containerId === 'bag1', 'potion now belongs to bag1');
  ok(byId(inv, 'potion').slot === undefined, 'filing clears any equipped slot');
  // potion lands inside bag1, right after the existing children
  const order = ids(inv);
  ok(order.indexOf('potion') === order.indexOf('rope') + 1, 'filed item lands after the bag\'s last child');
  ok(childrenRef(inv, byId(inv, 'bag1')).map(c => c.id).join(',') === 'ration,rope,potion', 'bag1 children grouped in order');
}

console.log('--- guards: bad file targets are refused ---');
{
  let inv = fresh();
  ok(!fileItemInto(inv, byId(inv, 'bag1'), byId(inv, 'bag2')).ok, 'a bag cannot be filed into a bag');
  ok(!fileItemInto(inv, byId(inv, 'potion'), byId(inv, 'sword')).ok, 'cannot file into a non-container');
  ok(!fileItemInto(inv, byId(inv, 'bag1'), byId(inv, 'bag1')).ok, 'cannot file into itself');
}

console.log('--- reorder a top item ---');
{
  let inv = fresh();
  const r = moveItemToTop(inv, byId(inv, 'torch'), byId(inv, 'sword'));   // move torch before sword
  inv = r.inv;
  ok(r.ok && inv.length === 7 && noDup(inv), 'reorder keeps every item exactly once');
  const top = topItemsOf(inv).map(i => i.id);
  ok(top.indexOf('torch') === top.indexOf('sword') - 1, 'torch now sits just before sword');
  ok(childrenRef(inv, byId(inv, 'bag1')).map(c => c.id).join(',') === 'ration,rope', 'bag children stay grouped through a reorder');
}

console.log('--- pull a child out of a bag ---');
{
  let inv = fresh();
  const r = moveItemToTop(inv, byId(inv, 'ration'), byId(inv, 'potion'));  // pull ration out, before potion
  inv = r.inv;
  ok(r.ok && inv.length === 7 && noDup(inv), 'pull-out keeps every item exactly once');
  ok(byId(inv, 'ration').containerId === undefined, 'ration is no longer in a bag');
  ok(childrenRef(inv, byId(inv, 'bag1')).map(c => c.id).join(',') === 'rope', 'bag1 now holds only rope');
  const top = topItemsOf(inv).map(i => i.id);
  ok(top.indexOf('ration') === top.indexOf('potion') - 1, 'ration lands at top just before potion');
}

console.log('--- move to end (null before) ---');
{
  let inv = fresh();
  const r = moveItemToTop(inv, byId(inv, 'sword'), null);
  inv = r.inv;
  const top = topItemsOf(inv).map(i => i.id);
  ok(r.ok && top[top.length - 1] === 'sword', 'null beforeItem appends to the end of the top order');
}

console.log('--- rebuildFromTop is dup-proof under a malformed order ---');
{
  let inv = fresh();
  // duplicate a ref + omit several; rebuild must still emit each item exactly once
  const out = rebuildFromTop(inv, [byId(inv, 'bag1'), byId(inv, 'bag1'), byId(inv, 'sword')]);
  ok(out.length === 7 && noDup(out), 'malformed top order still yields every item exactly once');
  ok(childrenRef(out, byId(out, 'bag1')).length === 2, 'bag children appear once, under their bag');
}

console.log(`\nsmoke-gear-2c-mutations: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
