// smoke-attack-chip.mjs
// The blue config chip through the REAL renderActions/actionRowHTML (not an inlined copy):
// every weapon / weapon-cantrip attack row carries a .ac-cfg chip (data-act-cfg = action id)
// showing the current to-hit ability; the old .ac-bind chip is gone; the versatile 2H sits in
// the editor DOM (swap pile); spell-attack cantrips and damage-only rows get no chip.
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
await import('./sheet-mount.js');
const S = window.__sheet;
const d = window.document;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

ok(S && typeof S.renderActions === 'function', '__sheet.renderActions exposed');

function mkRoot(canEdit) {
  const root = d.createElement('div');
  root.innerHTML = '<div data-sec="actions" class="' + (canEdit ? 'can-edit' : '') + '"><div data-list="actions"></div></div>';
  return root;
}
const structural = {
  proficiencyBonus: 2, level: 5,
  abilities: { str: { mod: 1 }, dex: { mod: 3 }, con: { mod: 2 }, int: { mod: 2 }, wis: { mod: 0 }, cha: { mod: 0 } },
  proficiencies: { weapons: ['simple weapons', 'martial weapons'] },
  combat: { spellAttackBonus: 5 },
  spellcasting: { groups: [{ level: 0, heading: 'Cantrips', spells: [{ name: 'Booming Blade' }, { name: 'Fire Bolt' }] }] }
};
// Longsword pinned to DEX (Layer-1 item pin); versatile → also a hidden 2H
const inv = [{ name: 'Longsword', type: 'M', attackAbil: 'dex' }, { name: 'Dagger' }];

const root = mkRoot(true);
S.renderActions(root, structural, inv);
const html = root.querySelector('[data-list="actions"]').innerHTML;

ok(html.indexOf('data-act-cfg="wpn-longsword"') >= 0, 'longsword row has the config chip');
ok(html.indexOf('>DEX<span class="ac-cfg-car">') >= 0, 'chip shows the pinned DEX ability');
ok(html.indexOf('title="Switch modifier"') >= 0, 'weapon chip uses the modifier-only title');
ok(html.indexOf('data-act-bind') < 0, 'old data-act-bind chip is gone');
ok(html.indexOf('class="ac-bind"') < 0, 'no .ac-bind span remains');
ok(html.indexOf('wpn-longsword-2h') >= 0, 'versatile 2H present in editor DOM (swap pile)');
ok(html.indexOf('data-act-cfg="cant-boomingblade"') >= 0, 'weapon-cantrip row has the config chip');
ok(html.indexOf('Switch modifier or weapon') >= 0, 'cantrip chip title offers weapon + modifier');
ok(html.indexOf('Booming Blade') >= 0, 'cantrip label still shows');
ok(html.indexOf('data-act-cfg="sp-firebolt"') < 0, 'spell-attack cantrip (Fire Bolt) gets NO chip');
ok(html.indexOf('data-act-swap="wpn-longsword"') >= 0, 'swap button present on the longsword row');

// a viewer (no can-edit) still renders rows; the chip is CSS-gated off, but the DOM marker is harmless
const vroot = mkRoot(false);
S.renderActions(vroot, structural, inv);
ok(vroot.querySelector('[data-list="actions"]').innerHTML.indexOf('Longsword') >= 0, 'viewer still sees attack rows');

console.log('\nsmoke-attack-chip: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
