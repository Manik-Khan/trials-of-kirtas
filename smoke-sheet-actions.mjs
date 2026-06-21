// smoke-sheet-actions.mjs
// Drives wireInspiration() in jsdom against a mock CharacterData to prove the
// Phase-2 inspiration write: optimistic flip, FULL-vitals merge (hp/conditions
// preserved), reconcile to the server row, revert on a rejected save, and the
// canEdit gate. No browser, no Supabase — the page bootstrap is skipped under Node.
import { JSDOM } from 'jsdom';
import { wireInspiration } from './sheet-actions.js';

const tick = () => new Promise(r => setTimeout(r, 0));
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) pass++; else { fail++; console.log('  FAIL: ' + label); } };

const CLUSTER = `<!doctype html><html><body>
  <div class="portrait"></div>
  <div class="med cluster">
    <button class="cc rest" data-rest="short"><span class="ic"></span><span class="cclabel">Short Rest</span></button>
    <button class="cc center" id="insp-toggle" aria-pressed="false"><span class="ic"><span class="insp"></span></span><span class="cclabel">Inspiration</span></button>
    <button class="cc rest" data-rest="long"><span class="ic"></span><span class="cclabel">Long Rest</span></button>
  </div>
  <div class="insp-stat" id="insp-stat"></div>
</body></html>`;

const makeDoc = () => new JSDOM(CLUSTER).window.document;

function mockCD({ vitals, canEdit = true, failSave = false } = {}) {
  const calls = { save: [] };
  return {
    calls,
    async canEdit() { return canEdit; },
    async loadCharacter() { return { key: 'cosmere', vitals: JSON.parse(JSON.stringify(vitals)) }; },
    async save(key, patch) {
      calls.save.push({ key, patch });
      if (failSave) throw new Error('Save blocked');
      return { key, vitals: Object.assign({}, patch.vitals) };   // server echoes the stored row
    },
  };
}

// 1 — initial paint reflects vitals.inspiration === true
{
  const doc = makeDoc();
  const cd = mockCD({ vitals: { hp: 18, conditions: ['prone'], inspiration: true } });
  const { ready } = wireInspiration({ root: doc, characterData: cd, key: 'cosmere' });
  await ready; await tick();
  const t = doc.querySelector('#insp-toggle');
  ok(t.classList.contains('on'), 'initial: toggle .on when inspired=true');
  ok(doc.querySelector('.portrait').classList.contains('inspired'), 'initial: portrait halo on when inspired=true');
  ok(t.getAttribute('aria-pressed') === 'true', 'initial: aria-pressed=true');
}

// 2 — initial paint when off
{
  const doc = makeDoc();
  const cd = mockCD({ vitals: { hp: 18, inspiration: false } });
  const { ready } = wireInspiration({ root: doc, characterData: cd, key: 'cosmere' });
  await ready; await tick();
  ok(!doc.querySelector('#insp-toggle').classList.contains('on'), 'initial: toggle not .on when inspired=false');
  ok(!doc.querySelector('.portrait').classList.contains('inspired'), 'initial: portrait halo off');
}

// 3 — toggle on: optimistic flip + FULL-vitals merge payload + reconcile
{
  const doc = makeDoc();
  const cd = mockCD({ vitals: { hp: 12, hpTemp: 4, conditions: ['blinded'], inspiration: false } });
  const { ready } = wireInspiration({ root: doc, characterData: cd, key: 'cosmere' });
  await ready; await tick();
  const t = doc.querySelector('#insp-toggle');
  t.click();
  ok(t.classList.contains('on'), 'click: optimistic .on synchronously');
  ok(t.classList.contains('saving'), 'click: saving flag set');
  await tick(); await tick();
  ok(cd.calls.save.length === 1, 'click: save called exactly once');
  const v = cd.calls.save[0].patch && cd.calls.save[0].patch.vitals;
  ok(!!v && v.inspiration === true, 'click: payload sets inspiration=true');
  ok(v.hp === 12 && v.hpTemp === 4, 'click: payload PRESERVES hp + hpTemp (full-column merge)');
  ok(Array.isArray(v.conditions) && v.conditions[0] === 'blinded', 'click: payload preserves conditions');
  ok(!t.classList.contains('saving'), 'click: saving cleared after resolve');
  ok(t.classList.contains('on'), 'click: stays on after reconcile');
}

// 4 — toggle while already on → writes inspiration=false (merge from prior state)
{
  const doc = makeDoc();
  const cd = mockCD({ vitals: { hp: 7, inspiration: true } });
  const { ready } = wireInspiration({ root: doc, characterData: cd, key: 'cosmere' });
  await ready; await tick();
  doc.querySelector('#insp-toggle').click();
  await tick(); await tick();
  const v = cd.calls.save[0].patch.vitals;
  ok(v.inspiration === false, 'click-off: payload sets inspiration=false');
  ok(v.hp === 7, 'click-off: still preserves hp');
  ok(!doc.querySelector('#insp-toggle').classList.contains('on'), 'click-off: toggle now off');
}

// 5 — revert on a rejected save (nothing lost)
{
  const doc = makeDoc();
  const cd = mockCD({ vitals: { hp: 9, inspiration: false }, failSave: true });
  const { ready } = wireInspiration({ root: doc, characterData: cd, key: 'cosmere' });
  await ready; await tick();
  const t = doc.querySelector('#insp-toggle');
  t.click();
  ok(t.classList.contains('on'), 'reject: optimistic on before the failure');
  await tick(); await tick();
  ok(!t.classList.contains('on'), 'reject: reverts to off after failed save');
  ok(!doc.querySelector('.portrait').classList.contains('inspired'), 'reject: portrait halo reverts');
  ok(doc.querySelector('#insp-stat').classList.contains('error'), 'reject: shows the error/retry status');
  ok(cd.calls.save.length === 1, 'reject: a save was attempted');
}

// 6 — canEdit=false → inert, reflects state, never writes
{
  const doc = makeDoc();
  const cd = mockCD({ vitals: { inspiration: true }, canEdit: false });
  const { ready } = wireInspiration({ root: doc, characterData: cd, key: 'cosmere' });
  await ready; await tick();
  const t = doc.querySelector('#insp-toggle');
  ok(t.classList.contains('on'), 'view-only: still reflects state (inspired)');
  ok(t.classList.contains('view-only'), 'view-only: marked view-only');
  t.click();
  await tick(); await tick();
  ok(cd.calls.save.length === 0, 'view-only: click does NOT write');
}

console.log(`\nsheet-actions.js — inspiration write smoke: ${pass}/${pass + fail} pass` + (fail ? ` — ${fail} FAILED` : ' \u2713'));
process.exit(fail ? 1 : 0);
