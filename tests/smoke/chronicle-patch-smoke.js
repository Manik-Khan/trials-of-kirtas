/* chronicle-patch-smoke.js — jsdom smoke for the July 2026 chronicle patch set.
   ① write-first bumpSessionTo (incl. the 0-row RLS silent block)
   ② staff-only 20h session prompt
   ③ session excluded from draft save/restore  ③b realtime repaint guard
   ④ clipboard-pipeline loads (Quill delta sync)
   ⑤ chip guard on editEntry
   ⑥ New Section dialog targets the viewed session and narrates failures
   Harness note: stubs are injected as a real <script> BEFORE the page's inline
   script (runScripts:'dangerously') so the page's top-level let/const land in
   the global lexical environment — indirect eval() scopes lexicals to itself,
   which silently hides them from later probes (July 2 lesson, same family as
   the classic-script global-lexical bridge).                                  */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
const T = (name, fn) => Promise.resolve().then(fn).then(
  () => { pass++; console.log('  ✓ ' + name); },
  e  => { fail++; console.log('  ✗ ' + name + ' — ' + e.message); });
const eq = (a, b, m) => { if (a !== b) throw new Error((m||'') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };

const html = fs.readFileSync(path.resolve(__dirname, '../..', 'chronicle.html'), 'utf8');

const STUBS = `
window.__alerts = [];
window.alert = m => window.__alerts.push(String(m));
window.confirm = () => true;
window.whenReady = fn => fn();

/* Quill stub — __delta tracks whether content arrived via the clipboard
   pipeline (setContents) vs raw innerHTML= (the desync path leaves it []). */
window.Quill = function (sel) {
  this.root = document.querySelector(sel) || document.createElement('div');
  this.__delta = [];
  this.clipboard = { convert: h => [{ insert: String(h == null ? '' : h) }] };
  this.setContents = d => { this.__delta = d; this.root.innerHTML = (d[0] && d[0].insert) || ''; };
  this.setSelection = () => {}; this.getLength = () => 1;
  this.getModule = () => ({ addHandler(){} });
  this.on = () => {}; this.focus = () => {};
  this.getSelection = () => null; this.insertEmbed = () => {};
  this.format = () => {}; this.getFormat = () => ({});
};

/* Supabase stub — fully chainable + thenable. The campaign update result is
   read at call time from window.__campaignUpdateResult.                     */
function __mkChain(table) {
  const result = () => table === 'campaign'
    ? (window.__campaignUpdateResult || { data: [], error: null })
    : { data: [], error: null };
  const chain = {};
  ['update','eq','insert','delete','order','limit','in','select','upsert','neq','is'].forEach(m => chain[m] = () => chain);
  chain.maybeSingle = () => Promise.resolve(table === 'campaign'
    ? { data: { current_session: 4, config: {} }, error: null }
    : { data: null, error: null });
  chain.single = chain.maybeSingle;
  chain.then = (res, rej) => Promise.resolve(result()).then(res, rej);
  return chain;
}
window.__tok = {
  sb: {
    from: t => __mkChain(t),
    channel: () => ({ on(){ return this; }, subscribe(){ return this; }, setAuth(){} }),
    rpc: () => Promise.resolve({ data: null, error: null }),
    removeChannel(){},
  },
  session: null,
  ready: Promise.resolve(null),
};
`;

function boot(campaignUpdateResult) {
  // Drop external <script src> tags, then prepend the stub script so it runs
  // first; the page's inline script executes as a real classic script.
  let doc = html.replace(/<script[^>]*src=[^>]*><\/script>/g, '');
  doc = doc.replace(/<script(?![^>]*src=)/, '<script>' + STUBS + '</scr' + 'ipt><script');
  const dom = new JSDOM(doc, { runScripts: 'dangerously', url: 'https://tok.manikkhan.com/chronicle.html' });
  dom.window.__campaignUpdateResult = campaignUpdateResult;
  return dom.window;
}
const settle = () => new Promise(r => setTimeout(r, 30)); // let the async init drain

(async () => {
  console.log('chronicle-patch-smoke');

  // ── ⑤ entryHasChips discrimination ─────────────────────────────────────
  {
    const w = boot({ data: [], error: null }); await settle();
    await T('chip guard: composer tok-mention span detected', () =>
      ok(w.eval(`entryHasChips('<span data-mention-type="npc" data-mention-key="k" class="tok-mention npc-link">@K</span>')`)));
    await T('chip guard: pageLink chip detected', () =>
      ok(w.eval(`entryHasChips('x <span data-pagelink="p1" data-pagelink-label="L" class="page-link">L</span>')`)));
    await T('chip guard: old Quill styled+tagged span NOT flagged', () =>
      ok(!w.eval(`entryHasChips('<span style="color: rgb(212, 172, 58);" data-mention-type="npc" data-mention-key="k">@K</span>')`)));
    await T('chip guard: plain html NOT flagged', () =>
      ok(!w.eval(`entryHasChips('<p>hello <b>world</b></p>')`)));
    await T('chip guard: empty/null NOT flagged', () =>
      ok(!w.eval(`entryHasChips('')`) && !w.eval(`entryHasChips(null)`)));
  }

  // ── ④ clipboard pipeline + ⑤ guard inside editEntry, ③ drafts ─────────
  {
    const w = boot({ data: [], error: null }); await settle();
    w.eval(`allEntries = [
      { id:'1', _rowId:1, session:3, text:'<p>plain entry</p>', timestamp:'2026-07-01T00:00:00Z' },
      { id:'2', _rowId:2, session:3, text:'hi <span data-mention-type="npc" data-mention-key="k" class="tok-mention npc-link">@K</span>', timestamp:'2026-07-01T00:00:00Z' },
    ]; drawerOpen = true;`);

    await T('editEntry(plain): loads via clipboard pipeline (delta non-empty)', () => {
      w.eval(`editEntry('1')`);
      ok(w.eval('quill.__delta.length > 0'), 'delta populated by setContents');
      eq(w.eval('editingEntryId'), '1');
    });
    await T('editEntry(chip-bearing): guard blocks, explains, no edit mode', () => {
      w.eval(`editingEntryId = null; quill.__delta = [];`);
      w.eval(`editEntry('2')`);
      eq(w.eval('editingEntryId'), null, 'must not enter edit mode');
      ok(w.eval(`__alerts.some(a => /mention chips/.test(a))`), 'guard explanation shown');
      eq(w.eval('quill.__delta.length'), 0, 'nothing loaded into the editor');
    });
    await T('restoreDraft: content via pipeline, session NOT restored', () => {
      w.eval(`localStorage.setItem(DRAFT_KEY, JSON.stringify({ session: 999, title: 't', content: '<p>draft</p>' }));
              document.getElementById('d-session').value = '4';
              quill.__delta = [];
              restoreDraft();`);
      eq(w.eval(`document.getElementById('d-session').value`), '4', 'stale draft session must not overwrite');
      ok(w.eval('quill.__delta.length > 0'), 'draft content through the pipeline');
    });
    await T('saveDraft: session key no longer persisted', () => {
      w.eval(`document.getElementById('d-title').value = 'T2'; saveDraft();`);
      const draft = JSON.parse(w.eval(`localStorage.getItem(DRAFT_KEY)`));
      ok(!('session' in draft), 'draft must not carry session');
      eq(draft.title, 'T2');
    });
  }

  // ── ① bumpSessionTo write-first ────────────────────────────────────────
  await T('bumpSessionTo(success): repaint only after confirmed write', async () => {
    const w = boot({ data: [{ current_session: 5 }], error: null }); await settle();
    w.eval(`currentSession = 4;`);
    await w.eval(`bumpSessionTo(5)`);
    eq(w.eval('currentSession'), 5, 'advances on success');
    eq(w.eval(`document.getElementById('dm-session-val').textContent`), 'Session 5');
    eq(w.eval(`document.getElementById('d-session').value`), '5');
  });
  await T('bumpSessionTo(RLS 0-row block): no fork, visible error', async () => {
    const w = boot({ data: [], error: null }); await settle();
    w.eval(`currentSession = 4; document.getElementById('dm-session-val').textContent = 'Session 4';`);
    await w.eval(`bumpSessionTo(5)`);
    eq(w.eval('currentSession'), 4, 'must NOT advance on 0-row block');
    eq(w.eval(`document.getElementById('dm-session-val').textContent`), 'Session 4', 'UI must not repaint');
    ok(w.eval(`__alerts.some(a => /NOT changed/.test(a))`), 'visible error surfaced');
  });
  await T('bumpSessionTo(hard error): no advance, message surfaced', async () => {
    const w = boot({ data: null, error: { message: 'boom' } }); await settle();
    w.eval(`currentSession = 4;`);
    await w.eval(`bumpSessionTo(5)`);
    eq(w.eval('currentSession'), 4, 'no advance on error');
    ok(w.eval(`__alerts.some(a => /boom/.test(a))`), 'error message surfaced');
  });

  // ── ② staff-only prompt ────────────────────────────────────────────────
  await T('checkSessionPrompt: hidden for non-staff', async () => {
    const w = boot({ data: [], error: null }); await settle();
    w.eval(`IS_STAFF = false; currentIdentity = { name:'P' };
            allEntries = [{ id:'1', timestamp: new Date(Date.now() - 30*3600*1000).toISOString(), session: 3, text:'x' }];
            checkSessionPrompt();`);
    ok(w.eval(`document.getElementById('session-prompt').classList.contains('hidden')`), 'stays hidden for players');
  });
  await T('checkSessionPrompt: shows for staff after 20h', async () => {
    const w = boot({ data: [], error: null }); await settle();
    w.eval(`IS_STAFF = true; currentIdentity = { name:'DM' };
            allEntries = [{ id:'1', timestamp: new Date(Date.now() - 30*3600*1000).toISOString(), session: 3, text:'x' }];
            checkSessionPrompt();`);
    ok(!w.eval(`document.getElementById('session-prompt').classList.contains('hidden')`), 'shows for staff');
  });

  // ── ③b realtime repaint guard ──────────────────────────────────────────
  await T('realtime d-session repaint: guarded by editingEntryId', async () => {
    const w = boot({ data: [], error: null }); await settle();
    w.eval(`editingEntryId = null; currentSession = 7;
            document.getElementById('d-session').value = '2';
            if (!editingEntryId) document.getElementById('d-session').value = currentSession;`);
    eq(w.eval(`document.getElementById('d-session').value`), '7');
    w.eval(`editingEntryId = 'x'; currentSession = 8;
            if (!editingEntryId) document.getElementById('d-session').value = currentSession;`);
    eq(w.eval(`document.getElementById('d-session').value`), '7', 'no repaint while editing');
  });

  // ── ⑥ New Section dialog ───────────────────────────────────────────────
  {
    const w = boot({ data: [], error: null }); await settle();
    await T('newSection: All Entries targets current session, chip is display-only', () => {
      w.eval(`currentSession = 5; activeFilters.session = null; activeChannel = null;
              allEntries = [{ session:5, sessionTitle:'The Fort Siege' }]; newSection();`);
      eq(w.eval(`document.getElementById('section-dialog').dataset.session`), '5');
      eq(w.eval(`document.getElementById('section-session-chip').textContent`), 'Session 5 · The Fort Siege');
      eq(w.eval(`document.getElementById('section-session-chip').tagName`), 'SPAN');
      ok(!w.eval(`document.getElementById('section-dialog').classList.contains('hidden')`), 'dialog opens');
    });
    await T('newSection: viewed Chronicle session overrides current session', () => {
      w.eval(`activeFilters.session = 3; allEntries = [{ session:3, sessionTitle:'The Long Road' }]; newSection();`);
      eq(w.eval(`document.getElementById('section-dialog').dataset.session`), '3');
      eq(w.eval(`document.getElementById('section-session-chip').textContent`), 'Session 3 · The Long Road');
    });
    await T('newSection: empty heading and write failure narrate inline', async () => {
      w.eval(`document.getElementById('section-title-input').value = '';`);
      await w.eval(`submitNewSection({ preventDefault(){} })`);
      ok(w.eval(`/Give this section/.test(document.getElementById('section-dialog-note').textContent)`), 'empty state explained');
      w.eval(`SB = null; document.getElementById('section-title-input').value = 'The Parlay';`);
      await w.eval(`submitNewSection({ preventDefault(){} })`);
      ok(w.eval(`/Could not add section: No Supabase client/.test(document.getElementById('section-dialog-note').textContent)`), 'write failure explained inline');
    });
  }

  // ── source-level assertions on the patched file ────────────────────────
  await T('source assertions: desync loads gone, verify + gate present', () => {
    ok(!/quill\.root\.innerHTML\s*=\s*(entry\.text|draft\.content)/.test(html), 'no raw innerHTML loads remain');
    ok(/\.select\('current_session'\)/.test(html), 'row-count verification present');
    ok(/if \(!IS_STAFF\) return;/.test(html), 'staff gate present in checkSessionPrompt');
    ok(/if \(!editingEntryId\) document\.getElementById\('d-session'\)\.value = currentSession;/.test(html), 'realtime repaint guard present');
    ok(!/session:\s*document\.getElementById\('d-session'\)\.value,/.test(html.slice(html.indexOf('function saveDraft'), html.indexOf('function saveDraft') + 600)), 'saveDraft no longer persists session');
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
