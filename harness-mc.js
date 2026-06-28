/* harness-mc.js — proves the multiclass threading: load real class data from the
 * 2014 mirror, build derive-ready entries exactly as loadClassEntries() does, and
 * run SoulShardsDerive on a TWO-class build. Validates the derive path the rethreaded
 * buildStructuralPreview now feeds. Run: node harness-mc.js  (needs network) */
const SD = require('/tmp/soul-shards-data.js');
const SE = require('/tmp/soul-shards-engine.js');
const SC = require('/mnt/user-data/outputs/soul-shards-spellcasting.js'); // edited (slot fix)
const DV = require('/tmp/dv.js');

const abilities = { str: 8, dex: 14, con: 14, int: 10, wis: 11, cha: 17 }; // Cosmere

async function loadEntries(list) {            // [{ n, level, subN }], starting first
  return Promise.all(list.map(async ce => {
    const model = await SD.loadClass(ce.n);
    const sub = (model.subclasses || []).find(s => ce.subN && s.name === ce.subN);
    return { model, level: ce.level, subclassShortName: sub ? sub.shortName : null };
  }));
}
function derive(entries) {
  return DV.deriveStructural({
    name: 'Test', abilities, classes: entries, race: null,
    spells: [], spellbook: [], choices: [], feats: [], proficiencies: null,
    hp: { method: 'average' }, inventory: []
  }, { engine: SE, spellcasting: SC });
}

let pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) pass++;
  else { fail++; console.log('FAIL ' + label + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}

(async () => {
  // ── multiclass: Warlock 2 (Hexblade, STARTING) / Sorcerer 1 (Shadow Magic) ──
  const mc = await loadEntries([
    { n: 'Warlock', level: 2, subN: 'The Hexblade' },
    { n: 'Sorcerer', level: 1, subN: 'Shadow Magic' }
  ]);
  const s = derive(mc).structural;
  const profSaves = Object.keys(s.saves || {}).filter(k => s.saves[k].proficient).sort();
  const pools = (s.spellcasting && s.spellcasting.pools) || [];
  console.log('\n=== MULTICLASS  Warlock 2 / Sorcerer 1 ===');
  console.log('  classLabel :', s.classLabel);
  console.log('  hitDice    :', s.combat && s.combat.hitDice);
  console.log('  saves      :', profSaves);
  console.log('  castType   :', s.spellcasting && (s.spellcasting.castType || ('prepared=' + s.spellcasting.prepared)));
  console.log('  pools      :', pools.map(p => p.label + ' ' + p.max + '@L' + p.level));

  ok('classLabel = "Warlock 2 / Sorcerer 1" (starting first)', s.classLabel === 'Warlock 2 / Sorcerer 1', s.classLabel);
  ok('hitDice grouped "2d8 + 1d6"', (s.combat && s.combat.hitDice) === '2d8 + 1d6', s.combat && s.combat.hitDice);
  ok('total level 3', s.level === 3, s.level);
  ok('saves from FIRST class (Warlock = cha, wis)', JSON.stringify(profSaves) === JSON.stringify(['cha', 'wis']), profSaves);
  ok('pact pool present (2 @ L1)', pools.some(p => /Pact/.test(p.label) && p.max === 2 && p.level === 1), pools.map(p => [p.label, p.max, p.level]));
  ok('shared 1st-level pool present (2 @ L1, Sorcerer)', pools.some(p => !/Pact/.test(p.label) && p.level === 1 && p.max === 2), pools.map(p => [p.label, p.max, p.level]));
  ok('classFeatures slot ledger mirrored', !!(derive(mc).structural.classFeatures && (derive(mc).structural.classFeatures.pactSlots || derive(mc).structural.classFeatures.spellSlots)), derive(mc).structural.classFeatures);

  // ── regression: single class Warlock 2 (behaviour identical to pre-change) ──
  const s2 = derive(await loadEntries([{ n: 'Warlock', level: 2, subN: 'The Hexblade' }])).structural;
  console.log('\n=== SINGLE  Warlock 2 ===');
  console.log('  classLabel :', s2.classLabel, '| hitDice:', s2.combat && s2.combat.hitDice);
  ok('solo classLabel = "Warlock 2"', s2.classLabel === 'Warlock 2', s2.classLabel);
  ok('solo hitDice "2d8"', (s2.combat && s2.combat.hitDice) === '2d8', s2.combat && s2.combat.hitDice);
  ok('solo total level 2', s2.level === 2, s2.level);

  console.log('\nmulticlass derive harness: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e && e.stack || e); process.exit(2); });
