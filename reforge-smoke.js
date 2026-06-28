/* reforge-smoke.js — exercises the SHIPPED reforge data functions (extracted from
 * shards.html): buildSnapshot → loadBuildIntoDraft round-trips a build unchanged, the
 * snapshot omits session fields, reset clears to blank, and reverseMapStructural rebuilds
 * a draft from structural. Pure data — no DOM needed. */
const fs = require('fs');
const src = fs.readFileSync('/mnt/user-data/outputs/shards.html', 'utf8');

function fn(name){                       // extract `function name(){...}` by brace match
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('missing fn: ' + name);
  let depth = 0, i = src.indexOf('{', at);
  for (; i < src.length; i++){ const c = src[i]; if (c === '{') depth++; else if (c === '}'){ depth--; if (!depth){ i++; break; } } }
  return src.slice(at, i);
}
function sliceToLineEnd(startMarker, endMarker){
  const a = src.indexOf(startMarker), b = src.indexOf(endMarker, a);
  return src.slice(a, src.indexOf('\n', b));
}
const helpers = sliceToLineEnd('function classDef(n){', 'var mcAddOpen = false;');
const body = [helpers, fn('freshDraft'), fn('normalizeDraft'), fn('buildSnapshot'), fn('loadBuildIntoDraft'), fn('resetDraft'), fn('reverseMapStructural')].join('\n');

// minimal DATA (only what the tests touch)
const DATA = { classes: [
  { n:'Bard',   subs:[{n:'College of Lore'},{n:'College of Valor'}], subAt:3, subTitle:'Bard College' },
  { n:'Cleric', subs:[{n:'Life Domain'},{n:'War Domain'}],           subAt:1, subTitle:'Divine Domain' }
], races:[{n:'Astral Elf',s:'AAG'},{n:'Tiefling',s:'PHB'}], backgrounds:[{n:'Sage',s:'PHB'},{n:'Acolyte',s:'PHB'}] };
const ensureSlots = () => {};
const draft = {};
const api = new Function('draft','DATA','ensureSlots', body +
  '\nreturn { buildSnapshot, loadBuildIntoDraft, resetDraft, reverseMapStructural };')(draft, DATA, ensureSlots);

let pass = 0, fail = 0;
const ok = (label, cond, detail) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── a full build placed on the live draft ──
const build = {
  name: 'Líadan Luchóg', species: { n:'Astral Elf', s:'AAG' }, subrace: null,
  abilities: { str:8, dex:14, con:13, int:10, wis:15, cha:12 }, method:'array',
  classes: [ { n:'Bard', level:2, subclass:{n:'College of Lore'}, starting:true },
             { n:'Cleric', level:1, subclass:{n:'Life Domain'}, starting:false } ],
  bg: { n:'Sage', s:'PHB' }, hp:{ method:'average' },
  spells: { cantrips:['Vicious Mockery'], known:['Healing Word'], prepared:['Cure Wounds'], spellbook:[] }
};
Object.keys(draft).forEach(k => delete draft[k]);
Object.assign(draft, build, { stepId:'review', _editKey:'liadan', _editName:'Líadan Luchóg', _editSource:'saved' });

// ── snapshot omits session fields ──
const snap = api.buildSnapshot();
ok('snapshot omits stepId', snap.stepId === undefined, snap.stepId);
ok('snapshot omits _editKey/_editName/_editSource', snap._editKey === undefined && snap._editName === undefined && snap._editSource === undefined, { k:snap._editKey });
ok('snapshot keeps name', snap.name === 'Líadan Luchóg', snap.name);
ok('snapshot keeps classes', eq(snap.classes, build.classes), snap.classes);
ok('snapshot keeps abilities', eq(snap.abilities, build.abilities), snap.abilities);
ok('snapshot keeps spells', eq(snap.spells, build.spells), snap.spells);

// ── round-trip: store snap → wipe → load → identical build ──
const stored = JSON.parse(JSON.stringify(snap));   // simulate Supabase JSON round-trip
api.loadBuildIntoDraft(stored);
ok('round-trip name', draft.name === build.name, draft.name);
ok('round-trip species', eq(draft.species, build.species), draft.species);
ok('round-trip classes (incl. subclasses + starting)', eq(draft.classes, build.classes), draft.classes);
ok('round-trip abilities', eq(draft.abilities, build.abilities), draft.abilities);
ok('round-trip background', eq(draft.bg, build.bg), draft.bg);
ok('round-trip spells', eq(draft.spells, build.spells), draft.spells);
ok('round-trip drops stale _editKey', draft._editKey === undefined, draft._editKey);
ok('mirror: draft.cls -> starting class (Bard)', !!draft.cls && draft.cls.n === 'Bard', draft.cls && draft.cls.n);

// ── reset clears to blank ──
api.resetDraft();
ok('reset: empty classes', Array.isArray(draft.classes) && draft.classes.length === 0, draft.classes);
ok('reset: name null', draft.name == null, draft.name);
ok('reset: stepId abilities', draft.stepId === 'abilities', draft.stepId);

// ── reverse-map from structural (legacy character, no _build) ──
const rebuilt = api.reverseMapStructural({
  name: 'Caim the Lost',
  classes: [ { name:'Bard', level:2, subclass:'College of Lore' }, { name:'Cleric', level:1, subclass:'Life Domain' } ],
  race: 'Astral Elf', background: 'Sage'
});
ok('reverse: name', rebuilt.name === 'Caim the Lost', rebuilt.name);
ok('reverse: classes order + starting', rebuilt.classes.length === 2 && rebuilt.classes[0].starting === true && rebuilt.classes[1].starting === false, rebuilt.classes.map(c=>[c.n,c.level,c.starting]));
ok('reverse: subclasses matched to DATA', eq(rebuilt.classes[0].subclass, {n:'College of Lore'}) && eq(rebuilt.classes[1].subclass, {n:'Life Domain'}), rebuilt.classes.map(c=>c.subclass));
ok('reverse: species matched by race name', eq(rebuilt.species, {n:'Astral Elf',s:'AAG'}), rebuilt.species);
ok('reverse: background matched by name', eq(rebuilt.bg, {n:'Sage',s:'PHB'}), rebuilt.bg);
// reverse-map intentionally omits abilities/spells (can't be cleanly recovered)
ok('reverse: omits abilities (flagged for confirm)', rebuilt.abilities === undefined, rebuilt.abilities);

console.log('\nreforge round-trip smoke: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
