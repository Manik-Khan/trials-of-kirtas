// Audited generated-entry suppressions through the real mount/controller/render path.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const tick = () => new Promise(r => setTimeout(r, 0));
const settle = async (n = 10) => { for (let i = 0; i < n; i++) await tick(); };
const clone = o => JSON.parse(JSON.stringify(o));
let pass = 0, fail = 0;
const ok = (condition, label) => { if (condition) pass++; else { fail++; console.log('  FAIL: ' + label); } };

const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts:'outside-only', pretendToBeVisual:true });
global.window = dom.window; global.document = dom.window.document;
window.eval(readFileSync(new URL('../../resource-derive.js', import.meta.url), 'utf8'));
const { mountSheet } = await import('../../sheet-mount.js');

const caim = JSON.parse(readFileSync(new URL('../../data/characters/caim.json', import.meta.url), 'utf8'));
const fire = el => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles:true, cancelable:true }));
const lastStruct = saved => { for (let i=saved.length-1;i>=0;i--) if (saved[i].structural) return saved[i].structural; return null; };

async function mount(canEdit=true) {
  const row = { key:'caim', structural:clone(caim.structural), vitals:{ hp:24, conditions:[], pipState:{} }, notes:'' };
  const saved=[];
  const cd={
    loadCharacter:()=>Promise.resolve(clone(row)), canEdit:()=>Promise.resolve(canEdit),
    save:(key,patch)=>{ saved.push(clone(patch)); if (patch.structural) row.structural=clone(patch.structural); return Promise.resolve(clone(patch)); }
  };
  const container=document.createElement('div'); document.body.appendChild(container);
  const handle=mountSheet(container,'caim',{characterData:cd}); await handle.ready; await settle();
  return {container,saved};
}

// Spell: hide → audited active suppression → removed from display → restore.
{
  const {container,saved}=await mount(true);
  const row=container.querySelector('.spell[data-spell="Hellish Rebuke"]');
  ok(!!row, 'generated Hellish Rebuke renders before suppression');
  const hide=row && row.querySelector('[data-corr-suppress="spell"]');
  ok(!!hide, 'generated spell has an editor suppression control');
  fire(hide); await settle();
  let modal=document.querySelector('.corr-overlay');
  ok(!!modal && /Hide generated spell/.test(modal.textContent), 'spell suppression modal opens');
  modal.querySelector('[data-corr-note]').value='Zariel replaces Infernal Legacy.';
  fire(modal.querySelector('[data-corr-suppress-save]')); await settle();
  const hidden=lastStruct(saved), active=hidden && hidden.corrections && hidden.corrections.active;
  ok(active && active.length===1 && active[0].kind==='spell' && active[0].action==='suppress', 'spell suppression persisted in the correction ledger');
  ok(active && /Zariel/.test(active[0].note), 'table note persisted');
  ok(!container.querySelector('.spell[data-spell="Hellish Rebuke"]'), 'suppressed spell disappears from rendered sheet');
  ok(/1 active correction/.test(container.querySelector('[data-corr-health]').textContent), 'correction health reflects suppression');

  fire(container.querySelector('[data-corr-audit]')); await settle();
  modal=document.querySelector('.corr-overlay');
  const restore=modal && modal.querySelector('[data-corr-restore]');
  ok(!!restore && /Restore to generated/.test(restore.textContent), 'audit offers Restore to generated');
  fire(restore); await settle();
  const restored=lastStruct(saved);
  ok(restored.corrections.active.length===0 && restored.corrections.history.slice(-1)[0].kind==='restored', 'restore closes suppression and appends history');
  ok(!!container.querySelector('.spell[data-spell="Hellish Rebuke"]'), 'restored generated spell returns');
  container.remove();
}

// Feature: same correction path and source-specific hide.
{
  const {container,saved}=await mount(true);
  const feature=[...container.querySelectorAll('[data-list="features"] .feat')].find(el=>/Infernal Legacy/.test(el.querySelector('.f-n')?.textContent||''));
  ok(!!feature, 'generated Infernal Legacy renders before suppression');
  const hide=feature && feature.querySelector('[data-corr-suppress="feature"]');
  ok(!!hide, 'generated feature has an editor suppression control');
  fire(hide); await settle();
  const modal=document.querySelector('.corr-overlay');
  fire(modal.querySelector('[data-corr-suppress-save]')); await settle();
  const st=lastStruct(saved), active=st && st.corrections && st.corrections.active;
  ok(active && active[0].kind==='feature' && active[0].name==='Infernal Legacy', 'feature suppression persisted');
  ok(![...container.querySelectorAll('[data-list="features"] .f-n')].some(el=>el.textContent==='Infernal Legacy'), 'suppressed feature disappears from rendered sheet');
  ok([...container.querySelectorAll('[data-list="features"] .f-n')].some(el=>el.textContent==='Flurry of Blows'), 'unrelated feature remains');
  container.remove();
}

// View-only: controls remain inert and no modal/write occurs.
{
  const {container,saved}=await mount(false);
  const hide=container.querySelector('[data-corr-suppress]');
  ok(!container.querySelector('[data-sec="spells"]').classList.contains('corr-enabled'), 'view-only sheet does not enable correction controls');
  if (hide) fire(hide); await settle();
  ok(!document.querySelector('.corr-overlay') && saved.length===0, 'view-only suppression attempt is inert');
  container.remove();
}

console.log((fail?'✗':'✓')+' sheet-suppressions: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
