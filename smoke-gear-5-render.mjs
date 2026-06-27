// smoke-gear-5-render.mjs
// GearManager's currency-footer RENDER surface: the pure money model
// (worthStr / splitShare — copper-internal, electrum kept), the loot-split
// breakdown (splitOutHtml: each share + leftover + name chips + Take button),
// the coin row with steppers + hover legend (currencyHtml), and render()'s
// footer (worth readout + Split toggle + the split panel).
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const GM_SRC = readFileSync(new URL('./gear-manager.js', import.meta.url), 'utf8');
const dom = new JSDOM('<!doctype html><body><div id="host" class="tok-sheet"><div data-sec="inventory" class="can-edit"><div id="box"></div></div></body>', { runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window, d = w.document;
const s = d.createElement('script'); s.textContent = GM_SRC; d.body.appendChild(s);
const GM = w.GearManager;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };
const has = (h, sub, m) => ok(h.indexOf(sub) >= 0, m);
const hasnt = (h, sub, m) => ok(h.indexOf(sub) < 0, m);

console.log('--- worth (copper-internal, gp-equivalent) ---');
ok(typeof GM.worthStr === 'function', 'worthStr exposed on the API');
ok(GM.worthStr({ pp: 1 }) === '10', '1 pp is worth 10 gp');
ok(GM.worthStr({ pp: 2, gp: 34, ep: 1, sp: 47, cp: 112 }) === '60.32', 'mixed pile worth = 60.32 gp');
ok(GM.worthStr({}) === '0', 'empty pile worth 0');

console.log('--- splitShare DEFAULT = split each denomination as-is (no minting) ---');
{
  const r = GM.splitShare({ pp: 0, gp: 300, ep: 0, sp: 200, cp: 205 }, 4);   // the user's case
  ok(r.convert === false, 'default mode is non-converting');
  ok(r.share.pp === 0 && r.share.ep === 0, 'no platinum or electrum minted from a gp/sp/cp pile');
  ok(r.share.gp === 75 && r.share.sp === 50 && r.share.cp === 51, 'each coin type divided on its own → 75gp 50sp 51cp');
  ok(r.remCoins.cp === 1 && r.rem === 1, 'leftover is 1 cp (kept in its own denomination)');
}
{
  const r = GM.splitShare({ pp: 25, gp: 50, ep: 0, sp: 100, cp: 300 }, 4);
  ok(r.share.pp === 6 && r.share.gp === 12 && r.share.sp === 25 && r.share.cp === 75, 'mixed pile divides per type (6pp 12gp 25sp 75cp)');
  ok(r.remCoins.pp === 1 && r.remCoins.gp === 2, 'leftover keeps its denominations (1pp 2gp)');
}
console.log('--- splitShare CONVERT = money-changer (consolidate, may mint coins) ---');
{
  const r = GM.splitShare({ pp: 25, gp: 50, ep: 0, sp: 100, cp: 300 }, 4, true);
  ok(r.convert === true, 'convert mode flagged');
  ok(r.per === 7825 && r.rem === 0, 'each = 7,825 cp, no remainder');
  ok(r.share.pp === 7 && r.share.gp === 8 && r.share.ep === 0 && r.share.sp === 2 && r.share.cp === 5, 'consolidates to 7pp 8gp 2sp 5cp');
}
{
  const r = GM.splitShare({ cp: 60 }, 1, true);
  ok(r.share.ep === 1 && r.share.sp === 1, 'bank mode keeps electrum (60 cp → 1 ep + 1 sp)');
}

console.log('--- splitOutHtml: breakdown, leftover, names, Take button ---');
{
  const h = GM.splitOutHtml({ gp: 40, sp: 80, cp: 200 }, 4, ['Cosmere', 'Caim', 'Líadan', 'Vesperian']);   // each type divides evenly
  has(h, 'each share', 'shows the each-share header');
  has(h, 'splits evenly', 'an evenly-divisible pile shows the no-remainder note');
  hasnt(h, 'leftover', 'no leftover line when each type divides clean');
  has(h, 'Cosmere', 'party names rendered as chips');
  has(h, 'Vesperian', 'all party names present');
  has(h, 'data-takemine', 'the Take my share button is present');
  ok((h.match(/gm-sp-chip/g) || []).length === 4, 'one chip per way');
}
{
  const h = GM.splitOutHtml({ gp: 300, sp: 200, cp: 205 }, 3, null);   // 200sp & 205cp don't divide by 3
  has(h, 'leftover', 'an uneven split shows the leftover line');
  has(h, 'Share 1', 'falls back to "Share N" when no names given');
}

console.log('--- coin row (via render): steppers + legend per coin ---');
{
  const box = render({});
  ok(box.querySelectorAll('.gm-cs[data-cstep="1"]').length === 5, 'a + stepper on every coin');
  ok(box.querySelectorAll('.gm-cs[data-cstep="-1"]').length === 5, 'a − stepper on every coin');
  ok(box.querySelectorAll('input[data-coin]').length === 5, 'an editable input on every coin');
  ok(box.querySelectorAll('.gm-coin-leg').length === 5, 'each coin carries a legend element');
  const ppLeg = box.querySelector('.gm-coin.pp .gm-coin-leg');
  ok(ppLeg && ppLeg.textContent.indexOf('1 pp = 10 gp = 1000 cp') >= 0, 'pp legend text');
  const epLeg = box.querySelector('.gm-coin.ep .gm-coin-leg');
  ok(epLeg && epLeg.textContent.indexOf('1 ep = 5 sp = 50 cp') >= 0, 'ep legend (electrum kept)');
}

console.log('--- render(): the footer (worth + split toggle + panel) ---');
function render(stPatch) {
  const box = d.getElementById('box');
  box.__gmState = Object.assign({ view: 'list', open: Object.create(null) }, stPatch);
  GM.render(box, { inventory: [{ id: 'a', name: 'Torch', weight: 1 }], currency: { pp: 2, gp: 34, ep: 1, sp: 47, cp: 112 }, ES: null, strScore: 10 });
  return box;
}
{
  const box = render({});
  ok(box.querySelector('[data-worth]'), 'worth readout present');
  ok(box.querySelector('[data-worth]').textContent === '60.32', 'worth shows the live pile value');
  ok(box.querySelector('[data-splittoggle]'), 'Split loot button present');
  ok(box.querySelector('[data-splitpanel]'), 'split panel present in the DOM');
  ok(!box.querySelector('[data-splitpanel]').classList.contains('open'), 'panel is closed by default');
  ok(box.querySelectorAll('[data-loot]').length === 5, 'five loot inputs');
  ok(box.querySelector('[data-waysn]').textContent === '4', 'defaults to 4 ways');
  ok(box.querySelector('[data-convert]'), 'the convert (money-changer) toggle is present in the panel');
  ok(box.querySelector('[data-splitout]'), 'the split-out container exists');
}
{
  const box = render({ split: { open: true, loot: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }, ways: 4 } });
  ok(box.querySelector('[data-splitpanel]').classList.contains('open'), 'panel renders open when st.split.open');
}

console.log(`\nsmoke-gear-5-render: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
