// smoke-sheet-resources.mjs
// Proves the sheet's Resources section: ResourceDerive feeds buildResources (max
// from class/level/abilities/race, current = max − pipState), renderResources
// paints the pools and hides the section when a character has none, and a full
// mountSheet renders the section live. resource-derive.js is loaded into the
// window before the sheet module runs (dynamic import after setup).
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const tick = () => new Promise(r => setTimeout(r, 0));
const settle = async (n = 6) => { for (let i = 0; i < n; i++) await tick(); };
const clone = (o) => JSON.parse(JSON.stringify(o));
let pass = 0, fail = 0;
const ok = (c, l) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + l); } };

const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
window.eval(readFileSync(new URL('./resource-derive.js', import.meta.url), 'utf8'));   // → window.ResourceDerive
ok(!!window.ResourceDerive, 'resource-derive loaded into window');

const { mountSheet } = await import('./sheet-mount.js');   // after window + ResourceDerive ready
const S = window.__sheet;
ok(S && typeof S.buildResources === 'function', '__sheet.buildResources exposed');

// ── buildResources: derive + pipState subtraction ──
const caim = { classes: [{ name: 'Monk', level: 6, subclass: 'Open Hand' }], level: 6, abilities: { cha: { mod: 0 } } };
let pools = S.buildResources(caim, { pipState: { ki: 2 } });
ok(pools.length === 1 && pools[0].label === 'Ki Points', 'Monk → one Ki pool');
ok(pools[0].max === 6 && pools[0].current === 4, 'Ki max 6, current 4 after 2 spent');
ok(/4 of 6/.test(pools[0].recharge) && /short rest/.test(pools[0].recharge), 'Ki recharge line reads "4 of 6 · short rest"');

const liadan = { classes: [{ name: 'Bard', level: 10, subclass: 'Lore' }], level: 10, abilities: { cha: { mod: 4 } } };
pools = S.buildResources(liadan, { pipState: {} });
ok(pools[0].label === 'Bardic Inspiration' && pools[0].max === 4 && pools[0].badge === 'd10', 'Bard 10 / CHA+4 → Bardic d10 ×4');

const astral = { classes: [{ name: 'Warlock', level: 3, subclass: 'Fiend' }], level: 3, race: 'Astral Elf', proficiencyBonus: 2, abilities: { cha: { mod: 3 } } };
pools = S.buildResources(astral, { pipState: { starlightStep: 1 } });
ok(pools.length === 1 && pools[0].label === 'Starlight Step' && pools[0].max === 2 && pools[0].current === 1, 'Astral Elf → Starlight Step PB=2, 1 left');

const champ = { classes: [{ name: 'Fighter', level: 8, subclass: 'Champion' }], level: 8, abilities: { cha: { mod: 1 } } };
ok(S.buildResources(champ, {}).length === 0, 'Champion fighter → no derived resources');

// ── renderResources: paint + show/hide ──
const host = document.getElementById('host');
host.innerHTML = '<div class="block" data-sec="resources"><div class="spellhead" data-list="resources"></div></div>';
S.renderResources(host, S.buildResources(caim, { pipState: { ki: 2 } }));
const listEl = host.querySelector('[data-list="resources"]');
const secEl = host.querySelector('[data-sec="resources"]');
ok(listEl.querySelectorAll('.pool').length === 1, 'renderResources paints one pool');
ok(listEl.querySelectorAll('.slot').length === 6 && listEl.querySelectorAll('.slot.on').length === 4, 'pool shows 6 slots, 4 filled');
ok(secEl.style.display === '', 'section visible when resources exist');
S.renderResources(host, []);
ok(secEl.style.display === 'none', 'section hidden when no resources');

// ── full mountSheet: the section renders live ──
const ROW = {
  key: 'caim',
  structural: {
    name: 'Caim', classes: [{ name: 'Monk', level: 6, subclass: 'Open Hand' }], race: 'Human', level: 6,
    proficiencyBonus: 3,
    abilities: { str:{score:14,mod:2}, dex:{score:16,mod:3}, con:{score:14,mod:2}, int:{score:10,mod:0}, wis:{score:16,mod:3}, cha:{score:10,mod:0} },
    saves: {}, skills: [], combat: { ac:18, hp:29, hpMax:32, initiative:3, speed:40 }, classFeatures: {}, spells: {}, features: []
  },
  vitals: { hp:29, conditions:[], pipState: { ki: 1 } },
  notes: ''
};
const cd = clone(ROW);
const mockCD = { loadCharacter: () => Promise.resolve(clone(ROW)), canEdit: () => true, save: () => Promise.resolve() };
const container = document.createElement('div'); document.body.appendChild(container);
mountSheet(container, 'caim', { characterData: mockCD });
await settle();
const liveSec = container.querySelector('[data-sec="resources"]');
ok(!!liveSec && liveSec.style.display !== 'none', 'mounted sheet shows the Resources section for a Monk');
const kiPool = container.querySelector('[data-list="resources"] .pool');
ok(!!kiPool && /Ki Points/.test(kiPool.textContent), 'mounted Resources section contains the Ki pool');
ok(kiPool && kiPool.querySelectorAll('.slot.on').length === 5, 'mounted Ki pool shows 5 of 6 (1 spent)');

console.log((fail ? '\u2717' : '\u2713') + ' sheet-resources: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
