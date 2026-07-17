// smoke-rail-dock.mjs — the RAIL-DOCK adapter contract, run against the
// adapter slice extracted from combat.html itself (never a local copy).
// The TokRail stub's SHAPE is verified against rail.js — the publisher's
// contract — before it's used: registerTab spec keys, window.__tokRail
// fields, the tok-rail:ready event, and TokRail.ready/show.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

let pass = 0, fail = 0;
const ok = (c, n) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)); };

// ── 1 · publisher's contract: parse rail.js, confirm the seam the stub mimics
const rail = readFileSync('./rail.js', 'utf8');
ok(/window\.__tokRail\s*=\s*\{\s*open:\s*false,\s*tab:\s*'feed'/.test(rail), "rail.js publishes __tokRail {open, tab}");
ok(/registerTab:\s*registerTab/.test(rail) && /ready:\s*true/.test(rail), 'rail.js exposes TokRail.registerTab + ready');
ok(/tok-rail:ready/.test(rail), 'rail.js dispatches tok-rail:ready');
ok(/show:\s*function\s*\(tab\)/.test(rail), 'rail.js exposes TokRail.show(tab)');
ok(/\{\s*id,\s*label,\s*icon\(svgString\),\s*order=50,\s*onMount\(paneEl\),\s*onShow\?\(\),\s*onHide\?\(\)\s*\}/.test(rail),
  "registerTab spec is {id,label,icon,order,onMount,onShow,onHide} as documented");

// ── 2 · extract the adapter slice from combat.html (the shipped bytes)
const html = readFileSync('./combat.html', 'utf8');
const start = html.indexOf('// ── RAIL-DOCK ADAPTER (BATTLE TAB)');
const stop = html.indexOf('function tickerUpdate');
ok(start > 0 && stop > start, 'adapter markers present in combat.html');
const slice = html.slice(start, stop);
ok(/dockRegister\('feed'/.test(html.slice(stop)) && !/buildFeed\(\);/.test(html),
  'buildFeed() is never called (its dead registration sweeps in increment 3)');

// ── 3 · run the slice in jsdom against the contract-shaped stub
const dom = new JSDOM('<div id="stage"></div>', { runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window, document = w.document;
const registered = [];
w.__tokRail = { open: false, tab: 'feed' };
let shownTab = null;
w.TokRail = {
  ready: true,
  registerTab: (spec) => {
    registered.push(spec);
    const pane = document.createElement('section');
    spec.onMount(pane);
    return { pane, button: document.createElement('button') };
  },
  show: (tab) => { shownTab = tab; w.__tokRail.open = true; w.__tokRail.tab = tab; },
};
w.eval('let stage = document.getElementById("stage");\n' + slice
  + '\nwindow.__h = { buildDock, dockRegister, dockOpen, syncTicker, railFeedVisible, get DOCK(){ return DOCK; } };');
const H = w.__h;

H.buildDock();
ok(registered.length === 1 && registered[0].id === 'battle' && registered[0].order === 20,
  "buildDock registers exactly one rail tab: 'battle', order 20");
ok(H.DOCK.host.querySelector('.bd-strip') && H.DOCK.host.querySelector('.dock-body'),
  'host carries the sub-strip + the shipped .dock-body (pane CSS untouched)');
ok(document.querySelector('#stage .roll-ticker') !== null, 'ticker mounts on the stage, not the rail');

// pane registrations in shipped order: display → bestiary → combat → tokens → scenes
H.dockRegister('display', { icon: '⚙', title: 'Display' });
H.dockRegister('bestiary', { icon: '☷', title: 'Bestiary', staff: true });
H.dockRegister('combat', { icon: '⚔', title: 'Combat', tab: 'Tracker', staff: true });
H.dockRegister('tokens', { icon: '👥', title: 'Tokens', tab: 'Tokens', staff: true });
H.dockRegister('scenes', { icon: '🗺', title: 'Scenes', staff: true });
const tabs = [...H.DOCK.strip.querySelectorAll('.bd-tab')];
ok(tabs.map(t => t.textContent).join() === 'Display,Bestiary,Tracker,Tokens,Scenes',
  'strip reads Display · Bestiary · Tracker · Tokens · Scenes');
ok(tabs.filter(t => t.classList.contains('staff')).length === 4, 'four staff-gated sections keep the staff class');
ok(H.DOCK.open === 'display', 'first registered section opens (Display — the players\' section)');

// sub-strip switching + onOpen
let opened = 0;
H.dockRegister('probe', { icon: '·', title: 'Probe', onOpen: () => opened++ });
H.dockOpen('combat');
ok(H.DOCK.panes.combat.btn.classList.contains('on') && H.DOCK.panes.combat.pane.classList.contains('show'),
  'dockOpen switches the strip + pane');
H.dockOpen('probe');
ok(opened === 1, 'onOpen fires on switch (tokensPaneOpen path holds)');
H.dockOpen('nonsense');
ok(H.DOCK.open === null, 'unknown id folds to null, no throw');

// ticker gating against rail state
H.DOCK.ticker.dataset.has = '1';
w.__tokRail.open = true; w.__tokRail.tab = 'feed';
H.syncTicker();
ok(!H.DOCK.ticker.classList.contains('show'), 'ticker hides while the rail Feed is visible');
w.__tokRail.tab = 'battle';
H.syncTicker();
ok(H.DOCK.ticker.classList.contains('show') && H.DOCK.ticker.classList.contains('rail-open'),
  'ticker shows on other rail tabs, offset past the open rail');
w.__tokRail.open = false;
H.syncTicker();
ok(H.DOCK.ticker.classList.contains('show') && !H.DOCK.ticker.classList.contains('rail-open'),
  'rail collapsed → ticker shows at the handle-clearing offset');
H.DOCK.ticker.dispatchEvent(new w.Event('click', { bubbles: true }));
ok(shownTab === 'feed', 'ticker click routes to TokRail.show("feed")');

// late-rail path: registration waits for tok-rail:ready
const dom2 = new JSDOM('<div id="stage"></div>', { runScripts: 'outside-only', pretendToBeVisual: true });
const w2 = dom2.window;
const reg2 = [];
w2.__tokRail = { open: false, tab: 'feed' };
w2.eval('let stage = document.getElementById("stage");\n' + slice + '\nwindow.__h = { buildDock };');
w2.__h.buildDock();
ok(reg2.length === 0, 'no rail yet → registration deferred, no throw');
w2.TokRail = { ready: true, registerTab: (s) => { reg2.push(s); s.onMount(w2.document.createElement('div')); }, show: () => {} };
w2.document.dispatchEvent(new w2.CustomEvent('tok-rail:ready'));
ok(reg2.length === 1 && reg2[0].id === 'battle', 'tok-rail:ready lands the deferred registration');

console.log(`\n${pass}/${pass + fail} assertions passed`);
process.exit(fail ? 1 : 0);
