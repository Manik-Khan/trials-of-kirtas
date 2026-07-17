/* smoke-soulshards-feats.mjs — feat data layer + derive folding.
 * Run: node tests/smoke/smoke-soulshards-feats.mjs   (network + Node 18+ global fetch) */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Data    = require('../../soul-shards-data.js');
const Engine  = require('../../soul-shards-engine.js');
const Spellc  = require('../../soul-shards-spellcasting.js');
const Derive  = require('../../soul-shards-derive.js');

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + n); };

(async () => {
  const feats = await Data.loadFeats();
  ok('loadFeats returns the catalog', Array.isArray(feats) && feats.length > 80);
  const get = n => feats.find(f => f.name === n && ['PHB', 'XGE', 'TCE'].indexOf(f.source) !== -1);

  // ── prerequisite text + checking ──
  const grappler = get('Grappler'), warcaster = get('War Caster'), lucky = get('Lucky');
  ok('Grappler prereq text = STR 13',        Data.featPrereqText(grappler.prerequisite) === 'STR 13');
  ok('Grappler blocked at STR 12',           Data.featMeetsPrereq(grappler, { abilities: { str: 12 } }) === false);
  ok('Grappler allowed at STR 13',           Data.featMeetsPrereq(grappler, { abilities: { str: 13 } }) === true);
  ok('War Caster needs spellcasting (text)', /cast at least one spell/.test(Data.featPrereqText(warcaster.prerequisite)));
  ok('War Caster blocked for non-caster',    Data.featMeetsPrereq(warcaster, { caster: false }) === false);
  ok('War Caster allowed for caster',        Data.featMeetsPrereq(warcaster, { caster: true }) === true);
  ok('Lucky has no prerequisite',            Data.featPrereqText(lucky.prerequisite) === '' && Data.featMeetsPrereq(lucky, {}) === true);

  // ── half-feat ability shapes ──
  const resilient = get('Resilient'), actor = get('Actor'), athlete = get('Athlete');
  const rA = Data.featAbilityChoice(resilient);
  ok('Resilient → choose 1 of 6',            rA && rA.choose && rA.choose.amount === 1 && rA.choose.from.length === 6);
  ok('Actor → fixed +1 CHA',                 JSON.stringify(Data.featAbilityChoice(actor)) === JSON.stringify({ fixed: { cha: 1 } }));
  const aA = Data.featAbilityChoice(athlete);
  ok('Athlete → choose 1 of STR/DEX',        aA && aA.choose && aA.choose.from.length === 2 && aA.choose.from.indexOf('str') !== -1);
  ok('Lucky is not a half-feat',             Data.featAbilityChoice(lucky) === null);

  // ── featsForChar: source/UA filtered, eligibility stamped, sorted ──
  const ctx = { abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 8 }, level: 4, caster: false, raceName: 'Human' };
  const list = Data.featsForChar(feats, ctx);
  ok('featsForChar returns a filtered list', list.length > 50 && list.length <= feats.length);
  ok('  …source filter works (PHB only)',    (() => { const p = Data.featsForChar(feats, ctx, { sources: ['PHB'] }); return p.length === 42 && p.every(f => f.source === 'PHB'); })());
  ok('  …sorted by name',                    list.every((f, i) => i === 0 || f.name.localeCompare(list[i - 1].name) >= 0));
  const lg = list.find(f => f.name === 'Grappler'), lw = list.find(f => f.name === 'War Caster');
  ok('  …Grappler eligible (STR 16)',        lg && lg.eligible === true);
  ok('  …War Caster ineligible (no casting)', lw && lw.eligible === false);
  ok('  …carries prereqText + ability shape', lg && typeof lg.prereqText === 'string' && 'ability' in lg);
  const listCaster = Data.featsForChar(feats, Object.assign({}, ctx, { caster: true }));
  ok('  …War Caster flips eligible for caster', listCaster.find(f => f.name === 'War Caster').eligible === true);

  // ── derive folds feats under a feat: stamp (→ purple) ──
  const fighter = await Data.loadClass('Fighter');
  const res = Derive.deriveStructural({
    name: 'Tester', abilities: ctx.abilities,
    classes: [{ model: fighter, level: 4, subclassShortName: 'Champion' }],
    choices: [{ name: 'Defense', origin: 'class', originName: 'Fighter', entries: ['+1 AC while armored.'] }],
    feats: [{ name: 'Lucky', entries: ['You have 3 luck points.'] }],
  }, { engine: Engine, spellcasting: Spellc });
  const fl = res.structural.features.find(f => f.name === 'Lucky');
  ok('derive folds the feat',                !!fl);
  ok('  …purple feat: stamp',                !!fl && fl.source === 'feat:Feat');
  ok('  …keeps its text',                    !!fl && /luck points/.test(fl.desc));
  ok('feat + choice coexist in features',    !!res.structural.features.find(f => f.name === 'Defense' && f.source === 'class:Fighter'));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('THREW:', e); process.exit(1); });
