// smoke-rail-settings.mjs — device preference storage, UI, and live consumers.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const src = readFileSync('./rail-settings.js', 'utf8');
const dom = new JSDOM('<!doctype html><html><head></head><body><aside id="tok-rail"><section class="tr-pane" data-rail-pane="settings"></section></aside></body></html>', {
  url: 'https://tok.test/world.html', runScripts: 'outside-only', pretendToBeVisual: true,
});
const { window } = dom, { document } = window;
let pass = 0, fail = 0;
const ok = (cond, label) => { cond ? pass++ : (fail++, console.log('  FAIL: ' + label)); };

let appearanceOpened = 0, railClosed = 0;
window.TokSettings = { open() { appearanceOpened++; } };
window.TokRail = { close() { railClosed++; } };
const rs = { advantage: true, disadvantage: false, bless: true, guidance: true };
window.__battle = {
  getRS() { return Object.assign({}, rs); },
  toggleRS(key) { rs[key] = !rs[key]; },
};
window.eval(src);

const pane = document.querySelector('[data-rail-pane="settings"]');
ok(!!window.TokPreferences, 'TokPreferences public seam exists');
ok(!!pane.querySelector('.tr-settings'), 'Settings hierarchy mounts into the rail pane');
ok(pane.querySelectorAll('.tr-pref-sec').length === 5, 'Workspace / Rolls / Accessibility / Alerts / Recovery render');
ok(!pane.querySelector('[data-section="alerts"] [data-toggle]'), 'Alerts expose no fake-save toggles');

const compact = pane.querySelector('[data-pref="feedDensity"][data-value="compact"]');
compact.click();
ok(document.getElementById('tok-rail').classList.contains('tr-feed-compact'), 'compact density applies immediately');
ok(JSON.parse(window.localStorage.getItem('tok.preferences.v1')).feedDensity === 'compact', 'preference persists locally');

pane.querySelector('[data-toggle="clearAdvDis"]').click();
pane.querySelector('[data-toggle="clearBonuses"]').click();
window.TokPreferences.consumeRoll();
ok(!rs.advantage && !rs.bless && !rs.guidance, 'roll completion consumes the enabled modifier groups');

pane.querySelector('[data-pref="motion"][data-value="reduced"]').click();
pane.querySelector('[data-pref="uiSize"][data-value="large"]').click();
pane.querySelector('[data-toggle="quietEffects"]').click();
ok(document.documentElement.getAttribute('data-tok-motion') === 'reduced', 'reduced motion stamps the shared UI contract');
ok(document.getElementById('tok-rail').classList.contains('tr-ui-large'), 'large interface size applies to the rail');
ok(document.getElementById('tok-rail').classList.contains('tr-quiet-effects'), 'quiet effects removes rail decoration');

let appearanceClickBubbled = 0;
document.addEventListener('click', () => { appearanceClickBubbled++; });
pane.querySelector('[data-action="appearance"]').click();
ok(appearanceOpened === 1 && railClosed === 1, 'Appearance summary hands off from rail to the ◐ flyout');
ok(appearanceClickBubbled === 0, 'Appearance handoff does not reach the flyout outside-click closer');

window.localStorage.setItem('tok.sheetFloat.v2', '{"left":20}');
pane.querySelector('[data-action="reset-layout"]').click();
ok(window.localStorage.getItem('tok.sheetFloat.v2') === null, 'floating-sheet reset clears only saved geometry');
ok(/next reopen/i.test(pane.querySelector('.tr-pref-status').textContent), 'layout reset narrates when it takes effect');

pane.querySelector('[data-action="reset-preferences"]').click();
const reset = window.TokPreferences.get();
ok(reset.feedDensity === 'comfortable' && reset.motion === 'system' && reset.clearAdvDis === false, 'device reset restores safe house defaults');

console.log(`smoke-rail-settings: ${pass}/${pass + fail} passed${fail ? `  (${fail} FAILED)` : ''}`);
process.exit(fail ? 1 : 0);
