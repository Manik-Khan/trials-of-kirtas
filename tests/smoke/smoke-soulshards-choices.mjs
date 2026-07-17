/* smoke-soulshards-choices.mjs — proves the optional-feature data layer reads
 * "choose N from a pool" generically from live 5etools 2014 data.
 * Run: node tests/smoke/smoke-soulshards-choices.mjs   (needs network + Node 18+ global fetch) */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const D = require('../../soul-shards-data.js');

let pass = 0, fail = 0;
function ok(name, cond) { cond ? pass++ : fail++; console.log((cond ? '  ok   ' : '  FAIL ') + name); }
const byName = (groups, name) => groups.find(g => g.name === name);

// ── pure unit: progression resolution (both encodings) ──────────────────────
ok('array prog L1 = 0', D.progressionCountAt([0,2,2,2,3], 1) === 0);
ok('array prog L2 = 2', D.progressionCountAt([0,2,2,2,3], 2) === 2);
ok('array prog L5 = 3', D.progressionCountAt([0,2,2,2,3], 5) === 3);
ok('obj prog L3 = 3',   D.progressionCountAt({'3':3,'7':5,'10':7}, 3) === 3);
ok('obj prog L6 = 3',   D.progressionCountAt({'3':3,'7':5,'10':7}, 6) === 3);
ok('obj prog L7 = 5',   D.progressionCountAt({'3':3,'7':5,'10':7}, 7) === 5);
ok('obj prog L1 = 0',   D.progressionCountAt({'3':3}, 1) === 0);

(async () => {
  // ── Fighter / Battle Master @ L3: Fighting Style (class,1) + Maneuvers (sub,3) ─
  const fighter = await D.loadClass('Fighter');
  const bm = await D.owedFeatureChoices(fighter, 'Battle Master', 3);
  const fs = byName(bm, 'Fighting Style'), mv = byName(bm, 'Maneuvers');
  ok('BM L3 → Fighting Style group',       !!fs);
  ok('  …origin class, count 1',           !!fs && fs.origin === 'class' && fs.count === 1);
  ok('  …options resolved (≥6)',           !!fs && fs.options.length >= 6);
  ok('  …includes Defense',                !!fs && fs.options.some(o => o.name === 'Defense'));
  ok('BM L3 → Maneuvers group',            !!mv);
  ok('  …origin subclass, count 3',        !!mv && mv.origin === 'subclass' && mv.count === 3);
  ok('  …options resolved (≥10)',          !!mv && mv.options.length >= 10);
  ok('  …includes Trip Attack',            !!mv && mv.options.some(o => o.name === 'Trip Attack'));

  // ── Champion: own Fighting Style unlocks at 10, so L3 owes only the class one ─
  const champ3 = await D.owedFeatureChoices(fighter, 'Champion', 3);
  ok('Champion L3 → exactly 1 group',      champ3.length === 1 && champ3[0].name === 'Fighting Style');
  const champ10 = await D.owedFeatureChoices(fighter, 'Champion', 10);
  ok('Champion L10 → two FS groups',       champ10.filter(g => g.name === 'Fighting Style').length === 2);

  // ── Warlock @ L2: Invocations choose 2; Pact Boon not until 3 ────────────────
  const warlock = await D.loadClass('Warlock');
  const scShort = (warlock.subclasses[0] || {}).shortName;
  const wl2 = await D.owedFeatureChoices(warlock, scShort, 2);
  const ei = byName(wl2, 'Eldritch Invocations');
  ok('Warlock L2 → Invocations group',     !!ei);
  ok('  …count 2',                         !!ei && ei.count === 2);
  ok('  …no Pact Boon yet',                !byName(wl2, 'Pact Boon'));
  ok('  …level-gated option excluded',     !!ei && !ei.options.some(o => o.name === 'Lifedrinker')); // req. lvl 12
  ok('  …Agonizing Blast present',         !!ei && ei.options.some(o => o.name === 'Agonizing Blast'));
  ok('  …prereq surfaced for display',     !!ei && ((ei.options.find(o => o.name === 'Agonizing Blast') || {}).prereqText || '').length > 0);

  // ── nothing owed: a build below any choice level returns an empty list ───────
  const champ1 = await D.owedFeatureChoices(fighter, 'Champion', 1);
  ok('Fighter L1 Champion still owes FS',  champ1.length === 1);  // class FS is level 1

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('THREW:', e); process.exit(1); });
