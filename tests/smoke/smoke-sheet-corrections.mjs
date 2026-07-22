// Durable manual spell corrections: model, overlay, audit history, and provenance.
import {
  addSpellCorrection, applySpellCorrections, classNamesOf, closeCorrection,
  correctionLedger, correctionSummary, spellExists
} from '../../sheet-corrections.js';

let pass = 0, fail = 0;
const ok = (name, condition, detail) => { condition ? pass++ : (fail++, console.log('  FAIL:', name, detail === undefined ? '' : JSON.stringify(detail))); };

const base = {
  classLabel: 'Warlock 2 / Sorcerer 1',
  spellcasting: { groups: [{ heading: '1st Level', level: 1, spells: [{ name: 'Hex', origin: 'class', source: 'Warlock' }] }] }
};

ok('legacy classLabel yields both multiclass names', JSON.stringify(classNamesOf(base)) === JSON.stringify(['Warlock', 'Sorcerer']), classNamesOf(base));
ok('empty ledger has no active corrections', correctionSummary(base).active === 0);

const withShield = addSpellCorrection(base, {
  name: 'Shield', level: 1, source: 'Sorcerer', reason: 'Missing automation or rules data',
  note: 'Sorcerer multiclass spell.', status: 'confirmed',
  actor: 'Cosmere player', validator: { result: 'eligible', sources: ['Sorcerer'], rulesVersion: '5etools 2014' },
  spell: { time: [{ number: 1, unit: 'reaction' }] }
}, '2026-07-22T12:00:00.000Z');
const ledger = correctionLedger(withShield);
ok('add creates one active correction', ledger.active.length === 1);
ok('confirmed status is retained', ledger.active[0].status === 'confirmed');
ok('Sorcerer provenance is retained', ledger.active[0].source === 'Sorcerer');
ok('character editor is attributed', ledger.active[0].actor === 'Cosmere player' && ledger.history[0].actor === 'Cosmere player');
ok('add appends an audit event', ledger.history.length === 1 && ledger.history[0].kind === 'added');
ok('input structural is not mutated', !base.corrections);

const display = applySpellCorrections(base.spellcasting, withShield);
ok('Shield is overlaid into the live list', spellExists(display, 'Shield'));
const shield = display.groups[0].spells.find(sp => sp.name === 'Shield');
ok('overlay is manual and source-labelled Sorcerer', shield && shield.origin === 'manual' && shield.source === 'Sorcerer', shield);
ok('overlay carries the correction id', shield && shield.correctionId === ledger.active[0].id);
ok('base generated list remains untouched', !spellExists(base.spellcasting, 'Shield'));

const duplicate = addSpellCorrection(withShield, { name: 'shield', level: 1 });
ok('duplicate active spell correction is ignored', correctionLedger(duplicate).active.length === 1);

const generatedNow = { groups: [{ heading: '1st Level', level: 1, spells: [{ name: 'Shield', origin: 'class', source: 'Sorcerer' }] }] };
const noDouble = applySpellCorrections(generatedNow, withShield);
ok('generated spell is never duplicated by the overlay', noDouble.groups[0].spells.filter(sp => sp.name === 'Shield').length === 1);

const resolved = closeCorrection(withShield, ledger.active[0].id, 'resolved', 'Generator now carries Shield.', '2026-07-22T13:00:00.000Z');
ok('resolve removes the active correction', correctionLedger(resolved).active.length === 0);
ok('resolve preserves prior history and appends a resolution', correctionLedger(resolved).history.length === 2 && correctionLedger(resolved).history[1].kind === 'resolved');

console.log('\nsmoke-sheet-corrections: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
