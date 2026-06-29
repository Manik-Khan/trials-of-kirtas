// smoke-nav-cog-flyout.mjs
// Drives the cog-flyout logic extracted from nav.js against a minimal DOM stub:
//  - opening lands on the menu pane with the download accordion collapsed
//  - the download row toggles its sub-actions
//  - "Sheet settings" calls AppearanceUI.mount() and drills into the appearance pane
//  - back returns to the menu; reopening re-collapses the accordion; close hides it
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./nav.js', import.meta.url), 'utf8');
const A = '// ==== COG FLYOUT (start) ====';
const B = '// ==== COG FLYOUT (end) ====';
const block = src.slice(src.indexOf(A), src.indexOf(B) + B.length);

// tiny DOM stub: stable per-id elements with .hidden + a classList
const els = {};
function el(id) {
  if (!els[id]) {
    const c = new Set();
    els[id] = {
      id, hidden: false,
      classList: {
        add: x => c.add(x), remove: x => c.delete(x), contains: x => c.has(x),
        toggle: (x, f) => { const want = f === undefined ? !c.has(x) : f; want ? c.add(x) : c.delete(x); return want; },
      },
    };
  }
  return els[id];
}
el('cog-flyout').hidden = true;   // starts hidden, like the rendered markup
const documentStub = { getElementById: el };
let mountCalls = 0;
const windowStub = { AppearanceUI: { mount: () => { mountCalls++; } } };

const F = new Function('document', 'window',
  block + '\n; return { toggleCogFlyout, toggleCogDownload, cogOpenSettings, cogShowPane, __cogClose };'
)(documentStub, windowStub);

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } };
const has = (id, cls) => el(id).classList.contains(cls);

// open
F.toggleCogFlyout();
ok('cog opens (flyout no longer hidden)', el('cog-flyout').hidden === false);
ok('opens on the menu pane', has('cog-pane-menu', 'on') && !has('cog-pane-appearance', 'on'));
ok('download accordion starts collapsed', !has('cog-row-download', 'open'));

// download accordion
F.toggleCogDownload();
ok('download row expands its sub-actions', has('cog-row-download', 'open') && has('cog-sub-download', 'open'));
F.toggleCogDownload();
ok('download row collapses again', !has('cog-row-download', 'open') && !has('cog-sub-download', 'open'));

// drill into settings
F.cogOpenSettings();
ok('settings drill-in invokes AppearanceUI.mount()', mountCalls === 1);
ok('drills into the appearance pane', has('cog-pane-appearance', 'on') && !has('cog-pane-menu', 'on'));

// back to menu
F.cogShowPane('menu');
ok('back returns to the menu pane', has('cog-pane-menu', 'on') && !has('cog-pane-appearance', 'on'));

// reopen re-collapses the accordion
F.toggleCogDownload();            // expand
F.toggleCogFlyout();              // close (was open)
ok('cog closes (flyout hidden)', el('cog-flyout').hidden === true);
F.toggleCogFlyout();             // reopen
ok('reopening re-collapses the download accordion', !has('cog-row-download', 'open'));
ok('reopening resets to the menu pane', has('cog-pane-menu', 'on'));

// explicit close (outside-click path)
F.__cogClose();
ok('__cogClose hides the flyout', el('cog-flyout').hidden === true);

console.log('\nsmoke-nav-cog-flyout: ' + pass + ' passed, ' + fail + ' failed  (AppearanceUI.mount calls=' + mountCalls + ')');
if (fail) process.exit(1);
