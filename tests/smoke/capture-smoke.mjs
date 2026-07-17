/* capture-smoke.mjs — journal capture + mention composer harness.
   Run: node tests/smoke/capture-smoke.mjs   (needs jsdom; journal/ symlinked or present)

   Covers:
     A. serializeDoc      — contenteditable → doc JSON (blocks, chips, nbsp, flattening)
     B. docToHTML         — exact renderHTML span parity + escaping
     C. round-trip        — my spans re-parsed under the journal's parseHTML rules
     D. docToRefs         — dedupe, kinds, ref_type mapping
     E. docToFeedBody     — the rail serializer
     F. freeSlug          — dup suffixing
     G. buildPool         — canon + entities merge
     H. picker            — @/[[ trigger, items, chip insert (jsdom selection)
     I. boot regression   — whenTok resolves on late nav:ready (document event)
     J. save path         — insert shapes over a stub sb client               */

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>', { url: 'https://tok.test/' });
global.window = dom.window;
global.document = dom.window.document;
global.CustomEvent = dom.window.CustomEvent;

const { createComposer, serializeDoc, docToHTML, docToRefs, docToFeedBody, buildPool, slug } =
  await import('../../mention-composer.js');
const { freeSlug, mountJournalCapture } = await import('../../journal-capture.js');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; } else { fail++; console.error('  ✗', name); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name + '\n    got:  ' + JSON.stringify(a) + '\n    want: ' + JSON.stringify(b));

/* ── A. serializeDoc ─────────────────────────────────────────────── */
{
  const ed = document.createElement('div');
  ed.innerHTML = 'Held the gate with <span contenteditable="false" data-mention-type="npc" data-mention-key="caim" class="tok-mention npc-link">@Caim</span>\u00a0tonight.' +
    '<div>See <span contenteditable="false" data-pagelink="debts-oaths" data-pagelink-label="Debts &amp; oaths" class="page-link">Debts &amp; oaths</span> for the rest.</div>' +
    '<div><br></div>' +
    '<div>New name: <span contenteditable="false" data-mention-type="location-unresolved" data-mention-key="runoff-row" class="tok-mention location-unresolved">@Runoff Row</span></div>';
  const doc = serializeDoc(ed);
  ok(doc.type === 'doc' && doc.content.length === 4, 'A1 four paragraphs (incl. the empty line)');
  eq(doc.content[0].content[1], { type: 'tokMention', attrs: { id: 'caim', type: 'npc', label: 'Caim', resolved: true } }, 'A2 mention node attrs');
  ok(doc.content[0].content[2].text === ' tonight.', 'A3 nbsp normalized to space');
  eq(doc.content[1].content[1], { type: 'pageLink', attrs: { pageId: 'debts-oaths', label: 'Debts & oaths' } }, 'A4 pagelink node attrs');
  ok(!doc.content[2].content, 'A5 empty block → bare paragraph');
  eq(doc.content[3].content[1].attrs, { id: 'runoff-row', type: 'location', label: 'Runoff Row', resolved: false }, 'A6 unresolved type split');
  const ed2 = document.createElement('div');
  ed2.innerHTML = 'plain <b>bold?</b> run';                 // stray markup flattens
  const d2 = serializeDoc(ed2);
  eq(d2.content[0].content, [{ type: 'text', text: 'plain bold? run' }], 'A7 unknown markup flattens to one text node');
  const ed3 = document.createElement('div'); ed3.innerHTML = '';
  ok(serializeDoc(ed3).content.length === 1, 'A8 empty editor → one empty paragraph');
}

/* ── B. docToHTML parity ─────────────────────────────────────────── */
{
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'Ask ' },
    { type: 'tokMention', attrs: { id: 'cosmere-runestar', type: 'npc', label: 'Cosmere Runestar', resolved: true } },
    { type: 'text', text: ' about <it> & "that"' },
    { type: 'tokMention', attrs: { id: 'pale-broker', type: 'npc', label: 'Pale Broker', resolved: false } },
    { type: 'pageLink', attrs: { pageId: 'debts-oaths', label: 'Debts & oaths' } },
  ] }] };
  const html = docToHTML(doc);
  ok(html.includes('<span data-mention-type="npc" data-mention-key="cosmere-runestar" class="tok-mention npc-link">@Cosmere Runestar</span>'), 'B1 resolved mention span exact');
  ok(html.includes('<span data-mention-type="npc-unresolved" data-mention-key="pale-broker" class="tok-mention npc-unresolved">@Pale Broker</span>'), 'B2 unresolved suffix + class');
  ok(html.includes('<span data-pagelink="debts-oaths" data-pagelink-label="Debts &amp; oaths" class="page-link">Debts &amp; oaths</span>'), 'B3 pagelink span exact');
  ok(html.includes('about &lt;it&gt; &amp; &quot;that&quot;'), 'B4 text escaped');
  ok(html.startsWith('<p>') && html.endsWith('</p>'), 'B5 paragraph wrapper');
}

/* ── C. round-trip under the journal's parseHTML rules ───────────── */
{
  // Reimplements MentionExtension/PageLink parseHTML attr rules verbatim.
  const parseMention = el => ({
    id: el.getAttribute('data-mention-key'),
    type: (el.getAttribute('data-mention-type') || 'npc').replace('-unresolved', ''),
    label: (el.textContent || '').replace(/^@/, ''),
    resolved: !(el.getAttribute('data-mention-type') || '').endsWith('-unresolved'),
  });
  const parsePageLink = el => ({
    pageId: el.getAttribute('data-pagelink'),
    label: el.getAttribute('data-pagelink-label') || el.textContent,
  });
  const attrs = { id: 'liadan', type: 'location', label: "Líadan's Rest — the \"inn\"", resolved: false };
  const html = docToHTML({ type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'tokMention', attrs },
    { type: 'pageLink', attrs: { pageId: 'a-b', label: 'A & B' } },
  ] }] });
  const box = document.createElement('div'); box.innerHTML = html;
  eq(parseMention(box.querySelector('[data-mention-type]')), attrs, 'C1 mention round-trips through journal parse rules');
  eq(parsePageLink(box.querySelector('[data-pagelink]')), { pageId: 'a-b', label: 'A & B' }, 'C2 pagelink round-trips');
}

/* ── D. refs ─────────────────────────────────────────────────────── */
{
  const doc = { type: 'doc', content: [
    { type: 'paragraph', content: [
      { type: 'tokMention', attrs: { id: 'caim', type: 'npc', label: 'Caim', resolved: true } },
      { type: 'tokMention', attrs: { id: 'caim', type: 'npc', label: 'Caim', resolved: true } },
      { type: 'tokMention', attrs: { id: 'runoff-row', type: 'location', label: 'Runoff Row', resolved: false } },
    ] },
    { type: 'paragraph', content: [
      { type: 'pageLink', attrs: { pageId: 'debts-oaths', label: 'Debts & oaths' } },
    ] },
  ] };
  const refs = docToRefs(doc);
  ok(refs.length === 3, 'D1 deduped');
  eq(refs[0], { kind: 'entity', type: 'npc', id: 'caim', label: 'Caim', resolved: true }, 'D2 entity ref shape');
  eq(refs[2], { kind: 'page', id: 'debts-oaths', label: 'Debts & oaths' }, 'D3 page ref shape');
}

/* ── E. feed body ────────────────────────────────────────────────── */
{
  const doc = { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
  ] };
  eq(docToFeedBody(doc), 'one<br>two', 'E1 p→br join, wrapper stripped');
}

/* ── F. freeSlug ─────────────────────────────────────────────────── */
{
  const mine = new Set(['the-sable-gate', 'the-sable-gate-2']);
  ok(freeSlug('The Sable Gate!', mine) === 'the-sable-gate-3', 'F1 suffix walks past taken slugs');
  ok(freeSlug('Fresh Title', mine) === 'fresh-title', 'F2 free title untouched');
  ok(freeSlug('???', new Set()) === 'note', 'F3 unsluggable title falls back');
  ok(freeSlug('The Sable Gate', new Set()) === slug('The Sable Gate'), 'F4 parity with journal slugger');
}

/* ── G. buildPool ────────────────────────────────────────────────── */
{
  const canon = { npcs: { 'ser-bellamy': { name: 'Ser Bellamy', role: 'knight' } }, locations: { 'the-ward': { name: 'The Ward' } } };
  const rows = [
    { id: 'ser-bellamy', type: 'npc', name: 'DUPLICATE — canon wins' },
    { id: 'pale-broker', type: 'npc', name: 'The Pale Broker', curated: false },
    { id: 'runoff-row', type: 'location', name: 'Runoff Row', curated: true },
  ];
  const pool = buildPool(canon, rows);
  ok(pool.npcs.length === 2 && pool.npcs[0].label === 'Ser Bellamy', 'G1 canon precedence over entity rows');
  ok(pool.npcs[1].hint === 'pending curation', 'G2 uncurated hint');
  ok(pool.locations.length === 2 && pool.locations[1].hint === '', 'G3 curated location, no hint');
}

/* ── H. picker (jsdom selection) ─────────────────────────────────── */
{
  const host = document.getElementById('host');
  host.innerHTML = '';
  let created = null;
  const comp = createComposer(host, {
    pool: () => ({ npcs: [{ id: 'cosmere-runestar', type: 'npc', label: 'Cosmere Runestar', hint: 'warlock' }], locations: [] }),
    pageItems: () => [{ id: 'debts-oaths', type: 'page', label: 'Debts & oaths', hint: 'Musings' }],
    onNewEntity: it => { created = it; },
  });
  const ed = comp.el;
  // type "ask @cos" — caret at end of the text node
  ed.appendChild(document.createTextNode('ask @cos'));
  const s = dom.window.getSelection(); const r = document.createRange();
  r.setStart(ed.firstChild, 8); r.collapse(true); s.removeAllRanges(); s.addRange(r);
  ed.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  const pick = host.querySelector('.mc-pick');
  ok(pick.style.display !== 'none' && pick.textContent.includes('Cosmere Runestar'), 'H1 @ trigger opens picker with match');
  ed.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  ok(ed.querySelector('[data-mention-key="cosmere-runestar"]'), 'H2 Enter inserts the chip');
  ok(!/\@cos/.test(ed.textContent), 'H3 trigger text consumed');
  ok(created === null, 'H4 resolved pick creates no entity');
  // [[ trigger
  const t2 = document.createTextNode(' see [[deb');
  ed.appendChild(t2);
  const r2 = document.createRange(); r2.setStart(t2, t2.nodeValue.length); r2.collapse(true);
  s.removeAllRanges(); s.addRange(r2);
  ed.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  ok(pick.textContent.includes('Debts & oaths'), 'H5 [[ trigger matches pages');
  ed.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  ok(ed.querySelector('[data-pagelink="debts-oaths"]'), 'H6 pagelink chip inserted');
  // unresolved create
  const t3 = document.createTextNode(' met @Zanthar the Grey');
  ed.appendChild(t3);
  const r3 = document.createRange(); r3.setStart(t3, t3.nodeValue.length); r3.collapse(true);
  s.removeAllRanges(); s.addRange(r3);
  ed.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  ok(pick.textContent.includes('Zanthar the Grey'), 'H7 no-match offers create rows');
  ed.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  ok(created && created.id === 'zanthar-the-grey' && created.type === 'npc', 'H8 unresolved pick reports the new entity');
  ok(ed.querySelector('[data-mention-type="npc-unresolved"]'), 'H9 unresolved chip carries the suffix');
  // serialization of what the picker built
  const doc2 = serializeDoc(ed);
  const refs2 = docToRefs(doc2);
  ok(refs2.some(x => x.kind === 'entity' && x.id === 'cosmere-runestar') &&
     refs2.some(x => x.kind === 'page' && x.id === 'debts-oaths') &&
     refs2.some(x => x.kind === 'entity' && x.id === 'zanthar-the-grey' && !x.resolved), 'H10 picker output serializes to full refs');
  ok(!comp.isEmpty(), 'H11 isEmpty false with content');
  comp.clear();
  ok(comp.isEmpty(), 'H12 clear empties');
}

/* ── I + J. boot regression + save path over a stub client ───────── */
{
  // Stage: the sheet template's journal block, mounted BEFORE __tok exists.
  const root = document.createElement('div');
  root.innerHTML =
    '<div class="block" data-sec="notes" data-journal-block style="display:none">' +
      '<div class="sectitle"><a data-journal-door href="#">door</a></div>' +
      '<div class="jc-cap" data-jc-capture></div>' +
      '<div class="jc-list-lab" data-jc-list-lab></div>' +
      '<div data-jc-list></div>' +
    '</div>';
  document.body.appendChild(root);

  const calls = { inserts: [], selects: [] };
  const table = name => ({
    select(cols) {
      calls.selects.push(name);
      const rows = name === 'journal_pages' ? [
        { id: 'row-1', author_id: 'me-uid', character_key: 'vesperian', folder: 'Musings', title: 'Debts & oaths',
          slug: 'debts-oaths', html: '<p>old page</p>', session: 11, shared_feed_id: 77, created_at: '2026-06-24T02:00:00Z', updated_at: '2026-06-24T02:00:00Z' },
        { id: 'row-2', author_id: 'someone-else', character_key: 'vesperian', folder: 'Unsorted', title: 'Not mine',
          slug: 'not-mine', html: '<p>x</p>', session: 11, shared_feed_id: null, created_at: '2026-06-24T02:00:00Z', updated_at: '2026-06-24T02:00:00Z' },
      ] : name === 'entities' ? [{ id: 'pale-broker', type: 'npc', name: 'The Pale Broker', curated: false }] : [];
      const q = {
        eq() { return q; }, order() { return Promise.resolve({ data: rows, error: null }); },
        maybeSingle() { return Promise.resolve({ data: name === 'campaign' ? { current_session: 12 } : rows[0] || null, error: null }); },
        then(res) { return Promise.resolve({ data: rows, error: null }).then(res); },
      };
      return q;
    },
    insert(row) {
      calls.inserts.push({ table: name, row });
      return {
        select() { return { maybeSingle: () => Promise.resolve({ data: Object.assign({ id: 'new-uuid', created_at: new Date().toISOString(), shared_feed_id: null }, Array.isArray(row) ? row[0] : row), error: null }) }; },
        then(res) { return Promise.resolve({ data: null, error: null }).then(res); },
      };
    },
  });
  const stubTok = {
    sb: { from: table },
    session: { user: { id: 'me-uid' } },
    ready: Promise.resolve({ characterKey: 'vesperian', role: 'overseer' }),   // nav.js's REAL camelCase shape (stub the contract, not the bug)
  };

  // canon pre-bridged so ensureCanon short-circuits (no script injection in jsdom)
  dom.window.__tokCanon = { npcs: { caim: { name: 'Caim' } }, locations: {} };

  const mounted = mountJournalCapture(root, 'vesperian');   // __tok NOT set yet — must wait
  let leaked = root.querySelector('[data-journal-block]').style.display === '';
  ok(!leaked, 'I1 block stays hidden before nav:ready');
  await new Promise(r => setTimeout(r, 60));
  dom.window.__tok = stubTok;
  document.dispatchEvent(new dom.window.CustomEvent('nav:ready'));   // the house idiom, on document
  await mounted;

  const block = root.querySelector('[data-journal-block]');
  ok(block.style.display === '', 'I2 block revealed after nav:ready');
  ok(block.querySelector('[data-journal-door]').href.includes('journal.html?character=vesperian'), 'I3 doorway href stamped');
  ok(block.querySelector('[data-jc-list]').textContent.includes('Debts & oaths'), 'J1 my page listed');
  ok(!block.querySelector('[data-jc-list]').textContent.includes('Not mine'), 'J2 other authors filtered from the list');
  ok(block.querySelector('.jc-shared'), 'J3 shared chip rendered');
  ok(block.querySelector('[data-jc-save]'), 'J4 composer present on my own seat');
  ok(block.querySelector('.jc-cap-lab').textContent.includes('session 12'), 'J5 current session surfaced');

  // drive a save: title + one mention typed via the composer's editor
  const titleEl = block.querySelector('.jc-title');
  titleEl.value = 'Debts & oaths';                          // dup title on purpose → slug must suffix
  const ed = block.querySelector('.mc-editor');
  ed.innerHTML = 'Owed to <span contenteditable="false" data-mention-type="npc" data-mention-key="caim" class="tok-mention npc-link">@Caim</span>';
  block.querySelector('[data-jc-save]').click();
  await new Promise(r => setTimeout(r, 30));

  const pageIns = calls.inserts.find(c => c.table === 'journal_pages');
  ok(!!pageIns, 'J6 journal_pages insert fired');
  ok(pageIns.row.character_key === 'vesperian' && pageIns.row.author_id === 'me-uid', 'J7 both identities on the row');
  ok(pageIns.row.folder === 'Field Notes' && pageIns.row.session === 12, 'J8 folder + session tagged');
  ok(pageIns.row.slug === 'debts-oaths-2', 'J9 dup slug suffixed against my slugs');
  ok(pageIns.row.doc && pageIns.row.doc.content[0].content[1].type === 'tokMention', 'J10 doc truth carries the mention node');
  ok(/data-mention-key="caim"/.test(pageIns.row.html), 'J11 html cache carries the journal-format span');
  const refIns = calls.inserts.find(c => c.table === 'journal_refs');
  ok(refIns && refIns.row[0] && refIns.row[0].page_id === 'new-uuid' && refIns.row[0].ref_id === 'caim' && refIns.row[0].ref_type === 'npc', 'J12 refs row shape');
  ok(block.querySelector('[data-jc-list]').textContent.match(/Debts & oaths/g).length >= 2, 'J13 new page prepended to the list');

  // seat gating: someone else's sheet → no composer
  const root2 = document.createElement('div');
  root2.innerHTML = root.innerHTML.replace(/<div class="jc-cap"[^>]*>[\s\S]*?(<div class="jc-list-lab")/, '<div class="jc-cap" data-jc-capture></div>$1');
  root2.querySelector('[data-journal-block]').style.display = 'none';
  document.body.appendChild(root2);
  await mountJournalCapture(root2, 'caim');                 // profile seat is vesperian
  ok(!root2.querySelector('[data-jc-save]'), 'J14 no composer on another seat');
  ok(root2.querySelector('[data-jc-capture]').textContent.includes('your own sheet'), 'J15 read-only note instead');
}

console.log('\ncapture-smoke: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
