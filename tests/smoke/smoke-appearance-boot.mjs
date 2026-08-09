// smoke-appearance-boot.mjs
// The sheet's own appearance bridge must host the editor inside the same scoped
// wrapper used by floating sheets. This pins the regression where raw controls
// escaped their compact panel styling inside the nav Appearance flyout.
import { JSDOM } from 'jsdom';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) pass++; else { fail++; console.log('  FAIL: ' + label); } };

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="appearance-drawer"></div></body></html>', {
  url: 'https://tok.test/sheet-v2.html',
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.CustomEvent = dom.window.CustomEvent;
window.__tok = { ready: Promise.resolve(), session: null };

let ready = 0;
document.addEventListener('tok:appearance-ui-ready', () => { ready++; });
await import('../../appearance-boot.js');
await tick();

ok(ready === 1, 'announces the sheet Appearance bridge');
ok(document.documentElement.classList.contains('has-appearance'), 'marks the sheet as appearance-aware');
ok(typeof window.AppearanceUI?.mount === 'function', 'exposes AppearanceUI.mount');

window.AppearanceUI.mount();
await tick();
const drawer = document.getElementById('appearance-drawer');
const host = drawer.querySelector('.tr-appearance');
ok(!!host && host.classList.contains('tok-appearance'), 'mounts into the scoped .tok-appearance wrapper');
ok(host && host.children.length > 0, 'the wrapped editor contains controls');
ok(document.getElementById('tok-appearance-css')?.getAttribute('href') === 'appearance.css?v=appearance2', 'loads the compact panel stylesheet');
ok(host?.style.getPropertyValue('--ap-cream').includes('--ts-ink'), 'editor ink follows the active flyout look');

window.AppearanceUI.mount();
ok(drawer.querySelectorAll('.tr-appearance').length === 1, 'repeated mount keeps one editor');

console.log(`smoke-appearance-boot: ${pass}/${pass + fail} passed${fail ? `  (${fail} FAILED)` : ''}`);
process.exit(fail ? 1 : 0);
