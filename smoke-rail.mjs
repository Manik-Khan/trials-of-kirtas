// smoke-rail.mjs
// ---------------------------------------------------------------------------
// Drives rail.js in jsdom. rail.js is a CLASSIC script (an IIFE that attaches to
// window), so — like the other inline-script smokes — we eval it into the jsdom
// window rather than import it. feed-render.js (the shared row renderer the rail
// reuses) is eval'd in first so window.FeedRender exists and rail's dep-inject
// no-ops. The Supabase client is a thenable-builder mock that captures inserts
// and serves canned campaign/encounter/feed reads; no browser, no network.
//
// jsdom gotcha (documented): scripts eval'd into the window use window.Math.random
// (a different realm than node's global Math.random) — we stub BOTH. The rail's
// feed writes go through window.__tok.sb, so the mock captures the inserted row.
//
// Commit beside the other smoke-*.mjs. Run: node smoke-rail.mjs
// ---------------------------------------------------------------------------
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const tick = () => new Promise(r => setTimeout(r, 0));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await tick(); };
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) pass++; else { fail++; console.log('  FAIL: ' + label); } };

const FEED_RENDER_SRC = readFileSync('./feed-render.js', 'utf8');
const RAIL_SRC = readFileSync('./rail.js', 'utf8');

const CHARACTERS = {
  cosmere: { name: 'Cosmere' }, caim: { name: 'Caim' },
  liadan: { name: 'Líadan' }, vesperian: { name: 'Vesperian' },
};

// Canned feed: 3 visible (2 combat, 1 chronicle) + 1 hidden DM row (combat).
function feedRows() {
  return [
    { id: 1, channel: 'combat', kind: 'roll', actor_key: 'cosmere', actor_name: 'Cosmere', body: 'Eldritch Blast', hidden: false, created_at: '2026-06-23T19:42:00Z', author_id: 'u-cos' },
    { id: 2, channel: 'combat', kind: 'roll', actor_key: 'vesperian', actor_name: 'Vesperian', body: 'Longsword', hidden: false, created_at: '2026-06-23T19:43:00Z', author_id: 'u-ves' },
    { id: 3, channel: 'chronicle', kind: 'message', actor_key: 'liadan', actor_name: 'Líadan', body: 'We rest by the rift.', hidden: false, created_at: '2026-06-23T19:44:00Z', author_id: 'u-lia' },
    { id: 4, channel: 'combat', kind: 'roll', actor_key: null, actor_name: 'Dungeon Master', body: 'Captain slips into the dark', hidden: true, created_at: '2026-06-23T19:45:00Z', author_id: 'u-dm' },
  ];
}

// Thenable query-builder mock: every chain method returns the builder; the
// builder is awaitable and resolves per table / op.
function makeSb(state) {
  function builder(table) {
    const b = {
      _t: table, _op: 'select', _row: null,
      select() { return b; }, eq() { return b; }, neq() { return b; },
      order() { return b; }, limit() { return b; }, maybeSingle() { return b; },
      insert(row) { b._op = 'insert'; b._row = row; return b; },
      delete() { b._op = 'delete'; return b; },
      then(res, rej) { return Promise.resolve(result(b)).then(res, rej); },
    };
    return b;
  }
  function result(b) {
    if (b._op === 'insert') { state.inserts.push(b._row); return { data: null, error: null }; }
    if (b._op === 'delete') { state.deletes.push(true); return { data: null, error: null }; }
    if (b._t === 'campaign') return { data: { current_session: 14 }, error: null };
    if (b._t === 'encounters') return { data: { id: 'enc1', name: 'The Sunken Vault' }, error: null };
    if (b._t === 'feed') return { data: state.feedRows, error: null };
    return { data: null, error: null };
  }
  return {
    from(t) { return builder(t); },
    channel() { const ch = { on() { return ch; }, subscribe() { return ch; } }; return ch; },
  };
}

async function makeRail({ role, characterKey, withBattle = true }) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://tok.test/world.html', runScripts: 'outside-only' });
  const { window } = dom;
  // deterministic randomness in BOTH realms
  window.Math.random = () => 0.5; Math.random = () => 0.5;
  window.CHARACTERS = CHARACTERS;
  const state = { inserts: [], deletes: [], feedRows: feedRows() };
  const profile = { userId: 'u-cos', characterKey, role, username: 'tester', grants: [] };
  window.__tok = { sb: makeSb(state), session: { user: { id: 'u-cos' } }, ready: Promise.resolve(profile), profile };
  const toggled = [];
  if (withBattle) window.__battle = { getRS: () => ({ advantage: false, disadvantage: false, bless: false, guidance: false }), toggleRS: (m) => toggled.push(m), onRSChange: null };

  window.eval(FEED_RENDER_SRC);   // window.FeedRender
  let readyFired = false;
  window.document.addEventListener('tok-rail:ready', () => { readyFired = true; });
  window.eval(RAIL_SRC);          // boots; awaits __tok.ready internally
  await settle();
  return { window, document: window.document, state, toggled, profile, readyFired: () => readyFired };
}

// ── Scenario A: player ──────────────────────────────────────────────
{
  const { document, state } = await makeRail({ role: 'player', characterKey: 'cosmere' });
  const rail = document.getElementById('tok-rail');
  ok(!!rail, 'A: rail mounted');
  ok(!!document.querySelector('.tr-handle'), 'A: reopen handle present (sibling)');
  ok(rail.classList.contains('tr-collapsed'), 'A: defaults collapsed');
  const tabs = rail.querySelectorAll('.tr-tab');
  ok(tabs.length === 3, 'A: three tabs (Feed + Codex + Settings)');
  ok(rail.querySelector('.tr-tab.on span').textContent === 'Feed', 'A: Feed tab active by default');
  ok(rail.querySelectorAll('.tr-tab.future').length === 1, 'A: Codex disabled (Settings is a live tab)');
  ok(!rail.classList.contains('tr-no-rs'), 'A: RS seam present → mods live');
  ok(!rail.querySelector('.tr-hide'), 'A: no hide-toggle for a player');

  const list = rail.querySelector('[data-rail="feedlist"]');
  const rows = list.querySelectorAll('.feed-row');
  ok(rows.length === 2, 'A: combat channel shows 2 visible rows (hidden DM row masked)');
  ok(!list.textContent.includes('slips into the dark'), 'A: hidden DM row not rendered for player');
  ok(list.querySelectorAll('.feed-del').length === 0, 'A: player gets no delete buttons on others’ rows');

  // header reflects campaign session + active encounter
  ok(rail.querySelector('.tr-ses .k').textContent.includes('14'), 'A: header shows Session 14');
  ok(rail.querySelector('[data-rail="title"]').textContent === 'The Sunken Vault', 'A: header shows active encounter name');
}

// ── Scenario B: staff (DM) ──────────────────────────────────────────
{
  const { document, state } = await makeRail({ role: 'dm', characterKey: null });
  const rail = document.getElementById('tok-rail');
  ok(!!rail.querySelector('.tr-hide'), 'B: staff gets the hidden-post toggle');
  const list = rail.querySelector('[data-rail="feedlist"]');
  // combat channel, staff → includes the hidden DM row (3 combat rows total)
  const rows = list.querySelectorAll('.feed-row');
  ok(rows.length === 3, 'B: staff sees hidden DM row in combat channel (3 rows)');
  ok(list.textContent.includes('slips into the dark'), 'B: hidden DM row rendered for staff');
  ok(list.querySelectorAll('.feed-del').length === 3, 'B: staff gets delete affordance on every row');

  // composer submit → captured insert with the right shape
  const inp = rail.querySelector('.tr-composer input');
  inp.value = 'The vault doors groan open';
  inp.dispatchEvent(new document.defaultView.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await settle();
  const msg = state.inserts.find(r => r.body && r.body.includes('groan'));
  ok(!!msg, 'B: composer text posted an insert');
  ok(msg && msg.channel === 'chronicle' && msg.kind === 'message', 'B: plain text → chronicle/message');
  ok(msg && msg.actor_name === 'Dungeon Master' && msg.actor_key === null, 'B: DM posts with no actor_key');
  ok(msg && msg.session === 14 && msg.encounter_id === 'enc1', 'B: insert stamped with session + active encounter');

  // a /roll posts a roll row to combat
  inp.value = '/roll 1d20+5';
  inp.dispatchEvent(new document.defaultView.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await settle();
  const roll = state.inserts.find(r => r.kind === 'roll' && r.formula === '1d20+5');
  ok(!!roll, 'B: /roll posts a roll row');
  ok(roll && roll.channel === 'combat' && /ft-tot/.test(roll.body), 'B: roll row is combat-channel with a rendered total');
}

// ── Scenario C: tabs, collapse, channel toggle, mods, no-battle ─────
{
  const { document, toggled } = await makeRail({ role: 'player', characterKey: 'cosmere' });
  const rail = document.getElementById('tok-rail');
  const handle = document.querySelector('.tr-handle');

  // open via handle
  handle.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));
  ok(!rail.classList.contains('tr-collapsed'), 'C: handle click opens the rail');
  ok(handle.classList.contains('tr-open'), 'C: handle tracks open state');

  // (the Sheet tab was removed — sheets open in the float now; tab-switching is
  // exercised by the registry test in section E.) A future tab does nothing:
  rail.querySelector('.tr-tab.future').dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));
  ok(!rail.querySelector('.tr-pane[data-rail-pane="codex"]').classList.contains('on'), 'C: disabled tab is inert');

  // channel toggle → chronicle shows the 1 chronicle row
  rail.querySelector('.tr-tab[data-rail-tab="feed"]').dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));
  rail.querySelector('[data-rail-chan="chronicle"]').dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));
  const chronRows = rail.querySelectorAll('[data-rail="feedlist"] .feed-row');
  ok(chronRows.length === 1, 'C: chronicle channel shows the single chronicle row');

  // mod pill drives the battle.js seam
  rail.querySelector('.tr-mod[data-m="bless"]').dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));
  ok(toggled.includes('bless'), 'C: mod pill calls __battle.toggleRS');

  // localStorage persisted the open state + tab
  const saved = JSON.parse(document.defaultView.localStorage.getItem('tok.rail.v1') || '{}');
  ok(saved.open === true, 'C: open state persisted');
}

// ── Scenario D: no battle.js on the page → mods muted, feed still works ─
{
  const { document } = await makeRail({ role: 'player', characterKey: 'cosmere', withBattle: false });
  const rail = document.getElementById('tok-rail');
  ok(rail.classList.contains('tr-no-rs'), 'D: rail marks tr-no-rs when battle.js seam absent');
  ok(rail.querySelectorAll('[data-rail="feedlist"] .feed-row').length === 2, 'D: feed still renders without battle.js');
}

// ── Scenario E: the registerTab seam (Marks is the first rider) ─────
{
  const { document, readyFired } = await makeRail({ role: 'player', characterKey: 'cosmere' });
  const win = document.defaultView;
  const rail = document.getElementById('tok-rail');
  ok(readyFired(), 'E: tok-rail:ready event fired');
  ok(win.TokRail && win.TokRail.ready === true, 'E: TokRail.ready exposed');
  ok(typeof win.TokRail.registerTab === 'function', 'E: registerTab exposed');

  let mountedPane = null, shows = 0, hides = 0;
  win.TokRail.registerTab({
    id: 'marks', label: 'Marks', order: 50,
    icon: '<svg viewBox="0 0 18 18"><circle cx="9" cy="9" r="4"/></svg>',
    onMount: (pane) => { mountedPane = pane; pane.innerHTML = '<div class="marks-mock">two marks</div>'; },
    onShow: () => { shows++; }, onHide: () => { hides++; },
  });

  const markBtn = rail.querySelector('.tr-tab[data-rail-tab="marks"]');
  ok(!!markBtn && markBtn.querySelector('span').textContent === 'Marks', 'E: Marks tab button added with label');
  ok(!!mountedPane && rail.querySelector('.tr-pane[data-rail-pane="marks"]') === mountedPane, 'E: onMount received the pane');
  ok(mountedPane.querySelector('.marks-mock'), 'E: page-supplied content lives in the pane');

  // built-ins untouched: feed/codex/settings all still present (+marks = 4)
  ok(rail.querySelectorAll('.tr-tab').length === 4, 'E: four tabs total (3 built-in + Marks)');
  ok(rail.querySelector('.tr-tab[data-rail-tab="feed"]') && rail.querySelectorAll('.tr-tab.future').length === 1, 'E: built-in tabs unaffected');

  // ordering: feed(10) < marks(50) < codex(80)
  const kids = Array.prototype.slice.call(rail.querySelector('.tr-tabs').children);
  const iFeed = kids.findIndex(c => c.dataset.railTab === 'feed');
  const iMarks = kids.findIndex(c => c.dataset.railTab === 'marks');
  const iCodex = kids.findIndex(c => c.dataset.order === '80');
  ok(iFeed < iMarks && iMarks < iCodex, 'E: Marks inserts by order (after Feed, before Codex)');

  // switching fires onShow / onHide
  markBtn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  ok(rail.querySelector('.tr-pane[data-rail-pane="marks"]').classList.contains('on') && shows === 1, 'E: clicking Marks shows its pane + fires onShow');
  rail.querySelector('.tr-tab[data-rail-tab="feed"]').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  ok(hides === 1, 'E: leaving Marks fires onHide');

  // re-register replaces (no duplicate tab)
  win.TokRail.registerTab({ id: 'marks', label: 'Marks', order: 50, onMount: (p) => { p.innerHTML = '<div class="marks-v2">updated</div>'; } });
  ok(rail.querySelectorAll('.tr-tab[data-rail-tab="marks"]').length === 1, 'E: re-registering an id replaces, no dup');
  ok(rail.querySelector('.tr-pane[data-rail-pane="marks"] .marks-v2'), 'E: re-register remounts fresh content');

  // unregister removes tab + pane
  win.TokRail.unregisterTab('marks');
  ok(!rail.querySelector('.tr-tab[data-rail-tab="marks"]') && !rail.querySelector('.tr-pane[data-rail-pane="marks"]'), 'E: unregisterTab removes the tab + pane');
  ok(rail.querySelectorAll('.tr-tab').length === 3, 'E: back to three built-in tabs');
}

console.log(`\nsmoke-rail: ${pass}/${pass + fail} passed${fail ? `  (${fail} FAILED)` : ''}`);
process.exit(fail ? 1 : 0);
