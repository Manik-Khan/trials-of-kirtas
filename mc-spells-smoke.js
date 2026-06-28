/* mc-spells-smoke.js — validates the SHIPPED multiclass spell code from shards.html:
 *  (1) spellsForStructural() aggregates every caster's picks with that class's own
 *      origin/source/ability, dedupes globally, and emits the flat list the derive eats.
 *  (2) migrateSpells()/ensureSpellBucket() convert a legacy flat draft.spells into the
 *      per-class byClass shape, filing old picks under the starting class. Pure data. */
const fs = require('fs');
const src = fs.readFileSync('/mnt/user-data/outputs/shards.html', 'utf8');
function fn(name){
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('missing fn: ' + name);
  let depth = 0, i = src.indexOf('{', at);
  for (; i < src.length; i++){ const c = src[i]; if (c === '{') depth++; else if (c === '}'){ depth--; if (!depth){ i++; break; } } }
  return src.slice(at, i);
}
let pass = 0, fail = 0;
const ok = (l, c, d) => { if (c) pass++; else { fail++; console.log('FAIL ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ── (1) emit ─────────────────────────────────────────────────────────────── */
// wrap the shipped spellsForStructural with its module-scoped free vars as params
const emitFactory = new Function(
  '_casters','_grants','_bgSet','_shared','racialAbility','raceName','picksFor',
  fn('spellsForStructural') + '\nreturn spellsForStructural;');

// two-caster build: Bard 2 (known, Cha) / Cleric 1 (prepared, Wis)
const casters = [
  { key:'Bard', ent:{ cls:'Bard', viaSub:false, mode:'known', ability:'cha' },
    classSet:{ 'vicious mockery':1,'healing word':1,'faerie fire':1 },
    detail:{ 'Vicious Mockery':{level:0,time:null}, 'Healing Word':{level:1,time:null}, 'Faerie Fire':{level:1,time:null} } },
  { key:'Cleric', ent:{ cls:'Cleric', viaSub:false, mode:'prepared', ability:'wis' },
    classSet:{ 'sacred flame':1,'cure wounds':1,'bless':1,'healing word':1 },
    detail:{ 'Sacred Flame':{level:0,time:null}, 'Cure Wounds':{level:1,time:null}, 'Bless':{level:1,time:null}, 'Healing Word':{level:1,time:null} } }
];
const buckets = {
  Bard:   { cantrips:['Vicious Mockery'], known:['Healing Word','Faerie Fire'], prepared:[], spellbook:[] },
  Cleric: { cantrips:['Sacred Flame'], known:[], prepared:['Cure Wounds','Bless','Healing Word'], spellbook:[] }  // Healing Word also here -> dedup test
};
const emit = emitFactory(casters, [], {}, { detail:{} }, () => null, () => 'Astral Elf', (k) => buckets[k]);
const res = emit();
const byName = {}; res.spells.forEach(s => { byName[s.name] = s; });

ok('emit: all picked spells present (Healing Word deduped -> 6 unique)', res.spells.length === 6, res.spells.map(s=>s.name));
ok('Bard cantrip tagged Bard/Cha', byName['Vicious Mockery'] && byName['Vicious Mockery'].source==='Bard' && byName['Vicious Mockery'].ability==='cha' && byName['Vicious Mockery'].level==='cantrip', byName['Vicious Mockery']);
ok('Bard known tagged Bard/Cha/lvl1', byName['Faerie Fire'] && byName['Faerie Fire'].source==='Bard' && byName['Faerie Fire'].ability==='cha' && byName['Faerie Fire'].level===1, byName['Faerie Fire']);
ok('Cleric cantrip tagged Cleric/Wis', byName['Sacred Flame'] && byName['Sacred Flame'].source==='Cleric' && byName['Sacred Flame'].ability==='wis', byName['Sacred Flame']);
ok('Cleric prepared tagged Cleric/Wis/lvl1', byName['Cure Wounds'] && byName['Cure Wounds'].source==='Cleric' && byName['Cure Wounds'].ability==='wis' && byName['Cure Wounds'].level===1, byName['Cure Wounds']);
ok('Bless tagged Cleric/Wis', byName['Bless'] && byName['Bless'].source==='Cleric' && byName['Bless'].ability==='wis', byName['Bless']);
// Healing Word appears in BOTH buckets; Bard is emitted first -> Bard wins, single entry
ok('shared spell deduped to first caster (Bard)', byName['Healing Word'] && byName['Healing Word'].source==='Bard' && byName['Healing Word'].ability==='cha', byName['Healing Word']);
ok('emit: origin is class for all picks', res.spells.every(s => s.origin==='class'), res.spells.map(s=>s.origin));

// racial grant wins a collision + lands once
const emit2 = emitFactory(
  [ casters[0] ],
  [ { name:'Faerie Fire', kind:'spell', level:1, how:'known' } ],   // race also grants Faerie Fire
  {}, { detail:{ 'Faerie Fire':{level:1,time:null} } }, () => 'cha', () => 'Astral Elf',
  (k) => ({ Bard:{ cantrips:[], known:['Faerie Fire'], prepared:[], spellbook:[] } }[k]));
const r2 = emit2();
const ff = r2.spells.filter(s => s.name==='Faerie Fire');
ok('racial grant + class pick collide -> single entry, race attribution wins', ff.length===1 && ff[0].origin==='race', ff);

/* ── (2) flat -> byClass migration ────────────────────────────────────────── */
const migFactory = new Function('draft','DATA','SUBCLASS_CASTERS',
  [ fn('classDef'), fn('startingClassEntry'), fn('orderedClasses'),
    fn('classDefCaster'), fn('classIsCaster'), fn('casterClasses'),
    fn('ensureSpellBucket'), fn('migrateSpells') ].join('\n') +
  '\nreturn { migrateSpells: migrateSpells, ensureSpellBucket: ensureSpellBucket };');
const DATA = { classes:[
  { n:'Bard', caster:'full', subAt:3, subs:[] }, { n:'Cleric', caster:'full', subAt:1, subs:[] },
  { n:'Fighter', caster:null, subAt:3, subs:[{n:'Eldritch Knight'}] } ] };
const SUBCLASS_CASTERS = { 'Eldritch Knight':{progression:'1/3'}, 'Arcane Trickster':{progression:'1/3'} };

// legacy flat draft (Bard starting) -> arrays filed under Bard, Cleric bucket created empty
const draftA = { classes:[ {n:'Bard',level:2,starting:true}, {n:'Cleric',level:1,starting:false} ],
  spells:{ cantrips:['Vicious Mockery'], known:['Healing Word'], prepared:[], spellbook:[] } };
const mA = migFactory(draftA, DATA, SUBCLASS_CASTERS); mA.migrateSpells();
ok('migrate: byClass created', draftA.spells.byClass && typeof draftA.spells.byClass==='object', draftA.spells);
ok('migrate: old flat filed under starting class (Bard)', eq(draftA.spells.byClass.Bard, { cantrips:['Vicious Mockery'], known:['Healing Word'], prepared:[], spellbook:[] }), draftA.spells.byClass.Bard);
ok('migrate: second caster (Cleric) gets empty bucket', eq(draftA.spells.byClass.Cleric, { cantrips:[], known:[], prepared:[], spellbook:[] }), draftA.spells.byClass.Cleric);

// non-caster (Fighter Champion) gets NO bucket
const draftB = { classes:[ {n:'Fighter',level:3,subclass:{n:'Champion'},starting:true} ], spells:{ byClass:{} } };
const mB = migFactory(draftB, DATA, SUBCLASS_CASTERS); mB.migrateSpells();
ok('migrate: non-caster class gets no bucket', !draftB.spells.byClass.Fighter, draftB.spells.byClass);

// Eldritch Knight Fighter (subclass caster, level >= 3) DOES get a bucket
const draftC = { classes:[ {n:'Fighter',level:3,subclass:{n:'Eldritch Knight'},starting:true} ], spells:{ byClass:{} } };
const mC = migFactory(draftC, DATA, SUBCLASS_CASTERS); mC.migrateSpells();
ok('migrate: subclass-caster (Eldritch Knight) gets a bucket', !!draftC.spells.byClass.Fighter, draftC.spells.byClass);

console.log('\nmulticlass spells smoke: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
