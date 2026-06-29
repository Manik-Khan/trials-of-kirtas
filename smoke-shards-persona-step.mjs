// smoke-shards-persona-step.mjs
// Exercises the PERSONA STEP block from shards.html against light stubs (no DOM):
//  - body structure (four cards, visible per-bg suggestion containers, six appearance fields)
//  - personaSyncBg(): a background change clears the stale candidate; same bg preserves it
//  - keep / cap / drop enforcement, rollInto, and the draft.bio -> sheet bio-column transform
import { readFileSync } from 'fs';

const html = readFileSync(new URL('./shards.html', import.meta.url), 'utf8');
const A = '// ==== PERSONA STEP (start) ====';
const B = '// ==== PERSONA STEP (end) ====';
const block = html.slice(html.indexOf(A), html.indexOf(B) + B.length);

const escHtml = x => String(x).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
let saves = 0; const saveDraft = () => { saves++; };
const qStub = () => ({ innerHTML: '', value: '', setAttribute() {}, removeAttribute() {}, hasAttribute() { return false; }, classList: { add() {}, remove() {} } });
const draft = { name: 'Vesperian', bg: { n: 'Soldier' }, bgCustom: false };

globalThis.SoulShardsPersona = {
  forBackground: name => name === 'Acolyte'
    ? ({ personality: ['a1', 'a2'], ideals: ['ai1'], bonds: ['ab1'], flaws: ['af1'] })
    : ({ personality: ['p1', 'p2', 'p3', 'p4'], ideals: ['i1', 'i2'], bonds: ['b1'], flaws: ['f1'] }),
  pool: () => ({ personality: ['p1', 'p2', 'p3', 'p4', 'p5'], ideals: ['i1', 'i2'], bonds: ['b1'], flaws: ['f1'] }),
  othersFor: () => ({ personality: [{ text: 'o1', src: 'Sage' }], ideals: [], bonds: [], flaws: [] }),
  load: () => Promise.resolve(),
};

const F = new Function('draft', 'q', 'escHtml', 'saveDraft',
  block + '\n; return { personaBody, ensurePersonaBio, personaBioIsEmpty, personaBioForColumn, colBioEmpty, psCapFor, keepCand, dropKept, rollInto, personaSyncBg, getCand: function(){ return personaCand; } };'
)(draft, qStub, escHtml, saveDraft);

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } };
const count = (h, sub) => h.split(sub).length - 1;

// ── body structure ─────────────────────────────────────────────────────────
const body = F.personaBody();
ok('renders four trait cards', count(body, 'data-card=') === 4);
ok('each card has a visible per-background suggestion list', count(body, 'data-own=') === 4);
ok('shows a "From <background>" label bound to the chosen bg', body.includes('From <b>Soldier</b>'));
ok('renders six appearance fields', count(body, 'data-detail=') === 6);
ok('each card has own + any roll buttons', count(body, 'data-roll="own"') === 4 && count(body, 'data-roll="all"') === 4);
ok('has distinguishing-features + backstory textareas', body.includes('data-features') && body.includes('data-backstory'));
ok('personality card advertises keep 2', body.includes('keep 2'));

// ── background change re-keys the step ──────────────────────────────────────
F.personaSyncBg();                       // first sync establishes Soldier
F.rollInto('personality', 'own');        // sets a candidate from Soldier's list
ok('a candidate is set after rolling', F.getCand().personality != null);
F.personaSyncBg();                       // same background -> candidate preserved
ok('same background keeps the candidate', F.getCand().personality != null);
draft.bg = { n: 'Acolyte' };             // user switches background
const changed = F.personaSyncBg();
ok('personaSyncBg reports the change', changed === true);
ok('switching background clears the stale candidate', F.getCand().personality === null);
const body2 = F.personaBody();
ok('the "From" label follows the new background', body2.includes('From <b>Acolyte</b>') && !body2.includes('From <b>Soldier</b>'));

// ── keep / cap / drop ───────────────────────────────────────────────────────
draft.bg = { n: 'Soldier' }; F.personaSyncBg();
F.rollInto('personality', 'own'); F.keepCand('personality');
F.rollInto('personality', 'own'); F.keepCand('personality');
ok('keep two personality traits (cap reached)', draft.bio.personality.length === 2);
F.rollInto('personality', 'all'); F.keepCand('personality');
ok('third keep rejected (cap enforced)', draft.bio.personality.length === 2);
F.dropKept('personality', 0);
ok('dropKept removes one', draft.bio.personality.length === 1);
F.rollInto('ideals', 'own'); F.keepCand('ideals');
F.rollInto('ideals', 'own'); F.keepCand('ideals');
ok('ideals capped at 1', draft.bio.ideals.length === 1);

// ── bio -> column transform ─────────────────────────────────────────────────
draft.bio.personality = ['I face problems head-on.', 'I have a crude sense of humor.'];
draft.bio.ideals = ['Greater Good.'];
draft.bio.details = { age: '24', eyes: 'grey' };
draft.bio.features = 'A long scar across the jaw.';
draft.bio.backstory = 'Conscripted young; the only home she knew was the line.';
const col = F.personaBioForColumn();
ok('personality joins to a newline string', col.personality === 'I face problems head-on.\nI have a crude sense of humor.');
ok('ideals joins to a string', col.ideals === 'Greater Good.');
ok('appearance composes labelled details', col.appearance.includes('Age: 24') && col.appearance.includes('Eyes: grey'));
ok('appearance appends distinguishing features', col.appearance.includes('A long scar across the jaw.'));
ok('backstory carried through', col.backstory === 'Conscripted young; the only home she knew was the line.');
ok('column keys match the sheet contract',
  ['personality','ideals','bonds','flaws','backstory','appearance'].every(k => typeof col[k] === 'string'));

// ── existing-bio emptiness guard (reforge fill-if-empty) ────────────────────
ok('colBioEmpty: {} is empty', F.colBioEmpty({}) === true);
ok('colBioEmpty: null is empty', F.colBioEmpty(null) === true);
ok('colBioEmpty: populated is not empty', F.colBioEmpty({ personality: 'x' }) === false);

console.log('\nsmoke-shards-persona-step: ' + pass + ' passed, ' + fail + ' failed  (saveDraft calls=' + saves + ')');
if (fail) process.exit(1);
