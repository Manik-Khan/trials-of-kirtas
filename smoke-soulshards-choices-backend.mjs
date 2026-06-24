/* smoke-soulshards-choices-backend.mjs — proves the two backend halves of the
 * Choices feature: (1) the engine emits owed optional-feature groups into `pending`,
 * (2) derive folds chosen options into structural.features with origin stamps.
 * Run: node smoke-soulshards-choices-backend.mjs   (network + Node 18+ global fetch) */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Data    = require('./soul-shards-data.js');
const Engine  = require('./soul-shards-engine.js');
const Spellc  = require('./soul-shards-spellcasting.js');
const Derive  = require('./soul-shards-derive.js');

let pass = 0, fail = 0;
function ok(name, cond) { cond ? pass++ : fail++; console.log((cond ? '  ok   ' : '  FAIL ') + name); }
const ABIL = { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 8 };

(async () => {
  const fighter = await Data.loadClass('Fighter');

  // ── (1) engine emits owed optional-feature groups into pending ───────────────
  const b = Engine.build({ classModel: fighter, level: 3, abilities: ABIL, subclassShortName: 'Battle Master' });
  const ofp = (b.pending || []).filter(p => p.kind === 'optfeature');
  const fs = ofp.find(p => p.name === 'Fighting Style');
  const mv = ofp.find(p => p.name === 'Maneuvers');
  ok('engine pending → Fighting Style group',  !!fs);
  ok('  …origin class, count 1',               !!fs && fs.origin === 'class' && fs.count === 1);
  ok('  …carries featureType FS:F',            !!fs && fs.featureType.indexOf('FS:F') !== -1);
  ok('engine pending → Maneuvers group',       !!mv);
  ok('  …origin subclass, count 3',            !!mv && mv.origin === 'subclass' && mv.count === 3);

  // Champion at L3 owes only the class Fighting Style (its own unlocks at 10)
  const champ = Engine.build({ classModel: fighter, level: 3, abilities: ABIL, subclassShortName: 'Champion' });
  const champOf = (champ.pending || []).filter(p => p.kind === 'optfeature');
  ok('Champion L3 → exactly 1 optfeature group', champOf.length === 1 && champOf[0].name === 'Fighting Style');

  // ── (2) derive folds chosen options into features with origin stamps ─────────
  const res = Derive.deriveStructural({
    name: 'Tester',
    abilities: ABIL,
    classes: [{ model: fighter, level: 3, subclassShortName: 'Battle Master' }],
    choices: [
      { name: 'Trip Attack', origin: 'subclass', originName: 'Battle Master', entries: ['Spend a superiority die; the target must save or be knocked prone.'] },
      { name: 'Defense',     origin: 'class',    originName: 'Fighter',       entries: ['+1 AC while you are wearing armor.'] },
    ],
  }, { engine: Engine, spellcasting: Spellc });

  const feats = res.structural.features;
  const trip = feats.find(f => f.name === 'Trip Attack');
  const def  = feats.find(f => f.name === 'Defense');
  ok('derive folds Trip Attack',               !!trip);
  ok('  …subclass stamp (→ teal)',             !!trip && trip.source === 'subclass:Battle Master');
  ok('  …keeps its rule text',                 !!trip && /superiority die/.test(trip.desc || ''));
  ok('derive folds Defense',                   !!def);
  ok('  …class stamp (→ gold)',                !!def && def.source === 'class:Fighter');
  ok('no choices → features still assemble',   (() => {
    const bare = Derive.deriveStructural({ name: 'X', abilities: ABIL, classes: [{ model: fighter, level: 3, subclassShortName: 'Battle Master' }] }, { engine: Engine, spellcasting: Spellc });
    return Array.isArray(bare.structural.features) && !bare.structural.features.some(f => f.name === 'Trip Attack');
  })());

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('THREW:', e); process.exit(1); });
