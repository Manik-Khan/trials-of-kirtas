// smoke-world-focus.mjs
// ---------------------------------------------------------------------------
// Verifies the centering math in focusOnPin (world.html): clicking a mark in
// the list should pan the map so that mark sits dead-center at the current zoom.
// We slice the real function out of world.html and run it in jsdom with stubbed
// viewport dims (jsdom does no layout, so clientWidth is faked) and no-op
// applyTransform/clampTransform, then assert mapX/mapY land the pin at center.
//
// Run: node tests/smoke/smoke-world-focus.mjs
// ---------------------------------------------------------------------------
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

let pass = 0, fail = 0;
const ok = (c, label) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + label); } };
const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;

const html = readFileSync('./world.html', 'utf8');
const inline = (html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/) || [])[1] || '';
const a = inline.indexOf('function focusOnPin');
const b = inline.indexOf('function goToMark');
if (a < 0 || b < 0 || b <= a) { console.log('could not locate focusOnPin in world.html'); process.exit(1); }
const SRC = inline.slice(a, b);

const dom = new JSDOM('<!doctype html><html><body><div id="map-wrap"></div><div id="map-canvas"></div></body></html>', { runScripts: 'outside-only' });
const { window } = dom;

// fake viewport dims (jsdom returns 0 for clientWidth/Height — no layout engine)
const wrap = window.document.getElementById('map-wrap');
Object.defineProperty(wrap, 'clientWidth', { value: 1000, configurable: true });
Object.defineProperty(wrap, 'clientHeight', { value: 800, configurable: true });

// page globals focusOnPin leans on (script is non-strict, so these resolve/assign on window)
window.MAP_W = 4791; window.MAP_H = 3055;
window.mapScale = 0.2; window.mapX = 0; window.mapY = 0;
let applied = 0, clamped = 0;
window.applyTransform = () => { applied++; };
window.clampTransform = () => { clamped++; };   // no-op so we test the raw centering

window.eval(SRC);   // defines focusOnPin on window

// ── center pin (50%,50%) → its canvas px is (2395.5, 1527.5) at scale 0.2 ──
// want mapX so that mapX + px*scale === ww/2  →  mapX = 500 - 479.1 = 20.9
window.focusOnPin({ x: 50, y: 50 });
ok(near(window.mapX, 500 - (0.5 * 4791) * 0.2), 'centers X on a mid-map mark');
ok(near(window.mapY, 400 - (0.5 * 3055) * 0.2), 'centers Y on a mid-map mark');
ok(near(window.mapX + (0.5 * 4791) * 0.2, 500), 'pin lands at viewport center-X');
ok(near(window.mapY + (0.5 * 3055) * 0.2, 400), 'pin lands at viewport center-Y');
ok(applied === 1, 'applyTransform invoked');
ok(clamped === 1, 'clampTransform invoked (keeps it in bounds)');
ok(window.document.getElementById('map-canvas').style.transition.includes('transform'), 'glide transition set on the canvas');

// ── off-center pin (10%,80%) at a different zoom ──
window.mapScale = 0.5;
window.focusOnPin({ x: 10, y: 80 });
ok(near(window.mapX + (0.10 * 4791) * 0.5, 500), 'off-center pin centered-X at new zoom');
ok(near(window.mapY + (0.80 * 3055) * 0.5, 400), 'off-center pin centered-Y at new zoom');

// guard: missing pin is a no-op, not a crash
const beforeX = window.mapX;
window.focusOnPin(null);
ok(window.mapX === beforeX, 'null pin is a safe no-op');

console.log(`\nsmoke-world-focus: ${pass}/${pass + fail} passed${fail ? `  (${fail} FAILED)` : ''}`);
process.exit(fail ? 1 : 0);
