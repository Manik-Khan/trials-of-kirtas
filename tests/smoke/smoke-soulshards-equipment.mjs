/* smoke-soulshards-equipment.mjs — startingEquipment parsing (class + background). */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Data = require('../../soul-shards-data.js');

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + n); };

(async () => {
  ok('export intact (BASE/fetchJson restored)', typeof Data.BASE === 'string' && typeof Data.fetchJson === 'function' && typeof Data.parseStartingEquipment === 'function');

  const fighter = await Data.loadClass('Fighter');
  const eq = Data.parseStartingEquipment(fighter, []);
  ok('Fighter pulls from background',  eq.fromBackground === true);
  ok('Fighter gold alternative parsed', eq.goldAlternative === '5d4 × 10');
  ok('Fighter has 4 equipment groups',  eq.groups.length === 4);
  ok('  …all are a/b choices',          eq.groups.every(g => g.kind === 'choice'));

  const g0 = eq.groups[0];
  ok('group 0: A = chain mail',         g0.options[0].items[0].name === 'chain mail' && g0.options[0].items[0].qty === 1);
  ok('group 0: B = armor+bow+arrows',   g0.options[1].items.map(i => i.name).join(',') === 'leather armor,longbow,arrows (20)');

  const g1 = eq.groups[1];
  ok('group 1: A has a martial-weapon category', g1.options[0].items.some(i => i.category === 'weaponMartial' && i.name === 'any martial weapon'));
  ok('group 1: A also a shield',        g1.options[0].items.some(i => i.name === 'shield'));
  ok('group 1: B = two martial weapons', g1.options[1].items[0].category === 'weaponMartial' && g1.options[1].items[0].qty === 2);

  const g2 = eq.groups[2];
  ok('group 2: B = handaxe ×2',         g2.options[1].items[0].name === 'handaxe' && g2.options[1].items[0].qty === 2);

  // ── background (Soldier): fixed line (incl special + a pouch of coin) + a choice ──
  const bgs = await Data.loadBackgrounds();
  const soldier = Data.backgroundEquipment(bgs, 'Soldier', 'PHB');
  ok('Soldier equipment found',         Array.isArray(soldier) && soldier.length === 2);
  const beq = Data.parseStartingEquipment(fighter, soldier);
  ok('combined = class 4 + bg 2 groups', beq.groups.length === 6);
  const bgFixed = beq.groups.find(g => g.source === 'background' && g.kind === 'fixed');
  ok('bg fixed group present',          !!bgFixed);
  ok('  …special items kept verbatim',  bgFixed.items.some(i => i.special && /insignia of rank/.test(i.name)));
  ok('  …pouch carries its coin value', bgFixed.items.some(i => i.name === 'pouch' && i.value === 1000));
  const bgChoice = beq.groups.find(g => g.source === 'background' && g.kind === 'choice');
  ok('bg choice group present',         !!bgChoice && bgChoice.options.length === 2);
  ok('  …displayName respected',        bgChoice.options[0].items[0].name === 'bone dice set');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('THREW:', e); process.exit(1); });
