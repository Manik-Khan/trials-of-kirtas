// rail-composer-smoke.mjs
// ---------------------------------------------------------------------------
// The composer half of the rail swap, driven natively (node ESM + jsdom) —
// smoke-rail.mjs covers the rail shell on the plain-input fallback (jsdom
// can't resolve the dynamic import), so THIS harness proves the surface the
// browser actually gets:
//   • createComposer with pageTabs → tab strip renders, switches, filters
//   • Enter precedence: picker-open Enter is consumed (defaultPrevented) so
//     the rail's send listener stays quiet; picker-closed Enter sends;
//     Shift+Enter falls through (line break)
//   • docToFeedBody: paragraphs → <br>, chips → the locked spans
//   • the capture round-trip: a feed body html → serializeDoc → doc nodes,
//     docToRefs, docToHTML (what "Send to my journal" persists)
//   • journal-capture exports the rail depends on (insertPage/insertRefs)
// Run: node rail-composer-smoke.mjs
// ---------------------------------------------------------------------------
import { JSDOM } from 'jsdom';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) pass++; else { fail++; console.log('  FAIL: ' + label); } };

const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>', { url: 'https://tok.test/world.html' });
global.window = dom.window; global.document = dom.window.document;

const mc = await import('./mention-composer.js');
const jc = await import('./journal-capture.js');

// ── exports the rail depends on ─────────────────────────────────────
ok(typeof jc.insertPage === 'function', 'journal-capture exports insertPage');
ok(typeof jc.insertRefs === 'function', 'journal-capture exports insertRefs');
ok(typeof jc.freeSlug === 'function', 'journal-capture exports freeSlug');
ok(typeof mc.docToFeedBody === 'function', 'mention-composer exports docToFeedBody');

// ── composer with pageTabs ──────────────────────────────────────────
const MINE = [
  { id: 'watch-rotations', type: 'page', label: 'Watch rotations', hint: 'Field Notes' },
  { id: 'debts-owed', type: 'page', label: 'Debts owed', hint: 'Field Notes' },
];
const ALL = MINE.concat([
  { id: 'the-yevennia-road', type: 'page', label: 'The Yevennia Road', hint: 'Cosmere' },
  { id: 'houses-of-the-capital', type: 'page', label: 'Houses of the Capital', hint: 'Narrator' },
]);
const host = document.getElementById('host');
const composer = mc.createComposer(host, {
  placeholder: 'test',
  pool: () => ({ npcs: [{ id: 'general-darius', type: 'npc', label: 'General Darius', hint: '' }], locations: [] }),
  pageTabs: () => [ { id: 'mine', label: 'My notes', items: MINE }, { id: 'all', label: 'All', items: ALL } ],
});
const ed = composer.el;
const pick = host.querySelector('.mc-pick');
ok(!!ed && !!pick, 'composer mounted (editor + picker)');

// place a caret inside the editor's text and fire input → refresh
function type(text) {
  ed.innerHTML = '';
  const t = document.createTextNode(text);
  ed.appendChild(t);
  const r = document.createRange();
  r.setStart(t, text.length); r.collapse(true);
  const s = dom.window.getSelection();
  s.removeAllRanges(); s.addRange(r);
  ed.dispatchEvent(new dom.window.Event('input', { bubbles: false }));
  return t;
}

// [[ with no query → tab strip + my-notes items
type('see [[');
ok(pick.style.display !== 'none', '[[ opens the picker');
const tabs = pick.querySelectorAll('.mc-pick-tab');
ok(tabs.length === 2, 'two [[ tabs render');
ok(tabs[0].classList.contains('on'), 'My notes is the default tab');
ok(pick.querySelectorAll('.mc-pick-item').length === 2, 'seat tab shows 2 pages');
ok(!pick.textContent.includes('Yevennia'), 'others’ pages absent on the seat tab');

// switch to All (mousedown, like a click-through)
tabs[1].dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
ok(pick.querySelectorAll('.mc-pick-item').length === 4, 'All tab shows 4 pages');
ok(pick.textContent.includes('Yevennia'), 'others’ pages present on All');
ok(pick.querySelector('.mc-pick-tab.on').textContent === 'All', 'tab highlight moved');

// filtering within the active tab
type('see [[hous');
ok(pick.querySelectorAll('.mc-pick-item').length === 1 && pick.textContent.includes('Houses'), '[[ query filters the active tab');

// no match → tabs stay visible with the empty note (Enter still consumed)
type('see [[zzz');
ok(!!pick.querySelector('.mc-pick-none'), 'no-match note shows under the tabs');

// ── Enter precedence (the rail's listener order) ────────────────────
// The rail attaches its send listener AFTER createComposer, so it sees
// e.defaultPrevented when the picker consumed Enter. Reproduce that order.
let sends = 0;
ed.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.defaultPrevented || e.shiftKey) return;
  e.preventDefault(); sends++;
});
function pressEnter(shift = false) {
  ed.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', shiftKey: shift, bubbles: true, cancelable: true }));
}

// picker open on @ → Enter inserts the chip, send does NOT fire
type('ask @dar');
ok(pick.style.display !== 'none', '@ opens the picker');
pressEnter();
ok(sends === 0, 'picker-open Enter did not send');
ok(!!ed.querySelector('[data-mention-key="general-darius"]'), 'picker-open Enter inserted the chip');
ok(pick.style.display === 'none', 'picker closed after insert');

// picker closed → Enter sends; Shift+Enter falls through
pressEnter();
ok(sends === 1, 'picker-closed Enter sends');
pressEnter(true);
ok(sends === 1, 'Shift+Enter is a line break, not a send');

// ── docToFeedBody ───────────────────────────────────────────────────
const doc2 = {
  type: 'doc', content: [
    { type: 'paragraph', content: [
      { type: 'text', text: 'We ride for ' },
      { type: 'tokMention', attrs: { id: 'tiersgard', type: 'location', label: 'Tiersgard', resolved: true } },
      { type: 'text', text: ' at dawn' },
    ] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Bring the letter' }] },
  ],
};
const body = mc.docToFeedBody(doc2);
ok(!/^<p>/.test(body) && !/<\/p>$/.test(body), 'feed body drops the <p> wrapper');
ok(body.includes('<br>'), 'paragraph break becomes <br>');
ok(/data-mention-key="tiersgard"/.test(body) && /location-link/.test(body), 'chip span survives with the locked class');
ok(body.includes('We ride for') && body.includes('Bring the letter'), 'both lines present');

// ── the capture round-trip (feed body → journal page pieces) ────────
const box = document.createElement('div');
box.innerHTML = '<div>' + body.split(/<br\s*\/?>/i).join('</div><div>') + '</div>';   // exactly what "Send to my journal" does
const docBack = mc.serializeDoc(box);
ok(docBack.content.length === 2, 'capture: <br> splits back into 2 paragraphs');
const chips = [];
(function walk(n) { if (n.type === 'tokMention') chips.push(n); (n.content || []).forEach(walk); })(docBack);
ok(chips.length === 1 && chips[0].attrs.id === 'tiersgard' && chips[0].attrs.resolved === true, 'capture: chip parsed back to a live node');
const refs = mc.docToRefs(docBack);
ok(refs.length === 1 && refs[0].kind === 'entity' && refs[0].id === 'tiersgard', 'capture: refs extracted for journal_refs');
const html2 = mc.docToHTML(docBack);
ok(/data-mention-key="tiersgard"/.test(html2) && /^<p>/.test(html2), 'capture: html cache round-trips in the locked span format');

// dice noise flattens to text, never fake chips
box.innerHTML = '1d20+7 → [<span class="ft-die">14</span>] + 7 = <span class="ft-tot">21</span>';
const rollDoc = mc.serializeDoc(box);
ok(mc.docToRefs(rollDoc).length === 0, 'capture: a roll body yields no refs');
ok(mc.docToHTML(rollDoc).includes('21'), 'capture: roll text survives as plain prose');

// unresolved chips round-trip with the dashed class intact
box.innerHTML = 'met <span data-mention-type="npc-unresolved" data-mention-key="brother-ashwyn" class="tok-mention npc-unresolved">@Brother Ashwyn</span>&nbsp;today';
const unDoc = mc.serializeDoc(box);
const unHtml = mc.docToHTML(unDoc);
ok(/npc-unresolved/.test(unHtml) && /brother-ashwyn/.test(unHtml), 'capture: unresolved chip keeps its dashed identity');

console.log(`\nrail-composer-smoke: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
