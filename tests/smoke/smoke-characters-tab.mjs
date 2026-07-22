// smoke-characters-tab.mjs — validates the Characters tab without a browser/network:
//   1. groupRoster() buckets characters into folders + Unfiled correctly
//   2. CharacterData.loadLayout/saveLayout hit roster_layout (id=1) right
//   3. characters-tab.js registers a 'characters' tab against a mock TokRail
// Run: node tests/smoke/smoke-characters-tab.mjs
import { JSDOM } from 'jsdom';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.error('FAIL:', n); } };

// ── 1 + 3. characters-tab.js (groupRoster + registration) ─────────────────────
{
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { runScripts: 'outside-only', url: 'https://tok.test/world.html' });
  const win = dom.window;
  const registered = [];
  win.TokRail = { ready: true, registerTab: (spec) => registered.push(spec), show: () => {} };
  win.__tok = { ready: Promise.resolve({ role: 'overseer' }) };
  win.CharacterData = {
    loadParty: () => Promise.resolve([{ key: 'cosmere', name: 'Cosmere', structural: { classLabel: 'Wizard 5' } }]),
    loadLayout: () => Promise.resolve({}),
    saveLayout: () => Promise.resolve(),
    markDeletion: () => Promise.resolve(),
    remove: () => Promise.resolve()
  };
  win.eval(fs.readFileSync('characters-tab.js', 'utf8'));

  // registration
  ok('registers exactly one tab', registered.length === 1);
  const spec = registered[0] || {};
  ok('tab id is characters', spec.id === 'characters');
  ok('tab order 15 (between feed=10 and sheet=20)', spec.order === 15);
  ok('tab has onMount + onShow', typeof spec.onMount === 'function' && typeof spec.onShow === 'function');
  ok('full-page href encodes the character key', win.CharactersTab.sheetPageHref('sable north') === 'sheet-v2.html?character=sable%20north');

  // mounted roster: touch-visible actions + two-destination picker
  const pane = win.document.createElement('div');
  pane.id = 'tok-rail'; win.document.body.appendChild(pane);
  spec.onMount(pane);
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
  ok('top action opens the shared sheet picker', !!pane.querySelector('[data-act="picker"]'));
  ok('Shard Reforger remains a smaller secondary action', !!pane.querySelector('[data-act="forge"].ch-reforge'));
  ok('character row exposes a visible actions button', !!pane.querySelector('.ch-more[data-act="actions"]'));
  pane.querySelector('[data-act="picker"]').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
  ok('picker opens as a dialog', !!win.document.querySelector('.ch-picker[role="dialog"]'));
  ok('picker offers mounted sheet action', !!win.document.querySelector('[data-pick-mounted="cosmere"]'));
  ok('picker offers full character page', win.document.querySelector('.ch-pick-full')?.getAttribute('href') === 'sheet-v2.html?character=cosmere');
  win.document.querySelector('[data-picker-close]').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  win.document.dispatchEvent(new win.CustomEvent('combatsheets:add'));
  await new Promise(r => setTimeout(r, 0));
  ok('mounted-sheet add event opens the same picker', !!win.document.querySelector('.ch-picker[role="dialog"]'));

  // groupRoster
  const G = win.CharactersTab.groupRoster;
  const chars = [
    { key: 'cosmere', name: 'Cosmere' }, { key: 'caim', name: 'Caim' },
    { key: 'vesperian', name: 'Vesperian' }, { key: 'tester', name: 'Tester' }
  ];
  const layout = {
    folders: [{ id: 'f1', name: 'Party' }, { id: 'f2', name: 'NPCs' }],
    order: ['f2', 'f1'],
    members: { cosmere: 'f1', caim: 'f1', vesperian: 'f2', ghost: 'f9' }
  };
  const g = G(chars, layout);
  ok('folders returned in `order` (NPCs first)', g.folders[0].id === 'f2' && g.folders[1].id === 'f1');
  ok('Party has Cosmere + Caim', g.folders[1].chars.map(c => c.key).sort().join() === 'caim,cosmere');
  ok('NPCs has Vesperian', g.folders[0].chars.length === 1 && g.folders[0].chars[0].key === 'vesperian');
  ok('Tester (no membership) is Unfiled', g.unfiled.length === 1 && g.unfiled[0].key === 'tester');

  // member pointing at a deleted folder → unfiled
  const g2 = G([{ key: 'x', name: 'X' }], { folders: [{ id: 'f1', name: 'A' }], order: ['f1'], members: { x: 'fGONE' } });
  ok('member of a gone folder falls to Unfiled', g2.unfiled.length === 1 && g2.folders[0].chars.length === 0);

  // empty layout → everyone unfiled
  const g3 = G(chars, {});
  ok('empty layout → all unfiled', g3.unfiled.length === 4 && g3.folders.length === 0);

  // folder absent from order still appears (appended)
  const g4 = G([], { folders: [{ id: 'fa', name: 'A' }, { id: 'fb', name: 'B' }], order: ['fa'], members: {} });
  ok('folder missing from order is appended', g4.folders.length === 2 && g4.folders[1].id === 'fb');
}

// ── 2. CharacterData.loadLayout / saveLayout ──────────────────────────────────
{
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { runScripts: 'outside-only' });
  const win = dom.window;
  const captured = [];
  function builder(table) {
    const st = { table };
    const b = {
      select(cols) { st.op = 'select'; st.cols = cols; return b; },
      update(p) { st.op = 'update'; st.payload = p; return b; },
      eq(col, val) { st.eqCol = col; st.eqVal = val; return b; },
      then(resolve) {
        captured.push(st);
        let result;
        if (st.op === 'select') result = { data: [{ layout: builder._store }], error: null };
        else if (st.op === 'update') { builder._store = st.payload.layout; result = { data: null, error: null }; }
        else result = { data: [], error: null };
        return Promise.resolve(result).then(resolve);
      }
    };
    return b;
  }
  builder._store = { folders: [{ id: 'f1', name: 'Party' }], order: ['f1'], members: {} };
  win.__tok = { ready: Promise.resolve({ role: 'player' }), sb: { from: builder } };
  win.eval(fs.readFileSync('character-data.js', 'utf8'));
  const CD = win.CharacterData;

  const layout = await CD.loadLayout();
  const selCall = captured.find(c => c.op === 'select');
  ok('loadLayout selects roster_layout', selCall && selCall.table === 'roster_layout');
  ok('loadLayout filters id=1', selCall && selCall.eqCol === 'id' && selCall.eqVal === 1);
  ok('loadLayout returns the layout doc', layout && layout.folders && layout.folders[0].id === 'f1');

  await CD.saveLayout({ folders: [], order: [], members: { cosmere: 'f1' } });
  const updCall = captured.find(c => c.op === 'update');
  ok('saveLayout updates roster_layout', updCall && updCall.table === 'roster_layout');
  ok('saveLayout filters id=1', updCall && updCall.eqVal === 1);
  ok('saveLayout writes the layout + updated_at', updCall && updCall.payload.layout && updCall.payload.updated_at);
  ok('saveLayout persisted the membership', builder._store.members.cosmere === 'f1');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
