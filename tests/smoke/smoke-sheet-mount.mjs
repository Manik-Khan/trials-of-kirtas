// smoke-sheet-mount.mjs
// ---------------------------------------------------------------------------
// Drives mountSheet() in jsdom against a mock CharacterData. Proves the sheet
// renders into an ARBITRARY container (not document): the panes populate from the
// row, the portrait halo + image paint, the filter defs inject once into the host
// document, and inspiration is wired scoped to the container (a click writes a
// FULL-vitals merge; the canEdit gate holds). No browser, no Supabase — mountSheet
// takes its CharacterData and never auto-runs. Commit beside smoke-sheet-data.mjs /
// smoke-sheet-actions.mjs.
// ---------------------------------------------------------------------------
import { JSDOM } from 'jsdom';
import { mountSheet } from '../../sheet-mount.js';

const tick = () => new Promise(r => setTimeout(r, 0));
const settle = async (n = 6) => { for (let i = 0; i < n; i++) await tick(); };
const clone = (o) => JSON.parse(JSON.stringify(o));
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) pass++; else { fail++; console.log('  FAIL: ' + label); } };

const ROW = {
  key: 'cosmere',
  structural: {
    name: 'Cosmere Runestar',
    classes: [{ name: 'Warlock', level: 2, subclass: 'The Hexblade' }, { name: 'Sorcerer', level: 1, subclass: 'Shadow Magic' }],
    race: 'Astral Elf', level: 3, alignment: 'Neutral Good', portrait: 'https://example.test/c.png',
    proficiencyBonus: 2, passivePerception: 13, passiveInsight: 13,
    abilities: { str:{score:8,mod:-1}, dex:{score:14,mod:2}, con:{score:14,mod:2}, int:{score:10,mod:0}, wis:{score:12,mod:1}, cha:{score:17,mod:3} },
    saves: { str:{bonus:-1,proficient:false}, dex:{bonus:2,proficient:false}, con:{bonus:2,proficient:false}, int:{bonus:0,proficient:false}, wis:{bonus:3,proficient:true}, cha:{bonus:5,proficient:true} },
    skills: [ {name:'Arcana',attr:'int',bonus:2,prof:true}, {name:'Perception',attr:'wis',bonus:3,prof:true}, {name:'Stealth',attr:'dex',bonus:2,prof:false} ],
    combat: { ac:14, acSource:'studded leather', hp:18, hpMax:23, initiative:2, speed:30, spellSaveDC:13, spellAttackBonus:5, hitDice:'2d8 + 1d6', senses:{darkvision:60} },
    proficiencies: { languages:['Common','Elvish','Infernal'] },
    classFeatures: { pactSlots:{max:2,level:1}, sorcererSlots:{'1':{max:2}}, sorceryPoints:{max:0,current:0} },
    spells: { cantrip:[{name:'Eldritch Blast',castingTime:'1 action'}], '1':[{name:'Hex',castingTime:'1 bonus'}] },
    features: [ {name:'Pact Magic',source:'class:Warlock',desc:'Short-rest pact slots.'}, {name:'Hex Warrior',source:'subclass:The Hexblade',desc:'CHA for a bonded weapon.'}, {name:'Fey Ancestry',source:'race:Astral Elf',desc:'Advantage vs charm.'} ]
  },
  vitals: { hp:18, hpTemp:4, hpBonus:0, concentration:'Hex', conditions:[], inspiration:true, pipState:{pactSlots:0,sorc_1:0} },
  notes: 'Patron stirs near the rift.'
};

function mockCD({ canEdit = true } = {}) {
  const calls = { save: [], loads: 0 };
  return {
    calls,
    async canEdit() { return canEdit; },
    async loadCharacter() { calls.loads++; return clone(ROW); },
    async save(k, patch) { calls.save.push([k, patch]); return Object.assign(clone(ROW), patch); }
  };
}

// ── scenario 1: mount into a <section> container, editable ──────────────────
{
  const dom = new JSDOM('<!doctype html><html><body><section id="slot"></section></body></html>');
  const slot = dom.window.document.getElementById('slot');
  const cd = mockCD();
  const h = mountSheet(slot, 'cosmere', { characterData: cd });
  await h.ready; await settle();

  ok(!!slot.querySelector('.tok-sheet'), 'sheet stamped into the container (not document)');
  ok(dom.window.document.querySelector('.tok-sheet') === slot.querySelector('.tok-sheet'), 'the only .tok-sheet lives inside the container');
  ok(/Cosmere/.test(slot.querySelector('[data-f="name"]').textContent), 'name rendered');
  ok(/Warlock/.test(slot.querySelector('[data-list="subline"]').textContent) && /Astral Elf/.test(slot.querySelector('[data-list="subline"]').textContent), 'subline classes + race rendered');
  ok(slot.querySelectorAll('[data-list="abilities"] .abil').length === 6, 'six ability tiles');
  ok(slot.querySelectorAll('[data-list="saves"] .save').length === 6, 'six saves');
  ok([...slot.querySelectorAll('[data-list="saves"] .save')].filter(e => e.classList.contains('prof')).length === 2, 'two proficient saves (Wis/Cha)');
  ok(slot.querySelectorAll('[data-list="features"] .feat').length === ROW.structural.features.length, 'all features rendered');
  ok(/t-race/.test(slot.querySelector('[data-list="features"]').innerHTML), 'feature origin stamp drives a race tag class');
  ok(/Pact Magic/.test(slot.querySelector('[data-list="pools"]').textContent), 'spell pools rendered from classFeatures');
  ok(slot.querySelector('[data-f="castAbility"]').textContent === 'Charisma', 'cast ability derived from spellSaveDC');
  ok(slot.querySelector('[data-f="hp"]').textContent === '18', 'hp rendered');
  ok(!!slot.querySelector('.portrait .frame img'), 'portrait image painted by applyExtras');
  ok(slot.querySelector('.portrait').classList.contains('inspired'), 'portrait halo reflects inspired state');
  ok(!!dom.window.document.getElementById('rough'), 'filter defs injected into the host document');
  ok(slot.querySelectorAll('[data-sfp-open]').length === 3, 'sheet header exposes Level Up, Facets, and the Shift');
  slot.querySelector('[data-sfp-open="facets"]').dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  ok(dom.window.document.querySelector('.sfp-veil').classList.contains('open'), 'Facets action opens the progression drawer');
  ok(/Current form/.test(dom.window.document.querySelector('[data-sfp-panel]').textContent), 'Facets drawer renders the current mechanical form');

  // inspiration wired, scoped to THIS container: a click writes a full-vitals merge
  const toggle = slot.querySelector('#insp-toggle');
  ok(toggle.getAttribute('aria-pressed') === 'true' || toggle.classList.contains('on'), 'toggle reflects inspired=true');
  ok(!toggle.classList.contains('view-only'), 'editable: toggle is interactive');
  toggle.dispatchEvent(new dom.window.Event('click'));
  await settle();
  ok(cd.calls.save.length === 1, 'click triggered exactly one save');
  const patch = cd.calls.save[0] && cd.calls.save[0][1];
  ok(!!patch && patch.vitals && patch.vitals.inspiration === false, 'save flipped inspiration to false');
  ok(!!patch && patch.vitals && patch.vitals.hp === 18 && patch.vitals.concentration === 'Hex', 'save preserved the rest of vitals (full-column merge)');
}

// ── scenario 2: defs idempotency + canEdit=false gate ───────────────────────
{
  const dom = new JSDOM('<!doctype html><html><body>' +
    '<svg aria-hidden="true"><defs><filter id="rough"></filter></defs></svg>' +  // host already has #rough
    '<section id="slot"></section></body></html>');
  const slot = dom.window.document.getElementById('slot');
  const cd = mockCD({ canEdit: false });
  const h = mountSheet(slot, 'cosmere', { characterData: cd });
  await h.ready; await settle();

  ok(dom.window.document.querySelectorAll('#rough').length === 1, 'ensureDefs is a no-op when host already carries the defs (no duplicate #rough)');
  const toggle = slot.querySelector('#insp-toggle');
  ok(toggle.classList.contains('view-only'), 'non-editable: toggle marked view-only');
  toggle.dispatchEvent(new dom.window.Event('click'));
  await settle();
  ok(cd.calls.save.length === 0, 'non-editable: click does NOT write');
  slot.querySelector('[data-sfp-open="level"]').dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  ok(dom.window.document.querySelector('[data-sfp-continue]').disabled, 'non-editable: Level Up explains itself through a disabled continue action');
}

// ── scenario 3: error paths render into the container, never throw ───────────
{
  const dom = new JSDOM('<!doctype html><html><body><section id="a"></section><section id="b"></section></body></html>');
  // 3a: no CharacterData
  const a = dom.window.document.getElementById('a');
  let threw = false;
  try { mountSheet(a, 'cosmere', { characterData: null }); } catch (_) { threw = true; }
  await settle();
  ok(!threw, 'missing CharacterData does not throw');
  ok(/CharacterData not loaded/.test(a.querySelector('[data-list="subline"]').innerHTML), 'missing CharacterData shows an inline error in the container');

  // 3b: unknown character (loadCharacter -> null)
  const b = dom.window.document.getElementById('b');
  const nullCD = { async canEdit() { return false; }, async loadCharacter() { return null; }, async save() {} };
  const h = mountSheet(b, 'nobody', { characterData: nullCD });
  await h.ready; await settle();
  ok(/No character/.test(b.querySelector('[data-list="subline"]').innerHTML), 'unknown character shows an inline error');
}

console.log(`\nsmoke-sheet-mount: ${pass}/${pass + fail} passed`);
if (fail) process.exit(1);
