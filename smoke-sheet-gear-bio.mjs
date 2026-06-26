// smoke-sheet-gear-bio.mjs — verifies the sheet renders REAL per-character
// equipment, coin, attunement, and story/traits (no more hardcoded sample data),
// with honest empty states. Imports sheet-mount.js as a module under jsdom.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

await import('./sheet-mount.js');
const { renderEquipment, renderStory } = dom.window.__sheet;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.error('FAIL:', n); } };

function mkRoot() {
  const d = dom.window.document.createElement('div');
  d.innerHTML =
    '<span class="attune" data-attune></span>' +
    '<span class="attune-wrap" data-equip-attune></span>' +
    '<div class="eq-grid" data-equip-slots></div>' +
    '<div class="panelbox" data-equip></div>' +
    '<p data-f="storyQuote"></p>' +
    '<div data-f="bioPersonality"></div><div data-f="bioIdeals"></div>' +
    '<div data-f="bioBonds"></div><div data-f="bioFlaws"></div>';
  return d;
}

// equipment: populated
{
  const root = mkRoot();
  renderEquipment(root, [
    { name: 'Rapier', detail: '1d8 finesse' },
    { name: 'Ring of Protection', reqAttune: true, attuned: true },
    { name: 'Cloak of Elvenkind', attuned: true },
    { name: 'Potion of Healing', qty: 3 }
  ], { gp: 24, sp: 5 });
  ok('one gitem per inventory item', root.querySelectorAll('[data-equip] .gitem').length === 4);
  ok('first item name bound', root.querySelector('[data-equip] .g-n').textContent === 'Rapier');
  ok('quantity shown', /\u00D73/.test(root.querySelector('[data-equip]').textContent));
  const coin = root.querySelector('[data-equip] .coinline').textContent;
  ok('coin shows gp + sp', /24/.test(coin) && /sp/.test(coin));
  ok('2 attuned -> 2 filled pips (equipment)', root.querySelectorAll('[data-equip-attune] .pip.on').length === 2);
  ok('left Status attunement mirrors 2 pips', root.querySelectorAll('[data-attune] .pip.on').length === 2);
  ok('attunement has 3 total pips', root.querySelectorAll('[data-attune] .pip').length === 3);
}
// equipment: empty (forged character)
{
  const root = mkRoot();
  renderEquipment(root, [], {});
  ok('empty inventory -> empty state', /No equipment yet/.test(root.querySelector('[data-equip]').textContent));
  ok('empty currency -> 0 gp', /0\s*gp/i.test(root.querySelector('[data-equip] .coinline').textContent.replace(/\s+/g, ' ')));
  ok('no attuned -> 0 filled pips', root.querySelectorAll('[data-equip] .pip.on').length === 0);
}
// attunement caps at 3
{
  const root = mkRoot();
  renderEquipment(root, [{ name: 'a', attuned: true }, { name: 'b', attuned: true }, { name: 'c', attuned: true }, { name: 'd', attuned: true }], {});
  ok('4 attuned items -> still only 3 filled pips', root.querySelectorAll('[data-attune] .pip.on').length === 3);
}
// story: populated
{
  const root = mkRoot();
  renderStory(root, { backstory: 'Born under a falling star.', personality: 'Bold', ideals: 'Freedom', bonds: 'My city', flaws: 'Reckless' });
  ok('story quote bound', root.querySelector('[data-f="storyQuote"]').textContent === 'Born under a falling star.');
  ok('personality bound', root.querySelector('[data-f="bioPersonality"]').textContent === 'Bold');
  ok('ideals bound', root.querySelector('[data-f="bioIdeals"]').textContent === 'Freedom');
  ok('flaws bound', root.querySelector('[data-f="bioFlaws"]').textContent === 'Reckless');
}
// story: empty -> blank quote + dashes
{
  const root = mkRoot();
  renderStory(root, {});
  ok('empty story quote blank (no sample prose)', root.querySelector('[data-f="storyQuote"]').textContent === '');
  ok('empty personality -> em-dash', root.querySelector('[data-f="bioPersonality"]').textContent === '\u2014');
  ok('empty bonds -> em-dash', root.querySelector('[data-f="bioBonds"]').textContent === '\u2014');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
