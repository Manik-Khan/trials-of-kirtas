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

console.log('--- splitShare: even, remainder, electrum kept ---');
{
  const r = GM.splitShare({ pp: 25, gp: 50, ep: 0, sp: 100, cp: 300 }, 4);   // the canonical example
  ok(r.total === 31300, 'pile = 31,300 cp');
  ok(r.per === 7825 && r.rem === 0, 'each = 7,825 cp, no remainder');
  ok(r.share.pp === 7 && r.share.gp === 8 && r.share.ep === 0 && r.share.sp === 2 && r.share.cp === 5, 'share = 7pp 8gp 2sp 5cp');
}
{
  const r = GM.splitShare({ pp: 25, gp: 50, ep: 0, sp: 100, cp: 300 }, 3);
  ok(r.rem === 1, '3-way split leaves 1 cp');
  ok(r.remCoins.cp === 1, 'remainder expressed as 1 cp');
}
{
  const r = GM.splitShare({ cp: 60 }, 1);   // 60 cp → ep used because it reduces coin count
  ok(r.share.ep === 1 && r.share.sp === 1 && r.share.cp === 0, '60 cp consolidates to 1 ep + 1 sp (electrum kept)');
}
ok(GM.splitShare({ cp: 10 }, 4).per === 2 && GM.splitShare({ cp: 10 }, 4).rem === 2, 'tiny pile: 10cp/4 = 2cp each, 2cp left');

console.log('--- splitOutHtml: breakdown, leftover, names, Take button ---');
{
  const h = GM.splitOutHtml({ pp: 25, gp: 50, ep: 0, sp: 100, cp: 300 }, 4, ['Cosmere', 'Caim', 'Líadan', 'Vesperian']);
  has(h, 'each share', 'shows the each-share header');
  has(h, 'splits evenly', 'even split shows the no-remainder note');
  hasnt(h, 'leftover', 'no leftover line on an even split');
  has(h, 'Cosmere', 'party names rendered as chips');
  has(h, 'Vesperian', 'all party names present');
  has(h, 'data-takemine', 'the Take my share button is present');
  ok((h.match(/gm-sp-chip/g) || []).length === 4, 'one chip per way');
}
{
  const h = GM.splitOutHtml({ pp: 25, gp: 50, ep: 0, sp: 100, cp: 300 }, 3, null);
  has(h, 'leftover', 'remainder split shows the leftover line');
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
  ok(box.querySelector('[data-splitout]'), 'the split-out container exists');
}
{
  const box = render({ split: { open: true, loot: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }, ways: 4 } });
  ok(box.querySelector('[data-splitpanel]').classList.contains('open'), 'panel renders open when st.split.open');
}

console.log(`\nsmoke-gear-5-render: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
