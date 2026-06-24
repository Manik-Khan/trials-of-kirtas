// smoke-world-marks.mjs
// ---------------------------------------------------------------------------
// Focused smoke for the Marks→rail integration in world.html. We don't stand up
// the whole map page (pan/zoom, Netlify map-pins, canon pins) — we slice out the
// new marks-pane functions (buildMarksPane / closeMarkDetail / renderMarkDetail /
// saveMarkNote) and exercise them in jsdom against test doubles for the page
// globals they lean on (playerPins, PIN_TYPES, currentIdentity, escapeHtml,
// renderPins/renderMarksList/savePins, window.TokRail). This proves the bits that
// are genuinely new: the reparent of the live marks elements into the rail pane,
// the master-detail note view, inline edit + persist, and close. The registry
// seam they ride on is covered separately by smoke-rail.mjs.
//
// Run: node smoke-world-marks.mjs
// ---------------------------------------------------------------------------
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

let pass = 0, fail = 0;
const ok = (c, label) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + label); } };

// Slice the contiguous marks-pane block out of world.html's inline script.
const html = readFileSync('./world.html', 'utf8');
const inline = (html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/) || [])[1] || '';
const a = inline.indexOf('function injectMarksRailCss');
const b = inline.indexOf('function registerMarksTab');
if (a < 0 || b < 0 || b <= a) { console.log('could not locate marks block in world.html'); process.exit(1); }
const MARKS_SRC = inline.slice(a, b);

const dom = new JSDOM(`<!doctype html><html><head></head><body>
  <div id="tok-rail">
    <div class="tr-panes"></div>
  </div>
  <aside id="marks-panel">
    <div class="marks-filter-row" id="marks-filter-row"></div>
    <div class="marks-list" id="marks-list"></div>
    <div class="marks-footer"><button class="marks-place-btn" id="marks-place-btn">+ Place a Mark</button></div>
    <div class="marks-identity" id="marks-identity-bar"><span id="marks-id-name">Cosmere</span></div>
  </aside>
</body></html>`, { runScripts: 'outside-only' });
const { window } = dom;
const { document } = window;

// ── test doubles for the page globals the sliced functions reference ──
let savedTimes = 0, showTab = null;
window.playerPins = [
  { id: 'p1', type: 'landmark', x: 10, y: 20, note: 'Tavern in Mortain', placedBy: 'Cosmere', character: 'Warlock', color: '#c05060', playerId: 'cosmere', timestamp: '2026-06-20T12:00:00Z' },
  { id: 'p2', type: 'danger', x: 30, y: 40, note: '', placedBy: 'Líadan', character: 'Bard', color: '#5a9a6a', playerId: 'liadan', timestamp: '2026-06-21T12:00:00Z' },
];
window.PIN_TYPES = [
  { id: 'monster', label: 'Monster', color: '#c05060' },
  { id: 'landmark', label: 'Landmark', color: '#b8952a' },
  { id: 'treasure', label: 'Treasure', color: '#d4ac3a' },
  { id: 'revisit', label: 'Revisit', color: '#8ab4cc' },
  { id: 'note', label: 'Note', color: '#e8e0d0' },
  { id: 'danger', label: 'Danger', color: '#c9824a' },
];
window.currentIdentity = { playerId: 'cosmere', name: 'Cosmere', character: 'Warlock', color: '#c05060' };
window.selectedKey = null;
window.escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
window.renderPins = () => {};
window.renderMarksList = () => {};
window.savePins = async () => { savedTimes++; };
window.TokRail = { ready: true, show: (t) => { showTab = t; } };

window.eval(MARKS_SRC);   // defines buildMarksPane / closeMarkDetail / renderMarkDetail / saveMarkNote on window

// ── buildMarksPane: reparent the live elements into the rail pane ──
const pane = document.createElement('section');
pane.className = 'tr-pane';
pane.setAttribute('data-rail-pane', 'marks');
document.querySelector('.tr-panes').appendChild(pane);
window.buildMarksPane(pane);

ok(pane.querySelector('#marks-filter-row'), 'buildMarksPane: filter row reparented into the rail pane');
ok(pane.querySelector('#marks-list'), 'buildMarksPane: list reparented');
ok(pane.querySelector('#marks-place-btn'), 'buildMarksPane: place button reparented (id preserved for startPlacing)');
ok(pane.querySelector('#marks-identity-bar'), 'buildMarksPane: identity bar reparented');
ok(pane.querySelector('#marks-detail'), 'buildMarksPane: master-detail container added');
ok(pane.querySelector('.trm-scroll #marks-list'), 'buildMarksPane: list sits inside the scroll region');
ok(document.getElementById('marks-rail-css'), 'buildMarksPane: scoped v11 CSS injected once');

// ── renderMarkDetail (read mode) for an OWNED pin → note + edit/delete ──
window.renderMarkDetail('p1', false);
const d = document.getElementById('marks-detail');
ok(d.style.display === 'block', 'renderMarkDetail: detail shown');
ok(showTab === 'marks', 'renderMarkDetail: rail switched to the Marks tab');
ok(window.selectedKey === 'player-p1', 'renderMarkDetail: pin marked selected (drives map highlight)');
ok(d.textContent.includes('Tavern in Mortain'), 'renderMarkDetail: note rendered');
ok(d.querySelector('.trm-edit-btn') && d.querySelector('.trm-del'), 'renderMarkDetail: owner gets Edit + Delete');

// ── a pin the viewer does NOT own → no edit/delete ──
window.renderMarkDetail('p2', false);
ok(!document.querySelector('#marks-detail .trm-del'), 'renderMarkDetail: non-owner gets no Delete');
ok(document.querySelector('#marks-detail .trm-note.empty'), 'renderMarkDetail: empty note shows placeholder styling');

// ── edit mode → textarea seeded with the note ──
window.renderMarkDetail('p1', true);
const ta = document.getElementById('mark-edit-note');
ok(!!ta && ta.value === 'Tavern in Mortain', 'renderMarkDetail(edit): textarea seeded with current note');

// ── saveMarkNote → updates the pin + persists ──
ta.value = 'Tavern in Mortain — back room is the contact';
await window.saveMarkNote('p1');
ok(window.playerPins.find(p => p.id === 'p1').note === 'Tavern in Mortain — back room is the contact', 'saveMarkNote: pin note updated');
ok(savedTimes === 1, 'saveMarkNote: persisted via savePins');
ok(document.querySelector('#marks-detail .trm-note') && !document.getElementById('mark-edit-note'), 'saveMarkNote: returns to read view');

// ── closeMarkDetail → hidden + deselected ──
window.closeMarkDetail();
ok(d.style.display === 'none' && window.selectedKey === null, 'closeMarkDetail: hidden + deselected');

console.log(`\nsmoke-world-marks: ${pass}/${pass + fail} passed${fail ? `  (${fail} FAILED)` : ''}`);
process.exit(fail ? 1 : 0);
