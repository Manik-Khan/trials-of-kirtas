// Durable manual spell corrections: model, overlay, audit history, and provenance.
import {
  addFeatureCorrection, addSpellCorrection, addSuppressionCorrection, applyFeatureCorrections, applySpellCorrections, classNamesOf, closeCorrection,
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

const caim = {
  features: [
    { name: 'Infernal Legacy', source: 'race:Tiefling', desc: 'Hellish Rebuke and Darkness.' },
    { name: 'Legacy of Avernus', source: 'race:Tiefling', desc: 'Searing Smite and Branding Smite.' }
  ],
  spellcasting: { groups: [{ heading: '1st Level', level: 1, spells: [
    { name: 'Hellish Rebuke', origin: 'race', source: 'Tiefling' },
    { name: 'Searing Smite', origin: 'race', source: 'Tiefling' }
  ] }] }
};
const hideHellish = addSuppressionCorrection(caim, {
  kind: 'spell', name: 'Hellish Rebuke', source: 'Tiefling', reason: 'Replaced by another rule',
  note: 'Zariel replaces Infernal Legacy.', actor: 'Caim player'
}, '2026-07-22T14:00:00.000Z');
ok('spell suppression is active and confirmed', correctionLedger(hideHellish).active[0].action === 'suppress' && correctionLedger(hideHellish).active[0].status === 'confirmed');
ok('spell suppression appends a suppressed audit event', correctionLedger(hideHellish).history[0].kind === 'suppressed');
const caimSpells = applySpellCorrections(caim.spellcasting, hideHellish);
ok('suppressed Hellish Rebuke is absent from display', !spellExists(caimSpells, 'Hellish Rebuke'));
ok('unrelated generated Searing Smite remains', spellExists(caimSpells, 'Searing Smite'));
ok('generated spellcasting input stays untouched', spellExists(caim.spellcasting, 'Hellish Rebuke'));
ok('suppressed correction id is reported', caimSpells.correctionIdsSuppressed.length === 1);
ok('duplicate suppression is ignored', correctionLedger(addSuppressionCorrection(hideHellish, { kind:'spell', name:'hellish rebuke', source:'Tiefling' })).active.length === 1);

const hideTrait = addSuppressionCorrection(hideHellish, {
  kind: 'feature', name: 'Infernal Legacy', source: 'race:Tiefling', reason: 'Replaced by another rule'
}, '2026-07-22T14:05:00.000Z');
const caimFeatures = applyFeatureCorrections(caim.features, hideTrait);
ok('suppressed Infernal Legacy is absent from feature display', !caimFeatures.features.some(f => f.name === 'Infernal Legacy'));
ok('unrelated Legacy of Avernus remains', caimFeatures.features.some(f => f.name === 'Legacy of Avernus'));
ok('generated feature input stays untouched', caim.features.some(f => f.name === 'Infernal Legacy'));

const withFlurry = addFeatureCorrection(hideTrait, {
  name: 'Flurry of Blows', source: 'Monk', desc: 'Spend 1 ki point to make two unarmed strikes.',
  reason: 'Missing automation or rules data', actor: 'Caim player'
}, '2026-07-22T14:10:00.000Z');
const featureDisplay = applyFeatureCorrections(caim.features, withFlurry);
const flurry = featureDisplay.features.find(f => f.name === 'Flurry of Blows');
ok('manual feature correction is overlaid', !!flurry);
ok('manual feature carries custom provenance and correction id', flurry && flurry.source === 'custom:Monk' && !!flurry.correctionId, flurry);
ok('summary counts spell + feature additions and suppressions', correctionSummary(withFlurry).active === 3, correctionSummary(withFlurry));

const restoredHellish = closeCorrection(withFlurry, correctionLedger(withFlurry).active[0].id, 'restored', '', '2026-07-22T15:00:00.000Z');
ok('restore removes only the suppression', correctionLedger(restoredHellish).active.length === 2);
ok('restore appends a restored history event', correctionLedger(restoredHellish).history.slice(-1)[0].kind === 'restored');
ok('restored generated spell returns to display', spellExists(applySpellCorrections(caim.spellcasting, restoredHellish), 'Hellish Rebuke'));

console.log('\nsmoke-sheet-corrections: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
