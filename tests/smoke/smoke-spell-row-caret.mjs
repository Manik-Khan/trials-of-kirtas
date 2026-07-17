// smoke-spell-row-caret.mjs
// The spell row through the REAL renderSpellcasting/groupHTML/spellHTML: the tap-to-read
// caret leads each row, origin classes + concentration badge survive, and the row keeps the
// data-spell/data-level/data-conc the cast + drawer handlers read.
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
await import('../../sheet-mount.js');
const S = window.__sheet;
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : (fail++, console.log('  FAIL:', n, d !== undefined ? JSON.stringify(d) : '')); };

ok('__sheet.renderSpellcasting exposed', S && typeof S.renderSpellcasting === 'function');

const root = document.createElement('div'); root.className = 'tok-sheet';
root.innerHTML = '<div data-list="spellGroups"></div>';
S.renderSpellcasting(root, {
  saveDC: 13, ability: 'INT',
  groups: [{
    heading: 'Cantrips', level: 0,
    spells: [
      { name: 'Fire Bolt', origin: 'class', source: 'Wizard', time: [{ number: 1, unit: 'action' }] },
      { name: 'Hex', origin: 'subclass', source: 'Warlock', level: 1, conc: true, time: [{ number: 1, unit: 'bonus' }] },
      { name: 'Hellish Rebuke', origin: 'race', source: 'Tiefling', level: 1, time: [{ number: 1, unit: 'reaction' }] }
    ]
  }]
});
const gb = root.querySelector('[data-list="spellGroups"]');

ok('three spell rows rendered', gb.querySelectorAll('.spell[data-spell]').length === 3, gb.querySelectorAll('.spell').length);
ok('a caret renders per row', gb.querySelectorAll('.s-car').length === 3, gb.querySelectorAll('.s-car').length);

const fb = gb.querySelector('.spell[data-spell="Fire Bolt"]');
ok('Fire Bolt row exists', !!fb);
ok('caret is the FIRST child of the row', fb && fb.firstElementChild && fb.firstElementChild.classList.contains('s-car'), fb && fb.firstElementChild && fb.firstElementChild.className);
ok('name still present after caret', fb && fb.querySelector('.s-n') && fb.querySelector('.s-n').textContent.indexOf('Fire Bolt') === 0);
ok('row keeps data-level for the cast handler', fb && fb.getAttribute('data-level') === '0', fb && fb.getAttribute('data-level'));

const hex = gb.querySelector('.spell[data-spell="Hex"]');
ok('Hex carries data-conc=1', hex && hex.getAttribute('data-conc') === '1');
ok('Hex shows the concentration badge', hex && !!hex.querySelector('.s-conc'));
ok('Hex caret coexists with conc badge', hex && !!hex.querySelector('.s-car') && !!hex.querySelector('.s-conc'));

ok('origin class: subclass row → o-sub', !!gb.querySelector('.spell.o-sub[data-spell="Hex"]'));
ok('origin class: race row → o-race', !!gb.querySelector('.spell.o-race[data-spell="Hellish Rebuke"]'));
ok('origin class: class row → o-class', !!gb.querySelector('.spell.o-class[data-spell="Fire Bolt"]'));

console.log('\nsmoke-spell-row-caret: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
