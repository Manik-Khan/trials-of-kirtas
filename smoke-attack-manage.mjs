// smoke-attack-manage.mjs
// Pass-2 list management through the REAL renderActions: every attack/bonus-damage row carries
// a delete tool; an "+ Add your own attack" button is present; a deleted action (actionOverrides
// .removed) leaves the live rows and appears in the Removed drawer with a Restore button; and a
// structural.customActions entry renders as a normal, chip-bearing attack row.
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
await import('./sheet-mount.js');
const S = window.__sheet;
const d = window.document;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

function mkRoot() {
  const root = d.createElement('div');
  root.innerHTML = '<div data-sec="actions" class="can-edit"><div class="actionlist editing" data-list="actions"></div></div>';
  return root;
}
const structural = {
  proficiencyBonus: 2, level: 5,
  abilities: { str: { mod: 1 }, dex: { mod: 3 }, con: { mod: 2 }, int: { mod: 2 }, wis: { mod: 0 }, cha: { mod: 0 } },
  proficiencies: { weapons: ['simple weapons', 'martial weapons'] },
  customActions: [{ id: 'custom-abc123', type: 'attack', label: 'Psychic Lash', ability: 'int', proficient: true, atkBonus: 0, dmgDice: '2d6', dmgBonus: 0, dmgType: 'Psychic' }],
  actionOverrides: { 'wpn-dagger': { removed: true } }   // Dagger deleted → drawer
};
const inv = [{ name: 'Longsword', type: 'M' }, { name: 'Dagger' }];

const root = mkRoot();
S.renderActions(root, structural, inv);
const host = root.querySelector('[data-list="actions"]');
const html = host.innerHTML;

// delete tool on rows
ok(html.indexOf('data-act-del="wpn-longsword"') >= 0, 'longsword row has a delete tool');
ok(html.indexOf('class="ac-tool ac-del"') >= 0, 'delete tool uses the ac-del class');
// add-your-own-attack button
ok(html.indexOf('data-act-add') >= 0 && html.indexOf('Add your own attack') >= 0, 'add-your-own-attack button present');
// custom action renders as a normal attack row, with the config chip
ok(html.indexOf('data-act="custom-abc123"') >= 0, 'custom action renders as a row');
ok(html.indexOf('Psychic Lash') >= 0, 'custom action label shows');
ok(html.indexOf('data-act-cfg="custom-abc123"') >= 0, 'custom action carries the config chip');
ok(html.indexOf('>INT<span class="ac-cfg-car">') >= 0, 'custom action chip shows its INT ability');
// deleted Dagger: gone from the live rows, present in the Removed drawer with Restore
ok(html.indexOf('data-act="wpn-dagger"') < 0, 'deleted Dagger is NOT in the live rows');
ok(html.indexOf('class="ac-removed"') >= 0, 'Removed drawer renders');
ok(html.indexOf('Removed \u00b7 1') >= 0, 'Removed drawer shows the count');
ok(html.indexOf('data-act-restore="wpn-dagger"') >= 0, 'drawer has a Restore button for the Dagger');
ok(/ac-rn">Dagger</.test(html), 'drawer names the removed Dagger');

// with NOTHING removed, the drawer is absent
const root2 = mkRoot();
S.renderActions(root2, Object.assign({}, structural, { actionOverrides: {} }), inv);
const html2 = root2.querySelector('[data-list="actions"]').innerHTML;
ok(html2.indexOf('class="ac-removed"') < 0, 'no Removed drawer when nothing is removed');
ok(html2.indexOf('data-act="wpn-dagger"') >= 0, 'Dagger back in the live rows when not removed');
// the custom action is a proper, rollable attack (real to-hit + damage in its meta)
const meta = S.actionMeta ? S.actionMeta({ type: 'attack', label: 'Psychic Lash', ability: 'int', proficient: true, dmgDice: '2d6', dmgType: 'Psychic' }, structural) : '';
ok(/to hit/.test(meta) && /2d6/.test(meta), 'custom attack yields a real to-hit + damage line');

console.log('\nsmoke-attack-manage: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
