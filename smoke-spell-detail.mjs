// smoke-spell-detail.mjs
// The spell-detail renderer + 5etools formatters: inline {@tag} formatting, the recursive
// entries renderer (paragraphs / lists / named sub-entries / tables), the four structured
// fields → readable strings, the richer attack/save+damage breakout, and the assembled drawer.
import { fmtText, renderEntries, fmtTime, fmtRange, fmtComponents, fmtDuration, schoolLine, effectLine, spellDetailHTML, feedSummary, ordinal } from './spell-detail.js';
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : (fail++, console.log('  FAIL:', n, d !== undefined ? JSON.stringify(d) : '')); };
const has = (h, s, n) => ok(n, h.indexOf(s) >= 0, h);

console.log('--- inline {@tag} formatting ---');
has(fmtText('takes {@damage 1d10} fire damage'), '<b class="sd-dice">1d10</b>', 'damage dice bolded');
has(fmtText('a {@scaledamage 1d10|1-9|1d10} bolt'), '<b class="sd-dice">1d10</b>', 'scaledamage shows base dice');
has(fmtText('make a {@dc 15} save'), '<b>DC 15</b>', 'DC rendered');
has(fmtText('the {@condition prone} condition'), '<span class="sd-kw">prone</span>', 'condition as keyword');
has(fmtText('as {@spell fireball|phb|Fire Ball}'), '<i class="sd-ref">Fire Ball</i>', 'spell ref uses display name');
has(fmtText('{@h}fire damage'), '<b>Hit:</b>', '{@h} → Hit:');
ok('plain text untouched + escaped', fmtText('a < b & c') === 'a &lt; b &amp; c', fmtText('a < b & c'));

console.log('--- entries renderer ---');
ok('string → paragraph', renderEntries(['Hello world']) === '<p>Hello world</p>');
{
  const h = renderEntries([{ type: 'list', items: ['one', 'two'] }]);
  has(h, '<ul class="sd-list">', 'list → ul'); has(h, '<li>one</li>', 'list items');
}
{
  const h = renderEntries([{ type: 'entries', name: 'Special', entries: ['detail here'] }]);
  has(h, '<div class="sd-subh">Special</div>', 'named sub-entry heading'); has(h, 'detail here', 'sub-entry body');
}
{
  const h = renderEntries([{ type: 'table', colLabels: ['d6', 'Effect'], rows: [['1', 'spark'], ['2', 'puff']] }]);
  has(h, '<table class="sd-table">', 'table renders'); has(h, '<th>d6</th>', 'table header'); has(h, '<td>spark</td>', 'table cell');
}

console.log('--- structured-field formatters ---');
ok('time: 1 action', fmtTime([{ number: 1, unit: 'action' }]) === '1 action', fmtTime([{ number: 1, unit: 'action' }]));
ok('time: 1 bonus action', fmtTime([{ number: 1, unit: 'bonus' }]) === '1 bonus action', fmtTime([{ number: 1, unit: 'bonus' }]));
ok('time: reaction + condition', fmtTime([{ number: 1, unit: 'reaction', condition: 'when damaged' }]) === '1 reaction, when damaged');
ok('range: 120 feet', fmtRange({ type: 'point', distance: { type: 'feet', amount: 120 } }) === '120 feet', fmtRange({ type: 'point', distance: { type: 'feet', amount: 120 } }));
ok('range: self', fmtRange({ type: 'point', distance: { type: 'self' } }) === 'Self');
ok('range: touch', fmtRange({ type: 'point', distance: { type: 'touch' } }) === 'Touch');
ok('range: self radius shape', fmtRange({ type: 'radius', distance: { type: 'feet', amount: 10 } }) === 'Self (10-foot radius)', fmtRange({ type: 'radius', distance: { type: 'feet', amount: 10 } }));
ok('components: V, S, M(...)', fmtComponents({ v: true, s: true, m: 'a bit of fleece' }) === 'V, S, M (a bit of fleece)'.replace('fleece','fleece'), fmtComponents({ v: true, s: true, m: 'a bit of fleece' }));
ok('components: V, S only', fmtComponents({ v: true, s: true }) === 'V, S');
ok('duration: instantaneous', fmtDuration([{ type: 'instant' }]) === 'Instantaneous');
ok('duration: concentration 1 hour', fmtDuration([{ type: 'timed', duration: { type: 'hour', amount: 1 }, concentration: true }]) === 'Concentration, up to 1 hour', fmtDuration([{ type: 'timed', duration: { type: 'hour', amount: 1 }, concentration: true }]));
ok('ordinal 0/1/3', ordinal(0) === 'cantrip' && ordinal(1) === '1st' && ordinal(3) === '3rd');

console.log('--- school line + richer effect line ---');
has(schoolLine({ school: 'V', level: 0 }), 'Evocation cantrip', 'cantrip school line');
has(schoolLine({ school: 'A', level: 3, concentration: true }), '3rd-level abjuration', 'leveled school line');
has(schoolLine({ school: 'A', level: 3, concentration: true }), 'Concentration', 'concentration flag');
{
  const fb = { school: 'V', level: 0, spellAttack: ['R'], damageInflict: ['fire'], entries: ['takes {@damage 1d10} fire damage'] };
  const h = effectLine(fb); has(h, 'Ranged spell attack', 'attack mechanic'); has(h, '1d10 fire', 'damage breakout');
}
{
  const save = { school: 'V', level: 1, savingThrow: ['dexterity'], damageInflict: ['fire'], entries: ['{@damage 2d10} fire damage'] };
  has(effectLine(save), 'DEX save', 'save mechanic abbreviated'); has(effectLine(save), '2d10 fire', 'save damage');
}
ok('effect line empty when no attack/save/damage', effectLine({ school: 'A', level: 3, entries: ['You interrupt a spell'] }) === '', effectLine({ school: 'A', level: 3, entries: ['x'] }));

console.log('--- full drawer assembly + feed summary ---');
const fireBolt = {
  name: 'Fire Bolt', school: 'V', level: 0,
  time: [{ number: 1, unit: 'action' }], range: { type: 'point', distance: { type: 'feet', amount: 120 } },
  components: { v: true, s: true }, duration: [{ type: 'instant' }],
  spellAttack: ['R'], damageInflict: ['fire'],
  entries: ['You hurl a mote of fire. Make a ranged spell attack. On a hit, the target takes {@damage 1d10} fire damage.', 'A flammable object hit by this spell ignites if it isn\u2019t being worn or carried.'],
  entriesHigherLevel: [{ type: 'entries', name: 'Cantrip Upgrade', entries: ['This spell\u2019s damage increases by {@dice 1d10} when you reach 5th level.'] }]
};
{
  const h = spellDetailHTML(fireBolt);
  has(h, 'Evocation cantrip', 'drawer: school line');
  has(h, 'Ranged spell attack', 'drawer: effect line');
  has(h, 'Casting time', 'drawer: meta grid');
  has(h, '120 feet', 'drawer: formatted range');
  has(h, 'Instantaneous', 'drawer: formatted duration');
  has(h, '<b class="sd-dice">1d10</b> fire damage', 'drawer: body with inline dice');
  has(h, 'A flammable object', 'drawer: full body (second paragraph)');
  has(h, 'sd-higher', 'drawer: higher-level callout');
  has(h, 'Cantrip Upgrade', 'drawer: higher-level heading');
}
has(feedSummary(fireBolt), 'Evocation cantrip \u00b7 ranged spell attack \u00b7 1d10 fire', 'feed summary line');

console.log('\nsmoke-spell-detail: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
