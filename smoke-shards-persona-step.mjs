// smoke-shards-persona-step.mjs
// Extracts the PERSONA STEP block spliced into shards.html and exercises its logic
// against light stubs (no DOM): body structure, bio init, keep/cap/drop enforcement,
// rollInto candidate selection, and the draft.bio -> sheet bio-column transform.
import { readFileSync } from 'fs';

const html = readFileSync(new URL('./shards.html', import.meta.url), 'utf8');
const A = '// ==== PERSONA STEP (start) ====';
const B = '// ==== PERSONA STEP (end) ====';
const block = html.slice(html.indexOf(A), html.indexOf(B) + B.length);

// stubs for the inline-script globals the block closes over
const escHtml = x => String(x).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
let saves = 0; const saveDraft = () => { saves++; };
const qStub = () => ({ innerHTML: '', value: '', setAttribute() {}, removeAttribute() {}, hasAttribute() { return false; }, classList: { add() {}, remove() {} } });
const draft = { name: 'Vesperian', bg: { n: 'Soldier' }, bgCustom: false };

globalThis.SoulShardsPersona = {
  forBackground: () => ({ personality: ['p1', 'p2', 'p3', 'p4'], ideals: ['i1', 'i2'], bonds: ['b1'], flaws: ['f1'] }),
  pool: () => ({ personality: ['p1', 'p2', 'p3', 'p4', 'p5'], ideals: ['i1', 'i2'], bonds: ['b1'], flaws: ['f1'] }),
  othersFor: () => ({ personality: [{ text: 'o1', src: 'Sage' }], ideals: [], bonds: [], flaws: [] }),
  load: () => Promise.resolve(),
};

const F = new Function('draft', 'q', 'escHtml', 'saveDraft',
  block + '\n; return { personaBody, ensurePersonaBio, personaBioIsEmpty, personaBioForColumn, colBioEmpty, psCapFor, keepCand, dropKept, rollInto };'
)(draft, qStub, escHtml, saveDraft);

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } };
const count = (h, sub) => h.split(sub).length - 1;

// ── body structure ─────────────────────────────────────────────────────────
const body = F.personaBody();
ok('renders four trait cards', count(body, 'data-card=') === 4);
ok('cards labelled Personality/Ideals/Bonds/Flaws',
  body.includes('Personality Traits') && body.includes('>Ideals<') && body.includes('>Bonds<') && body.includes('>Flaws<'));
ok('renders six appearance fields', count(body, 'data-detail=') === 6);
ok('each card has own + any roll buttons', count(body, 'data-roll="own"') === 4 && count(body, 'data-roll="all"') === 4);
ok('has distinguishing-features + backstory textareas', body.includes('data-features') && body.includes('data-backstory'));
ok('personality card advertises keep 2', body.includes('keep 2'));

// ── bio init + emptiness ────────────────────────────────────────────────────
F.ensurePersonaBio();
ok('ensurePersonaBio creates the four trait arrays', ['personality','ideals','bonds','flaws'].every(k => Array.isArray(draft.bio[k])));
ok('ensurePersonaBio creates details object', draft.bio.details && typeof draft.bio.details === 'object');
ok('a fresh bio reads as empty', F.personaBioIsEmpty() === true);
ok('psCapFor: personality=2, ideals=1', F.psCapFor('personality') === 2 && F.psCapFor('ideals') === 1);

// ── keep / cap / drop ───────────────────────────────────────────────────────
F.rollInto('personality', 'own'); F.keepCand('personality');
F.rollInto('personality', 'own'); F.keepCand('personality');
ok('keep two personality traits (cap reached)', draft.bio.personality.length === 2);
F.rollInto('personality', 'all'); F.keepCand('personality');   // should be rejected at cap 2
ok('third keep rejected (cap enforced)', draft.bio.personality.length === 2);
ok('bio no longer empty after keeps', F.personaBioIsEmpty() === false);
F.dropKept('personality', 0);
ok('dropKept removes one', draft.bio.personality.length === 1);

F.rollInto('ideals', 'own'); F.keepCand('ideals');
F.rollInto('ideals', 'own'); F.keepCand('ideals');             // cap 1 -> rejected
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
