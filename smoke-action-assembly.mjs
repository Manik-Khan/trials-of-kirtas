// smoke-action-assembly.mjs
// The assembleActions contract that the attack-row UI rests on: a versatile weapon's two-handed
// mode ships hidden; structural.customActions join the list; actionOverrides[id].removed is a
// suppressed tier (gone from normal AND includeHidden, surfaced only by includeRemoved); and the
// add → edit → delete → restore lifecycle round-trips with the action's data intact.
import { assembleActions } from './weapon-actions.js';
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : (fail++, console.log('  FAIL:', n, d !== undefined ? JSON.stringify(d) : '')); };
const base = (extra) => Object.assign({
  proficiencyBonus: 2, level: 5,
  abilities: { str: { mod: 1 }, dex: { mod: 3 }, con: { mod: 2 }, int: { mod: 2 }, wis: { mod: 0 }, cha: { mod: 0 } },
  proficiencies: { weapons: ['simple weapons', 'martial weapons'] }
}, extra || {});
const ids = (l) => l.map(a => (a.id || a.label) + (a._hidden ? '(H)' : '') + (a._removed ? '(R)' : ''));
const inv = [{ name: 'Longsword', type: 'M' }];   // versatile → 1H + hidden 2H

// versatile
let n = assembleActions(inv, base());
ok('versatile: 1H shown', n.some(a => a.id === 'wpn-longsword'), ids(n));
ok('versatile: 2H NOT in normal', !n.some(a => a.id === 'wpn-longsword-2h'));
let h = assembleActions(inv, base(), { includeHidden: true });
ok('versatile: 2H present+_hidden under includeHidden', h.some(a => a.id === 'wpn-longsword-2h' && a._hidden && a.defaultHidden), ids(h));

// ── custom-action lifecycle: add → edit → delete → restore ──
// add (what addCustomAction writes)
let s = base({ customActions: [{ id: 'custom-x', type: 'attack', label: 'New attack', ability: 'str', proficient: true, atkBonus: 0, dmgDice: '1d6', dmgBonus: 0, dmgType: '' }] });
ok('add: custom action joins the list', assembleActions(inv, s).some(a => a.id === 'custom-x' && a.label === 'New attack'));

// edit (what saveCustomAction writes — in place)
s.customActions[0] = { id: 'custom-x', type: 'attack', label: 'Psychic Lash', ability: 'int', proficient: true, atkBonus: 1, dmgDice: '2d6', dmgBonus: 0, dmgType: 'Psychic' };
let edited = assembleActions(inv, s).find(a => a.id === 'custom-x');
ok('edit: label/ability/dice/atkBonus all update in place', edited && edited.label === 'Psychic Lash' && edited.ability === 'int' && edited.dmgDice === '2d6' && edited.atkBonus === 1, edited);

// delete (what doDeleteAction writes)
s.actionOverrides = { 'custom-x': { removed: true } };
ok('delete: gone from normal', !assembleActions(inv, s).some(a => a.id === 'custom-x'));
ok('delete: gone from includeHidden too', !assembleActions(inv, s, { includeHidden: true }).some(a => a.id === 'custom-x'));
let rem = assembleActions(inv, s, { includeRemoved: true });
ok('delete: surfaced only by includeRemoved, tagged _removed', rem.length === 1 && rem[0].id === 'custom-x' && rem[0]._removed, ids(rem));
ok('delete: removed view still carries the saved data', rem[0].label === 'Psychic Lash' && rem[0].dmgDice === '2d6', rem[0]);

// restore (what restoreAction writes — clears removed; override prunes empty)
delete s.actionOverrides['custom-x'].removed;
if (!Object.keys(s.actionOverrides['custom-x']).length) delete s.actionOverrides['custom-x'];
let back = assembleActions(inv, s).find(a => a.id === 'custom-x');
ok('restore: back in the list with its edited data intact', back && back.label === 'Psychic Lash' && back.ability === 'int' && back.dmgDice === '2d6', back);

// a deleted DERIVED attack stays suppressed (tombstone), and restoring re-derives it
let s2 = base({ actionOverrides: { 'wpn-longsword': { removed: true } } });
ok('derived delete: 1H suppressed', !assembleActions(inv, s2).some(a => a.id === 'wpn-longsword'));
delete s2.actionOverrides['wpn-longsword'];
ok('derived restore: 1H re-derives', assembleActions(inv, s2).some(a => a.id === 'wpn-longsword'));

console.log('\nsmoke-action-assembly: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
