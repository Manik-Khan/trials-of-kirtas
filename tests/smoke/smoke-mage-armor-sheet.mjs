// Mounted-sheet Mage Armor smoke. Drives the real spell drawer, slot spend,
// live AC repaint, dismissal, armored-cast refusal, and equip-to-end path.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
window.eval(readFileSync(new URL('../../resource-derive.js', import.meta.url), 'utf8'));
window.eval(readFileSync(new URL('../../dice-engine.js', import.meta.url), 'utf8'));
window.eval(readFileSync(new URL('../../armor-ac.js', import.meta.url), 'utf8'));
window.eval(readFileSync(new URL('../../equip-slots.js', import.meta.url), 'utf8'));
window.eval(readFileSync(new URL('../../item-icons.js', import.meta.url), 'utf8'));
window.eval(readFileSync(new URL('../../gear-manager.js', import.meta.url), 'utf8'));
window.SoulShardsData = {
  loadSpellMeta: () => Promise.resolve([{
    name: 'Mage Armor', level: 1, school: 'A',
    time: [{ number: 1, unit: 'action' }], range: { distance: { type: 'touch' } },
    components: { v: true, s: true, m: 'a piece of cured leather' },
    duration: [{ type: 'timed', duration: { amount: 8, type: 'hour' } }],
    entries: ['The target\u2019s base AC becomes 13 + its Dexterity modifier.']
  }])
};
window.__tok = { sb: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }), insert: () => Promise.resolve({ error: null }) }) } };

const { mountSheet } = await import('../../sheet-mount.js');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await tick(); };
const clone = value => JSON.parse(JSON.stringify(value));
const click = el => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
let pass = 0, fail = 0;
const ok = (condition, label) => { if (condition) pass++; else { fail++; console.log('  FAIL: ' + label); } };

const baseRow = () => ({
  key: 'mage',
  structural: {
    name: 'Test Mage', classLabel: 'Wizard 3', level: 3, proficiencyBonus: 2,
    abilities: { str: { score: 8, mod: -1 }, dex: { score: 16, mod: 3 }, con: { score: 12, mod: 1 }, int: { score: 16, mod: 3 }, wis: { score: 10, mod: 0 }, cha: { score: 10, mod: 0 } },
    combat: { ac: 13, hp: 18, hpMax: 18, speed: 30, initiative: 3, spellSaveDC: 13, spellAttackBonus: 5 },
    classFeatures: { spellSlots: { 1: { max: 1 } } },
    spells: { 1: [{ name: 'Mage Armor', castingTime: '1 action' }] },
    proficiencies: { armor: [] }
  },
  vitals: { hp: 18, conditions: [], pipState: {} },
  inventory: [], currency: {}
});

async function mount(row) {
  const saved = [];
  const cd = {
    canEdit: () => Promise.resolve(true),
    loadCharacter: () => Promise.resolve(clone(row)),
    save: (key, patch) => { saved.push(clone(patch)); return Promise.resolve(clone(patch)); }
  };
  const container = document.createElement('div'); document.body.appendChild(container);
  const handle = mountSheet(container, row.key, { characterData: cd });
  await handle.ready; await settle();
  return { container, saved };
}
async function openMageArmor(container) {
  click([...container.querySelectorAll('.spell[data-spell]')].find(el => el.getAttribute('data-spell') === 'Mage Armor'));
  await settle();
  return container.querySelector('[data-spell-drawer="Mage Armor"] .sd-castbtn');
}

{
  const { container, saved } = await mount(baseRow());
  const cast = await openMageArmor(container);
  ok(cast && cast.textContent === 'Cast', 'Mage Armor drawer offers Cast while inactive');
  click(cast); await settle();
  const castSave = saved.find(patch => patch.vitals && patch.vitals.mageArmor);
  ok(castSave && castSave.vitals.pipState.spell_1 === 1, 'cast spends one 1st-level slot and saves Mage Armor active');
  ok(container.querySelector('[data-f="ac"]').textContent === '16', 'cast repaints AC to 13 + Dex (16)');
  ok(container.querySelector('[data-f="ac-sub"]').textContent === 'Mage Armor', 'cast repaints the AC source');
  const dismiss = await openMageArmor(container);
  ok(dismiss && dismiss.textContent === 'Dismiss', 'active Mage Armor drawer offers Dismiss');
  click(dismiss); await settle();
  const last = saved[saved.length - 1].vitals;
  ok(!last.mageArmor && last.pipState.spell_1 === 1, 'dismiss clears the effect without refunding the slot');
  ok(container.querySelector('[data-f="ac"]').textContent === '13', 'dismiss restores unarmored AC');
  container.remove();
}

{
  const row = baseRow(); row.inventory = [{ name: 'Leather', type: 'LA', ac: 11, slot: 'ARMOUR' }];
  const { container, saved } = await mount(row);
  const cast = await openMageArmor(container); click(cast); await settle();
  ok(saved.length === 0, 'casting while wearing body armor spends no slot and saves nothing');
  ok(container.querySelector('[data-f="ac"]').textContent === '14', 'armored cast refusal leaves worn-armor AC intact');
  ok(/remove body armor first/i.test(container.querySelector('#insp-stat').textContent), 'armored cast refusal explains why');
  container.remove();
}

{
  const row = baseRow(); row.vitals.mageArmor = true;
  row.inventory = [{ name: 'Dagger', type: 'M', slot: 'MAINHAND' }, { name: 'Leather', type: 'LA', ac: 11 }];
  const { container, saved } = await mount(row);
  ok(container.querySelector('[data-f="ac"]').textContent === '16', 'carried armor does not suppress active Mage Armor');
  click(container.querySelector('[data-eq="1"]')); await settle();
  const both = saved.find(patch => patch.inventory && patch.vitals);
  ok(both && both.inventory[1].slot === 'ARMOUR', 'body armor equip is persisted');
  ok(both && !both.vitals.mageArmor, 'equipping body armor ends Mage Armor in the same save');
  ok(container.querySelector('[data-f="ac"]').textContent === '14', 'equip repaints AC from the worn armor');
  container.remove();
}

console.log((fail ? '\u2717' : '\u2713') + ' mage-armor-sheet: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
