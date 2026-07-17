// smoke-orbs-custom.mjs
// Drives the custom-resource form in the orb config (combat-orbs.js + resource-derive.js)
// in jsdom: the "Custom resources" section renders with the seeded entry, the add form
// reveals, creating a PB-formula resource persists it to structural.customResources +
// the orb loadout + the saved structural, the derive resolves it against the sheet
// (PB → 3), and deleting removes it. No browser, stubbed characterData.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const tick = () => new Promise(r => setTimeout(r, 0));
const settle = async (n = 6) => { for (let i = 0; i < n; i++) await tick(); };
let pass = 0, fail = 0;
const ok = (c, l) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + l); } };

const dom = new JSDOM('<!doctype html><body>'
  + '<div class="token selected" data-id="t1"><div class="token-disc"></div><span class="token-name">Vesperian</span></div>'
  + '<div id="menu"></div></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom; global.window = window; global.document = window.document;
const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

const calls = { save: [] };
const CHAR = {
  ves: {
    key: 'ves',
    structural: {
      race: 'Shadar-Kai', level: 5, proficiencyBonus: 3, abilities: { cha: { mod: 4 } },
      classes: [{ name: 'Warlock', level: 5, subclass: 'The Fiend' }],
      customResources: [{ id: 'cr_seed', label: 'Seed Resource', max: { type: 'fixed', value: 2 }, recharge: 'short' }]
    },
    vitals: { pipState: {} }
  }
};
const host = {
  staff: () => true, canEdit: () => true, openSheet: () => {}, hpSave: () => Promise.resolve(),
  characterData: {
    loadCharacter: (k) => Promise.resolve(CHAR[k] ? JSON.parse(JSON.stringify(CHAR[k])) : null),
    save: (k, patch) => { calls.save.push({ k, patch: JSON.parse(JSON.stringify(patch)) }); return Promise.resolve(); }
  },
  tokenEl: (id) => window.document.querySelector('.token[data-id="' + id + '"]')
};

window.eval(readFileSync(new URL('../../resource-derive.js', import.meta.url), 'utf8'));
window.eval(readFileSync(new URL('../../combat-orbs.js', import.meta.url), 'utf8'));
const CO = window.CombatOrbs;
ok(!!window.ResourceDerive, 'resource-derive loaded into window');

const c = { id: 't1', name: 'Vesperian', source_key: 'ves', side: 'party', hp: 30, max_hp: 38, ac: 13 };
CO.show(c, host.tokenEl('t1'), host); await settle();           // load char into cache

const menu = window.document.getElementById('menu');
menu.innerHTML = CO.configHtml(c, host); CO.wireConfig(menu, c, host); await settle();

// ── 1. section + seeded row render ──
ok(menu.textContent.indexOf('Custom resources') !== -1, 'config shows the Custom resources section');
ok(!!menu.querySelector('[data-cres-toggle]'), 'has a "+ New resource" toggle');
ok(menu.textContent.indexOf('Seed Resource') !== -1, 'seeded custom resource row rendered');
ok(menu.textContent.indexOf('short rest') !== -1, 'row shows resolved recharge label');
ok(!!menu.querySelector('[data-cdel="cr_seed"]'), 'seeded custom has a delete control');

// ── 2. reveal form, fill, create a PB-formula resource ──
click(menu.querySelector('[data-cres-toggle]'));
ok(!menu.querySelector('.torb-cres-form').hidden, 'form reveals on toggle');
menu.querySelector('[data-cres-name]').value = 'Blessing of the Raven Queen';
menu.querySelector('[data-cres-mtype]').value = 'pb';
menu.querySelector('[data-cres-recharge]').value = 'long';
const before = calls.save.length;
click(menu.querySelector('[data-cres-create]')); await settle();

ok(calls.save.length > before, 'create persists via characterData.save');
const saved = calls.save[calls.save.length - 1].patch.structural;
const blessing = (saved.customResources || []).find((x) => x.label === 'Blessing of the Raven Queen');
ok(!!blessing, 'saved structural carries the new custom resource');
ok(blessing && blessing.max && blessing.max.type === 'pb', 'stored with the PB formula token (auto-updates)');
ok(saved.orbConfig.indexOf(blessing.id) !== -1, 'new resource was added to the orb loadout');
const drv = window.ResourceDerive.derive(saved).find((r) => r.label === 'Blessing of the Raven Queen');
ok(drv && drv.max === 3, 'derive resolves the custom resource to PB = 3');
ok(window.document.getElementById('menu').textContent.indexOf('Blessing of the Raven Queen') !== -1, 'config re-renders with the new resource listed');

// ── 3. delete the seeded resource ──
const before2 = calls.save.length;
click(window.document.querySelector('[data-cdel="cr_seed"]')); await settle();
const afterDel = calls.save[calls.save.length - 1].patch.structural.customResources;
ok(calls.save.length > before2 && !afterDel.some((x) => x.id === 'cr_seed'), 'delete removes the resource + persists');

console.log((fail ? '\u2717' : '\u2713') + ' orbs-custom: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
