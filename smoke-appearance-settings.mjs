// smoke-appearance-settings.mjs
// ---------------------------------------------------------------------------
// Drives appearance-settings.js in jsdom. Unlike the inline-script smokes
// (rail, sheet, …) this is a real ES module — it exports mount/paintFloats and
// also hangs them on window.AppearanceSettings — so we import it directly after
// seeding jsdom globals, rather than eval'ing a <script> body.
//
// What it proves: the rail's Settings pane gets the Appearance customizer built
// into it, the panel CSS is fetched once on demand, mount is idempotent and
// no-ops when the pane is absent, and the live preview is routed onto EVERY
// open floating sheet (.sf-page) instead of the page the rail rides on — the
// "the forger got the look" bleed this module exists to avoid.
//
// No network, no Supabase: window.__tok carries no session, so loadCurrent()
// takes its values-only fallback to DEFAULT_APPEARANCE (deliberately skipping
// appearance.js's page-stamping side effect). The paint signal we assert on is
// applyFloatAppearance's own work: on a tab's first paint it injects the layer
// stack into .sf-bg and sets .tok-grain's backgroundImage — a standard prop
// jsdom retains, unlike the --bg-* custom props it also sets.
//
// Commit beside the other smoke-*.mjs. Run: node smoke-appearance-settings.mjs
// ---------------------------------------------------------------------------
import { JSDOM } from 'jsdom';

const tick   = () => new Promise(r => setTimeout(r, 0));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await tick(); };
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) pass++; else { fail++; console.log('  FAIL: ' + label); } };

// --- jsdom world (seed globals BEFORE importing the module) ----------------
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://tok.test/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

// Thin __tok: no session -> loadCurrent() falls back to DEFAULT_APPEARANCE and
// never touches the (null) Supabase client. Save isn't exercised here.
window.__tok = { ready: Promise.resolve(), session: null };

// A floating sheet page is just .sf-page > .sf-bg (empty): applyFloatAppearance
// injects the .tok-* layer stack into .sf-bg on first paint, so we don't.
function makeFloatPage() {
  const page = document.createElement('div');
  page.className = 'sf-page';
  const bg = document.createElement('div');
  bg.className = 'sf-bg';
  page.appendChild(bg);
  document.body.appendChild(page);
  return page;
}
const painted = page => {
  const g = page.querySelector('.sf-bg .tok-grain');
  return !!g && g.style.backgroundImage !== '';
};

// Import with NO settings pane in the DOM, so the module's boot-time auto-mount
// no-ops and we drive mount() explicitly with controlled timing.
const mod = await import('./appearance-settings.js');
await settle();

// (1) public surface
ok(typeof mod.mount === 'function' && typeof mod.paintFloats === 'function', 'exports mount + paintFloats');
ok(window.AppearanceSettings && typeof window.AppearanceSettings.mount === 'function'
   && typeof window.AppearanceSettings.paintFloats === 'function', 'window.AppearanceSettings exposes both');

// (2) mount() no-ops gracefully when the Settings pane is absent
let threw = false;
try { await mod.mount(); } catch (_) { threw = true; }
await settle();
ok(!threw, 'mount() with no settings pane does not throw');
ok(!document.getElementById('tok-appearance-css'), 'no appearance.css injected when there is no pane to fill');

// (3) with a Settings pane + two open floats, mount() builds the customizer in
const pane = document.createElement('div');
pane.className = 'tr-pane';
pane.setAttribute('data-rail-pane', 'settings');
document.body.appendChild(pane);

const pageA = makeFloatPage();
const pageB = makeFloatPage();
ok(!painted(pageA) && !painted(pageB), 'floats start unpainted (sanity)');

let mountErr = null;
try { await mod.mount(); } catch (e) { mountErr = e; }
await settle();
ok(!mountErr, 'mount() builds without throwing' + (mountErr ? ' — ' + String(mountErr.message).split('\n')[0] : ''));

const host = pane.querySelector('.tr-appearance');
ok(!!host, 'mount() builds a .tr-appearance host into the settings pane');
ok(host && host.classList.contains('tok-appearance'), 'host carries .tok-appearance (panel styling hook)');
ok(host && host.children.length > 0, 'buildAppearancePanel populated the host (controls present)');
ok(!!document.getElementById('tok-appearance-css'), 'appearance.css injected once on demand');

// (4) the live preview is routed onto EVERY open float, not the page
ok(painted(pageA), 'mount() painted float A (layer stack + grain texture stamped)');
ok(painted(pageB), 'mount() painted float B (preview reaches all open sheets)');
ok(!document.getElementById('bg') && !document.getElementById('fx'),
   'page-level #bg/#fx NOT stamped (no forger-got-the-look bleed)');

// (5) idempotent: a second mount() neither duplicates nor wipes the panel
const sameHost = pane.querySelector('.tr-appearance') === host;
await mod.mount();
await settle();
ok(pane.querySelectorAll('.tr-appearance').length === 1, 'mount() is idempotent (exactly one panel)');
ok(sameHost && pane.querySelector('.tr-appearance') === host, 'idempotent mount() preserves the existing host');

// (6) paintFloats() stamps a freshly-opened float (cfg-less call fills defaults)
const pageC = makeFloatPage();
ok(!painted(pageC), 'new float opens unpainted (sanity)');
mod.paintFloats({});
ok(painted(pageC), 'paintFloats() paints a newly-opened float');

// (7) paintFloats() with zero open floats is a safe no-op
document.querySelectorAll('.sf-page').forEach(p => p.remove());
let threw2 = false;
try { mod.paintFloats({}); } catch (_) { threw2 = true; }
ok(!threw2, 'paintFloats() with no open floats does not throw');

console.log(`smoke-appearance-settings: ${pass}/${pass + fail} passed` + (fail ? `  (${fail} FAILED)` : ''));
process.exit(fail ? 1 : 0);
